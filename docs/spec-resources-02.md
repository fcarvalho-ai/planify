# Spécification fonctionnelle — Ressources 02

Statut : proposition prête pour revue SPEC
Version cible : `0.3.0-alpha`
Date : 2026-08-14
Owner : Product / Domain Ressources 02

## 1. Objectif et position dans la roadmap

Le module Ressources 02 constitue le référentiel opérationnel qui suit immédiatement le module Organisation 01. Il permet de décrire précisément les moyens humains et techniques d'une organisation, en priorité les salles de post-production, puis de les rendre disponibles aux modules Parc matériel, Maintenance et Planning.

L'ordre métier est obligatoire :

```text
Organisation validée
  -> site actif
  -> unité organisationnelle active
  -> ressources de l'unité
  -> équipement des salles depuis le parc matériel
  -> disponibilité
  -> projet validé
  -> planification
```

Une ressource ne peut donc jamais être créée dans un contexte organisationnel incomplet. Cette règle remplace le comportement RC1 qui permettait une ressource générique avec seulement un nom, un type et un site.

Le module doit supporter sans dégradation fonctionnelle une organisation possédant au moins 120 salles de montage, auxquelles s'ajoutent les salles d'étalonnage, de mixage, de PAD, de laboratoire et les futurs types de salles ou services.

## 2. Dépendances et préconditions bloquantes

Ressources 02 dépend du contrat Organisation 01 suivant :

- une `organization` active et validée, avec `legalName`, `primaryActivity`, un ensemble `activities` non vide et un fuseau par défaut ; `primaryActivity` appartient obligatoirement à `activities` et `tradeName` reste facultatif ;
- au moins un `site` actif et validé, portant une adresse exploitable et un fuseau IANA ;
- au moins une `organizationUnit` active et validée, de type `service`, `laboratory`, `department` ou `team`, rattachée à la même organisation et compatible avec le site sélectionné ;
- l'utilisateur connecté appartient à l'organisation et possède l'accès au site concerné.

La création d'une ressource est refusée avec le contrat canonique `409 PREREQUISITE_NOT_MET` et `details.stage`, `details.missingFields`, `details.nextAction` si l'une de ces préconditions manque. Une soumission Organisation encore incomplète conserve `422 ONBOARDING_INCOMPLETE`. L'interface explique l'étape à compléter et propose un lien vers celle-ci, sans créer de brouillon partiel dans Ressources.

Une organisation peut représenter notamment `ELIOTE Props Prod`, `Eliote Location` ou `FAV Location`. Le modèle ne contient aucune règle codée en dur pour ces noms : toute organisation correctement validée bénéficie du même fonctionnement et reste strictement isolée des autres.

« Organisation » est le libellé métier présenté dans l'interface. Dans la persistance, les DTO, l'API, les événements, audits et ports intermodules, l'identifiant canonique du tenant est exclusivement `companyId`.

## 3. Périmètre

### Inclus dans Ressources 02

- catalogue extensible de types de ressources et de types de salles ;
- salles de post-production rattachées à une organisation, un site et une unité organisationnelle ;
- ressources humaines rattachées à une organisation, avec site principal et affectations versionnées aux sites et unités ;
- capacité, caractéristiques techniques et état opérationnel des ressources ;
- composition d'une salle par sélection d'équipements existants dans le Parc matériel ;
- orchestration des poses/déposes d'équipements sérialisés par les commandes Stock, avec historique lu depuis son journal immuable ;
- prévention de la double affectation physique d'un même exemplaire ;
- exposition de la disponibilité consolidée aux modules Maintenance et Planning ;
- recherche, tri, filtres, pagination, import ultérieur préparé par les contrats mais non livré ;
- audit, contrôle optimiste, idempotence et invalidation SSE après mutation réussie.

### Hors périmètre de ce lot

- création de réservation et règles projet/émission, traitées par Projets puis Planning ;
- écriture directe de mouvements ou projections Stock, achats, amortissement, location, devis et facturation ;
- gestion détaillée des compétences, contrats, temps de travail et paie des ressources humaines ;
- plans de salle, câblage, supervision temps réel ou inventaire automatique ;
- suppression physique d'une ressource ou de son historique ;
- migration implicite du monolithe CommonJS/JSON vers la cible TypeScript/React/SQLite.

## 4. Vocabulaire et modèle métier

### 4.1 Ressource

Une `resource` est une entité planifiable appartenant à une seule organisation. Ses catégories initiales sont :

- `room` : salle physique ;
- `person` : ressource humaine ;
- `other` : extension contrôlée pour une ressource planifiable future.

Le matériel n'est pas dupliqué dans `resources` : il est créé et identifié dans le Parc matériel. Une salle référence des exemplaires matériels au moyen d'affectations.

Champs communs obligatoires :

| Champ | Règle |
|---|---|
| `id` | identifiant opaque, immuable |
| `companyId` | issu du contexte de session, jamais accepté comme autorité du client |
| `siteId` | site actif, validé, accessible et appartenant à l'organisation |
| `organizationUnitId` | unité active du même tenant ; son `siteId` vaut celui de la ressource ou est nul pour une unité globale |
| `category` | valeur fermée `room`, `person`, `other` |
| `code` | code métier normalisé, unique par organisation |
| `name` | 2 à 120 caractères, unique par site et catégorie |
| `status` | `draft`, `active`, `temporarily_unavailable`, `inactive` |
| `capacity` | entier de 1 à 999 ; pour une salle, nombre d'unités simultanément planifiables, défaut 1 |
| `characteristics` | objet structuré borné, selon le type de ressource |
| `version` | entier de contrôle concurrent optimiste |

`draft` n'est pas planifiable. Le passage à `active` exige que tous les champs obligatoires du type soient valides. `inactive` interdit toute nouvelle réservation mais conserve l'historique. Une ressource avec réservation future active ne peut pas devenir `inactive` sans annulation ou réaffectation préalable des réservations.

### 4.2 Salle de post-production

Une ressource `room` porte un `roomTypeId` issu d'un catalogue administrable. Le seed initial propose :

- `editingRoom` — salle de montage ;
- `gradingRoom` — salle d'étalonnage ;
- `mixingRoom` — auditorium ou salle de mixage ;
- `padRoom` — salle de PAD, contrôle et livraison ;
- `laboratoryRoom` — laboratoire ;
- `otherRoom` — type futur explicitement nommé.

Le catalogue n'impose aucune limite de volume. Une organisation doit pouvoir créer, filtrer et planifier au moins 120 salles de type `editingRoom`. Les codes de salle sont uniques par organisation et restent stables lors d'un renommage.

Champs de salle : étage/zone facultatif, nombre de postes, capacité d'accueil, accessibilité, surface, formats image/son supportés, logiciels ou usages, connectivité et notes opérationnelles. Les caractéristiques sont structurées et bornées ; les notes libres ne doivent jamais être interprétées comme HTML.

Une salle appartient exactement à un site et à une `organizationUnit`. Son changement de site est interdit dès qu'elle possède un historique d'équipement ou de réservation ; la procédure consiste à désactiver la salle et en créer une nouvelle. Un changement d'unité au sein du même site est permis avec `version`, audit et contrôle des réservations futures.

### 4.3 Ressource humaine

Une ressource `person` décrit une personne planifiable sans exposer de données RH sensibles. Elle porte `primarySiteId`, `primaryOrganizationUnitId`, une capacité par défaut égale à 1, une fonction, un statut opérationnel et des compétences sous forme de références contrôlées. Le site et l'unité principaux servent de défaut d'affichage ; ils ne suffisent pas seuls à autoriser une planification.

`personSiteAssignments` est la relation versionnée faisant autorité pour les sites d'intervention : `personResourceId`, `siteId`, `isPrimary`, `startsAt`, `endsAt?`, `status` (`active`, `ended`), `version`. À tout instant, une personne possède exactement une affectation active `isPrimary=true`, dont le site égale `primarySiteId`, et peut avoir des affectations secondaires simultanées dans la même organisation. Changer `primarySiteId` clôt/bascule les relations concernées et incrémente leurs versions dans une mutation Ressources atomique. `personOrganizationUnitAssignments`, également versionnée, porte `personResourceId`, `organizationUnitId`, `siteId?`, `isPrimary`, `startsAt`, `endsAt?`, `status`, `version` ; elle permet plusieurs unités secondaires compatibles sans dupliquer la personne.

Pour le Planning, la totalité de `[startsAt, endsAt)` doit être couverte par une `personSiteAssignment` active sur le site de la réservation. Une unité secondaire n'accorde jamais implicitement l'accès à son site. Une même personne ne peut consommer plus de sa capacité cumulée sur l'ensemble des sites ; deux réservations simultanées sur deux sites entrent donc en conflit. Un déplacement vers un autre site relit les relations versionnées et repasse le contrôle global. Les temps de trajet et horaires contractuels restent hors lot et doivent être signalés comme limites, jamais simulés silencieusement.

L'adresse privée, les coordonnées personnelles, le salaire, le contrat, les données de santé et toute donnée disciplinaire sont interdits dans ce module. Le lien facultatif à un compte utilisateur est opaque et ne confère aucun droit supplémentaire.

### 4.4 Affectation d'équipement à une salle

Le lien d'un équipement à une salle est une projection de Stock 07a, pas un second registre Ressources. L'objet canonique est `equipmentAsset` et toute commande porte au minimum :

| Champ | Règle |
|---|---|
| `roomId` | salle active ou en brouillon, même organisation et même site physique |
| `roomVersion` | version optimiste exacte de la salle, revalidée sous verrou avant l'écriture Stock |
| `equipmentAssetId` | exemplaire sérialisé Stock 07a identifié par référence article et numéro de série |
| `equipmentAssetVersion` | version optimiste exacte relue avant écriture |
| `siteId` | site canonique de la salle et de l'exemplaire |
| `stockLocationId` | emplacement physique Stock courant ou destination validée par Stock |
| `role` | usage dans la salle : poste principal, écran, stockage, audio, réseau, autre |
| `isRequiredForOperation` | indique si l'indisponibilité du matériel rend la salle indisponible |
| `reason` | motif de pose/dépose, 3 à 500 caractères, texte simple |

L'utilisateur recherche le Parc par référence, désignation, marque ou numéro de série et sélectionne un exemplaire précis. L'API ne fait jamais confiance au libellé affiché : elle relit l'exemplaire par identifiant et contrôle organisation, site, statut et version.

**Stock 07a est l'unique writer physique.** Ressources 02 ne modifie jamais `equipmentAsset.status`, `equipmentAsset.siteId`, `equipmentAsset.stockLocationId`, `maintenanceRecord`, les legs, mouvements ou projections Stock. Ressources appelle exclusivement le port Stock avec les commandes :

- `assignAssetToRoom({ roomId, roomVersion, equipmentAssetId, equipmentAssetVersion, siteId, stockLocationId, role, isRequiredForOperation, reason })` ;
- `unassignAssetFromRoom({ roomId, roomVersion, equipmentAssetId, equipmentAssetVersion, siteId, destinationStockLocationId, reason })` ;
- `getRoomAssets(roomId)` et `getAssetAvailability(roomId, window)` pour les lectures.

Stock vérifie la salle via le port de lecture Ressources `getRoomAssignmentContext(roomId)` puis écrit dans sa transaction canonique le mouvement physique, la localisation/projection de l'exemplaire, le lien courant à la salle, le journal Stock et l'audit. Une salle peut être représentée par un emplacement logique résolu par Stock, mais Ressources ne crée ni solde, ni mouvement, ni journal d'affectation parallèle. L'historique affiché sur la fiche Salle est exclusivement dérivé du journal Stock par `equipmentAssetId` et `roomId`.

Un exemplaire sérialisé ne peut avoir qu'une seule affectation physique active, toutes salles et emplacements confondus. Une tentative concurrente ou une affectation dans une autre organisation/site est refusée par Stock sans écriture partielle. Une correction est un nouveau mouvement compensatoire dans le même journal append-only.

Les exemplaires `out`, `maintenance`, `quarantine`, `retired`, inactifs ou autrement indisponibles ne peuvent pas être affectés. Une affectation active déjà existante reste visible si l'exemplaire passe ultérieurement en maintenance.

## 5. Disponibilité consolidée

La disponibilité est calculée par le serveur ; elle n'est pas une valeur librement éditable par l'interface.

Ressources est writer de `resourceUnavailability` pour les indisponibilités propres à une salle ou une personne : `resourceId`, `kind` (`structural`, `calendar`), `startsAt`, `endsAt`, `reason`, `version`. Les intervalles sont semi-ouverts, le motif est obligatoire et le statut `temporarily_unavailable` de la ressource est une projection, pas un substitut aux périodes. Cette entité ne représente jamais la maintenance physique d'un `equipmentAsset`, qui reste exclusivement dans Stock.

Pour une salle :

1. `inactive` ou `draft` implique `not_schedulable` ;
2. une `resourceUnavailability` active implique `unavailable` sur sa période ;
3. une intervention structurelle déclarée sur la salle implique `unavailable` ;
4. la maintenance ou l'indisponibilité d'un équipement affecté avec `isRequiredForOperation=true` implique `unavailable` ;
5. un équipement non requis indisponible implique `degraded` et un avertissement, sans blocage automatique ;
6. les réservations `option` et `confirmed` consomment la capacité ; les réservations `cancelled` ne la consomment pas ;
7. en l'absence de blocage, la capacité restante sur un intervalle est calculée selon les intervalles semi-ouverts `[début, fin)`.

Le Planning reçoit toujours `availabilityStatus`, `availabilityReasons[]`, `remainingCapacity` et `overridePolicy`. La matrice suivante est normative :

| Cause | Statut | Création normale | Override |
|---|---|---|---|
| salle `draft` ou `inactive` | `not_schedulable` | refusée | jamais |
| organisation, site ou unité non conforme | `not_schedulable` | refusée | jamais |
| indisponibilité structurelle de salle | `unavailable` | refusée | jamais |
| indisponibilité calendaire manuelle | `unavailable` | refusée | seulement avec `planning.override_unavailability`, motif non vide et audit |
| équipement requis `out`, `maintenance`, `quarantine`, `retired` ou inactif | `unavailable` | refusée | jamais |
| équipement requis avec conflit temporel Stock, mais physiquement disponible | `unavailable` | refusée | seulement si Stock autorise l'override temporel et avec `planning.override_conflict`, motif et audit |
| équipement non requis indisponible | `degraded` | autorisée avec avertissement | sans objet |
| conflit de réservation ou capacité Planning dépassée | `conflict` | refusée | seulement avec `planning.override_conflict`, motif non vide et audit |
| indisponibilité calendaire manuelle **et** conflit réservation/capacité/Stock sur la même commande | `unavailable` + `conflict` | refusée | cumul obligatoire de `planning.override_unavailability` **et** `planning.override_conflict`, motif non vide couvrant les deux causes et audit des deux politiques |
| ressource humaine sans affectation de site couvrant toute la période | `not_schedulable` | refusée | jamais |

`planning.override_conflict` couvre exclusivement les conflits de réservation, de capacité ou les conflits temporels Stock que Stock déclare surchargeables. `planning.override_unavailability` couvre exclusivement une `resourceUnavailability.kind=calendar`. Aucune des deux permissions ne remplace l'autre : lorsque les deux familles de causes sont présentes, Planning exige les deux permissions dans la même décision, conserve les deux codes dans `overridePolicy` et les audite. Une cause marquée « jamais » maintient le refus même si toutes les permissions sont présentes. Un override ne modifie jamais la projection Stock et ne rend jamais physiquement disponible un exemplaire. L'état dégradé est visible mais ne bloque pas par défaut.

Une maintenance d'actif ouverte ou clôturée par Stock invalide la disponibilité de la salle concernée après réception de son événement post-commit. Une indisponibilité structurelle de salle reste écrite par Ressources. Aucune copie divergente de ces règles ne doit exister côté frontend.

## 6. Workflow et validation progressive

L'interface présente un parcours séquentiel avec validation serveur à chaque étape :

1. sélectionner l'organisation courante validée ;
2. sélectionner un site actif et complet ;
3. sélectionner ou créer une unité organisationnelle autorisée ;
4. choisir la catégorie et, pour une salle, le type ;
5. renseigner identité, capacité et caractéristiques obligatoires ;
6. enregistrer le brouillon ;
7. pour une salle, sélectionner les équipements depuis le Parc et contrôler leur disponibilité ;
8. vérifier la synthèse et activer la ressource ;
9. seulement après activation, exposer la ressource au Planning.

Une étape suivante reste inaccessible tant que l'étape courante n'est pas validée. Le retour à une étape antérieure est permis tant que ses modifications ne violent pas un invariant aval. Toute erreur indique le champ, la règle et l'action corrective. Une fermeture volontaire conserve uniquement un brouillon explicitement enregistré ; aucun autosave silencieux ne crée de ressource incomplète.

Pour planifier une salle, le workflow transverse est strict : une organisation, un site et une unité valides ainsi qu'une salle active doivent exister, puis un projet de type émission avec référence validée doit être créé. Une réservation sans `projectId` valide est refusée. Cette exigence PO constitue une évolution explicite par rapport à `docs/spec-mvp.md`, où le projet était facultatif ; Planning devra adopter ce contrat avant intégration du parcours complet.

### 6.1 Owners, writers et handoffs

| Donnée/commande | Owner et writer unique | Handoff vers Ressources 02 |
|---|---|---|
| organisation, site, `organizationUnit` | Organisation 01 | lecture canonique avec `version`; aucun cache faisant autorité |
| identité, type, capacité, statut et `resourceUnavailability` structurelle/calendaire | Ressources 02 | `getRoomAssignmentContext`, disponibilité et événements Ressources |
| `personSiteAssignments`, `personOrganizationUnitAssignments` | Ressources 02 | projection versionnée consommée par Planning |
| article, `equipmentAsset`, localisation, lien physique salle, mouvements et maintenance d'actif | Stock 07a | commandes/lectures du port Stock et événements Stock post-commit |
| projet, réservation, capacité consommée et override Planning | Projets 04 / Planning 03 | lecture des gates Ressources et Stock avant mutation |

Le handoff Organisation → Ressources publie les identifiants et versions validés de l'organisation, du site et de l'unité. Le handoff Ressources → Stock publie `roomId`, `roomVersion`, `companyId`, `siteId`, statut et contexte d'unité, sans permettre à Stock de modifier la salle. Le handoff Stock → Ressources renvoie `equipmentAssetId`, nouvelle `equipmentAssetVersion`, `siteId`, `stockLocationId`, projection du lien salle, `correlationId` et événements à publier après commit. Le handoff Ressources/Stock → Planning fournit une projection horodatée ; Planning la relit dans sa transaction de réservation et ne déduit jamais l'autorité depuis un événement SSE.

Au niveau des fichiers, un seul writer intervient à la fois sur `server.js` et les collections partagées. L'owner Organisation publie d'abord son contrat approuvé, l'owner Ressources adapte ses lectures, puis l'owner Stock publie les commandes physiques. Chaque remise indique fichiers, schémas/versions, tests, risques, rollback et gate atteint. Aucun owner ne peut approuver indépendamment son propre changement.

## 7. Permissions et sécurité

Catalogue minimal :

| Permission | Capacités |
|---|---|
| `resource.read` | lire les ressources et leur disponibilité dans les sites autorisés |
| `resource.manage` | créer/modifier/activer/désactiver les ressources dans les sites autorisés |
| `resource.assign_equipment` | autoriser la pose/dépose depuis la fiche Salle ; la commande exige aussi `stock.move` |
| `resource.manage_human` | gérer les champs non sensibles des ressources humaines |
| `resource.type.manage` | gérer les types de salles et caractéristiques contrôlées |
| `maintenance.read` | consulter les motifs de disponibilité nécessaires à l'exploitation |
| `planning.override_conflict` | permission canonique consommée par Planning 03 uniquement pour un conflit de réservation, de capacité ou temporel Stock surchargeable |
| `planning.override_unavailability` | permission canonique du catalogue partagé, consommée par Planning 03 pour outrepasser uniquement une indisponibilité calendaire manuelle selon la matrice |
| `audit.read` | lire l'historique selon le périmètre autorisé |

Le rôle Administrateur possède toutes ces permissions et `stock.move`. Le Planificateur possède `resource.read` et `maintenance.read`; les permissions d'override ne lui sont attribuées que par rôle explicite. Le Lecteur possède `resource.read`. Les droits effectifs restent limités aux sites de l'utilisateur. Ressources publie `overridePolicy`, mais seul Planning évalue `planning.override_conflict` et `planning.override_unavailability` lors de la mutation de réservation ; aucun alias, renommage local ou permission Ressources équivalente n'est autorisé.

Tous les endpoints :

- dérivent `companyId` de la session ;
- vérifient le site côté serveur, y compris pour les identifiants devinés ;
- protègent les mutations par session, origine stricte et CSRF ;
- valident longueurs, formats, valeurs fermées et tailles des collections ;
- utilisent des erreurs non discriminantes pour les entités hors périmètre ;
- écrivent l'audit après validation de toutes les règles et publient le SSE après commit seulement ;
- n'exposent ni secret, ni donnée RH sensible, ni contenu d'une autre organisation.

## 8. Contrats API v1

Conventions : JSON UTF-8 en `camelCase`, pagination `items/page/pageSize/total`, `Idempotency-Key` sur création et affectation, `version` sur modification, réponses d'erreur stables avec `requestId`.

```text
GET    /api/v1/resource-types?category=&active=
POST   /api/v1/resource-types
PATCH  /api/v1/resource-types/:id

GET    /api/v1/resources?siteId=&organizationUnitId=&category=&roomTypeId=&status=&availability=&q=&page=&pageSize=
POST   /api/v1/resources
GET    /api/v1/resources/:id
PATCH  /api/v1/resources/:id
POST   /api/v1/resources/:id/activate
POST   /api/v1/resources/:id/deactivate
GET    /api/v1/resources/:id/availability?from=&to=
GET    /api/v1/resources/:id/unavailabilities?from=&to=&kind=
POST   /api/v1/resources/:id/unavailabilities
PATCH  /api/v1/resources/:id/unavailabilities/:unavailabilityId

GET    /api/v1/resources/:id/person-site-assignments?activeAt=&includeHistory=
POST   /api/v1/resources/:id/person-site-assignments
PATCH  /api/v1/resources/:id/person-site-assignments/:assignmentId
GET    /api/v1/resources/:id/person-unit-assignments?activeAt=&includeHistory=
POST   /api/v1/resources/:id/person-unit-assignments
PATCH  /api/v1/resources/:id/person-unit-assignments/:assignmentId

GET    /api/v1/resources/:id/equipment?activeAt=&includeHistory=
POST   /api/v1/resources/:id/equipment/assign
POST   /api/v1/resources/:id/equipment/:equipmentAssetId/unassign
GET    /api/v1/resources/:id/equipment-history?page=&pageSize=

GET    /api/v1/equipment/assets?siteId=&locationId=&status=available&q=&page=&pageSize=
```

Les deux routes de mutation d'équipement sont des façades Ressources : elles autorisent la salle puis transmettent sans réécriture la commande `assignAssetToRoom` ou `unassignAssetFromRoom` au port Stock. Elles ne persistent aucune affectation Ressources. Leur réponse canonique vient de Stock.

Les listes sont triées de manière stable (`name`, puis `id`) et `pageSize` est borné à 100. Une recherche vide ne retourne jamais tout le parc matériel par défaut. Les mutations renvoient la représentation canonique complète et sa nouvelle `version`.

Codes d'erreur spécifiques :

- `PREREQUISITE_NOT_MET` ;
- `RESOURCE_CODE_ALREADY_EXISTS` ;
- `RESOURCE_NAME_ALREADY_EXISTS` ;
- `RESOURCE_TYPE_INVALID` ;
- `RESOURCE_ACTIVATION_INCOMPLETE` ;
- `RESOURCE_HAS_FUTURE_BOOKINGS` ;
- `RESOURCE_SITE_IMMUTABLE` ;
- `ASSET_UNAVAILABLE` ;
- `STOCK_CONFLICT`, avec une cause générique telle que `alreadyAssigned` ou `siteMismatch` sans exposer un autre tenant ;
- `VERSION_CONFLICT`.

Événements d'invalidation Ressources versionnés : `resource.created.v1`, `resource.updated.v1`, `resource.activated.v1`, `resource.deactivated.v1`, `resource.availability_changed.v1`. Les changements physiques restent annoncés uniquement par les événements Stock `equipmentAsset.updated.v1`, `stockMovement.created.v1` et `maintenance.updated.v1` ; Ressources invalide puis relit.

## 9. Validations et atomicité

- unicité de `code` par organisation, insensible à la casse et aux espaces périphériques ;
- unicité de `name` par site et catégorie après normalisation ;
- cohérence obligatoire organisation → site → `organizationUnit` → ressource ;
- capacité entière positive et caractéristiques conformes au schéma du type ;
- au plus 200 caractéristiques structurées et 20 équipements dans une mutation groupée ;
- dates ISO 8601 avec offset à l'entrée, UTC en persistance ;
- contrôle `version` avant toute modification concurrente ;
- affectation : la façade transmet `roomVersion`, `equipmentAssetId`, `equipmentAssetVersion`, `siteId` et `stockLocationId`; sous le verrou d'écriture commun, Stock relit salle et exemplaire, valide l'absence d'affectation active, puis écrit mouvement, localisation, lien salle, version et audit dans une seule transaction Stock ;
- désaffectation : Stock valide les versions puis écrit mouvement compensatoire, destination, clôture du lien physique, version et audit dans la même transaction ;
- échec de n'importe quel contrôle : aucune écriture, aucun audit mensonger, aucun SSE ;
- nouvelle tentative avec la même clé d'idempotence et le même corps : même résultat ; même clé avec corps différent : refus.

La persistance RC1 reste JSON atomique pour ce lot tant qu'aucune migration approuvée n'est engagée. Dans le monolithe, le port Stock est le coordinateur de la mutation physique et conserve le verrou jusqu'au commit atomique du fichier temporaire puis renommage. Si la validation de salle, l'écriture Stock ou l'audit échoue, tout est abandonné. Une architecture séparant ultérieurement les transactions devra faire l'objet d'une nouvelle spécification ; aucune double écriture ou compensation asynchrone implicite n'est autorisée ici.

## 10. Interface attendue

### Liste Ressources

- filtres visibles : organisation courante non modifiable, site, unité organisationnelle, catégorie, type de salle, statut, disponibilité et recherche ;
- tableau ou grille virtualisée affichant code, nom, site, unité, type, capacité, statut, disponibilité et alertes ;
- compteur fiable, pagination et tri stables ;
- création guidée et reprise explicite d'un brouillon ;
- états chargement, vide, erreur et accès refusé distincts.

### Fiche Salle

- identité et rattachement organisationnel ;
- caractéristiques et capacité ;
- onglet « Équipements installés » avec référence, désignation, marque, numéro de série, rôle, état Parc/Maintenance, localisation Stock et date du mouvement canonique ;
- action « Affecter depuis le parc » par recherche et sélection, jamais par saisie libre d'un numéro de série ;
- action de désaffectation avec motif obligatoire et avertissement si le matériel est requis ;
- historique chronologique non modifiable, lu exclusivement depuis le journal Stock ;
- aperçu de disponibilité et lien vers le Planning filtré sur la salle.

L'interface reste utilisable au clavier, conserve un focus visible et associe texte/icône aux statuts. Les listes de 120 salles ou plus ne doivent pas provoquer de blocage perceptible.

## 11. Critères d'acceptation

### Dépendance Organisation

- [ ] Sans organisation active avec `legalName`, `primaryActivity` et `activities`, site ou unité complète et validée, une création de ressource est refusée côté serveur et l'UI dirige vers l'étape manquante ; l'absence de `tradeName` ne bloque jamais.
- [ ] Une ressource créée dans l'organisation A est invisible et inaccessible à tout utilisateur de l'organisation B, y compris par identifiant deviné.
- [ ] Un utilisateur sans accès au site reçoit un refus non discriminant pour la lecture et toute mutation.

### Salles et ressources humaines

- [ ] Un administrateur crée successivement des salles de montage, étalonnage, mixage, PAD et laboratoire, chacune rattachée au bon site et à la bonne `organizationUnit`.
- [ ] Le système accepte au moins 120 salles de montage distinctes dans une organisation et permet de les rechercher, filtrer et paginer.
- [ ] Un type de salle futur peut être ajouté sans modification du catalogue codé en dur ni perte des anciens types.
- [ ] Une salle incomplète reste `draft` et n'apparaît pas comme sélectionnable dans le Planning.
- [ ] Une salle complète peut être activée ; code, capacité et caractéristiques sont retrouvés après redémarrage.
- [ ] Une ressource humaine ne peut contenir de donnée interdite et ses sites d'intervention restent dans son organisation.
- [ ] Le changement de site d'une salle historisée est refusé ; le changement d'unité compatible est audité et soumis à `version`.

### Équipement et historique

- [ ] Depuis une salle, l'administrateur retrouve un `equipmentAsset` du Parc par référence ou numéro de série et l'affecte sans ressaisie de ses données, en transmettant sa version et sa localisation Stock.
- [ ] Un exemplaire affecté disparaît des résultats disponibles et une seconde affectation, même concurrente, échoue avec `STOCK_CONFLICT` sans second mouvement.
- [ ] Un exemplaire d'une autre organisation, d'un autre site ou indisponible ne peut pas être affecté et aucune écriture partielle n'est créée.
- [ ] Une désaffectation exige un motif, clôt l'affectation active et rend l'exemplaire réaffectable selon son statut Parc.
- [ ] Poses et déposes restent visibles après redémarrage depuis le seul journal Stock, horodaté avec acteurs, motifs et `correlationId`; aucune collection ou écriture physique parallèle n'existe dans Ressources.
- [ ] Une ancienne `version` est refusée sans écraser l'état actuel.

### Maintenance, disponibilité et Planning

- [ ] La déclaration d'une intervention structurelle sur la salle par Ressources la rend indisponible au Planning ; elle ne crée aucun `maintenanceRecord` Stock.
- [ ] La maintenance d'un équipement requis affecté produit `unavailable` sans override ; celle d'un équipement non requis produit `degraded` sans blocage automatique.
- [ ] Chaque ligne de la matrice d'indisponibilité et d'override est couverte par un test positif et un test négatif de permission.
- [ ] Une personne est planifiable sur un site seulement si une `personSiteAssignment` versionnée couvre toute la période ; le contrôle de capacité reste global à tous ses sites et unités secondaires.
- [ ] Une salle inactive ou en brouillon ne peut jamais recevoir de nouvelle réservation.
- [ ] Les réservations actives consomment la capacité selon les intervalles semi-ouverts et une annulation la libère.
- [ ] Aucune réservation n'est créée avant l'existence d'un projet/émission actif avec référence valide.

### Qualité et sécurité

- [ ] La matrice rôles × actions est vérifiée côté API, notamment lecteur et planificateur sans droit de mutation Ressources.
- [ ] CSRF, origine, validation, isolation organisation/site, XSS des notes et liste statique sont couverts par des tests négatifs.
- [ ] Toute mutation réussie possède un audit ; toute mutation refusée ne publie aucun événement de succès.
- [ ] Les actions essentielles fonctionnent au clavier et aucun statut ne dépend uniquement d'une couleur.

## 12. Performance et volumétrie

Jeu de référence déterministe : 3 organisations, 10 sites, 25 services, 500 ressources dont au moins 120 salles de montage sur un même site, 2 000 exemplaires matériels, 1 500 affectations historiques et 10 000 réservations.

Objectifs sur machine locale standard, Node.js ≥ 20, données chaudes :

- `GET /api/v1/resources` filtré et paginé : p95 < 300 ms ;
- recherche d'équipement disponible par référence ou numéro de série : p95 < 250 ms ;
- affectation avec contrôles d'unicité, mouvement et audit : p95 < 250 ms ;
- fiche salle avec équipements actifs : p95 < 300 ms ;
- première liste exploitable à l'écran : < 2 s ;
- filtre ou recherche sur 120+ salles : retour visuel < 200 ms après réponse, sans gel de l'interface.

Les mesures doivent documenter commande, environnement, volumes, échauffement, nombre d'itérations, p50/p95/max et limites. Les listes restent paginées et les lignes virtualisées si le rendu complet dépasse le budget.

## 13. Scénarios E2E obligatoires

1. Créer ou sélectionner une organisation complète avec `primaryActivity` et sans `tradeName`, un site puis une unité Post-production ; créer et activer une salle de montage.
2. Créer au moins 120 salles de montage via un jeu déterministe, puis retrouver une salle précise par code, filtre d'unité et pagination.
3. Créer un article et deux exemplaires sérialisés dans le Parc, rechercher le premier par numéro de série, l'affecter à une salle puis vérifier la fiche et l'historique après rechargement.
4. Tenter d'affecter simultanément le même exemplaire à une autre salle : une seule opération réussit, l'autre est refusée, sans état partiel.
5. Passer l'équipement requis en maintenance, vérifier l'impact sur la disponibilité de la salle et le refus de planification ; clôturer la maintenance et vérifier la restauration attendue.
6. Désaffecter avec motif, affecter l'exemplaire à une autre salle et vérifier que les deux périodes historiques sont non chevauchantes.
7. Créer une ressource humaine avec `primarySiteId`, deux `personSiteAssignments` et une unité secondaire ; vérifier période, conflit global multi-site, versions et isolation inter-organisation.
8. Vérifier le workflow transverse complet : organisation → site → unité → salle équipée → projet/émission référencé → réservation multi-jours, puis déplacement de la cellule vers une autre salle disponible.
9. Se connecter comme Lecteur et Planificateur, vérifier les lectures autorisées et tous les refus de mutation attendus.
10. Redémarrer l'application et confirmer la persistance des ressources, affectations, historiques, statuts et liens de disponibilité.

## 14. Migration RES-02 v3 → v4, compatibilité et rollback

La chaîne et ses identifiants immuables sont exactement :

1. `foundation-01-organization-v2-to-v3` — ORG-01, v2→v3 ;
2. `foundation-02-resources-v3-to-v4` — RES-02, v3→v4 ;
3. `foundation-04-projects-v4-to-v5` — PROJ-04, v4→v5 ;
4. `foundation-03-planning-v5-to-v6` — PLAN-03, v5→v6.

Les numéros intégrés aux identifiants désignent les modules et ne changent pas l'ordre ci-dessus. Aucun alias, réordonnancement, saut ou fusion d'étape n'est autorisé.

La migration Ressources porte l'identifiant immuable `foundation-02-resources-v3-to-v4`. Elle commence exclusivement sur un `schemaVersion: 3` remis par `foundation-01-organization-v2-to-v3` et produit `schemaVersion: 4`. Elle refuse une entrée de version différente, une référence Organisation orpheline ou un handoff ORG-01 sans digest/comptages validés. Elle ne peut être exécutée avant ORG-01.

RES-02 / Backend Resources est l'unique writer de cette étape. Dans une sauvegarde puis une mutation atomique, idempotente et déterministe, il :

1. conserve les identifiants de ressources existants et remplace toute référence de tenant persistée/API par le seul champ canonique `companyId` fourni par ORG-01 ; aucun alias historique n'est persisté ni exposé ;
2. migre chaque ressource vers `category`, `code`, `status`, `siteId`, `organizationUnitId`, `characteristics` et `version`, sans inventer une unité métier ;
3. mappe les sous-catégories de salles vers `editingRoom`, `gradingRoom`, `mixingRoom`, `padRoom`, `laboratoryRoom` ou `otherRoom` ;
4. crée pour les personnes les relations versionnées `personSiteAssignments` et `personOrganizationUnitAssignments`, avec un seul site/unité principal démontrable ;
5. place en `draft` toute ressource dont le rattachement `companyId`/site/unité est démontré mais incomplet, et bloque la migration si le tenant ou le site est orphelin ;
6. ne transforme jamais automatiquement une ressource générique `equipment` en `equipmentAsset` sans référence, numéro de série et correspondance Stock vérifiables ; Stock reste inchangé et writer de ses données ;
7. vérifie les références Stock existantes en lecture, l'unicité des codes et la cohérence des versions, puis calcule les comptages avant/après, la table de correspondance et un digest reproductible ;
8. n'écrit `schemaVersion: 4` qu'après succès de tous les contrôles, de l'audit de migration et du renommage atomique du fichier.

Le handoff signé de `foundation-02-resources-v3-to-v4` vers `foundation-04-projects-v4-to-v5` contient : identifiant de migration, versions d'entrée/sortie, sauvegarde, digest, comptages par `companyId`/catégorie/statut, correspondances d'identifiants, nombre de références Stock validées, liste des brouillons incomplets et preuve d'absence d'orphelin. PROJ-04 refuse l'entrée si `schemaVersion !== 4`, si le digest diverge ou si une ressource active ne satisfait pas le gate R1. PROJ-04 est ensuite l'unique writer Clients/Projets pour le passage v4→v5 ; son handoff aval utilise exclusivement `foundation-03-planning-v5-to-v6`. RES-02 ne modifie plus ses collections pendant ces handoffs.

Rejouer `foundation-02-resources-v3-to-v4` sur la même entrée ou sur sa sortie déjà validée ne crée ni doublon, ni nouvelle relation, ni nouvel audit métier. Les tests couvrent données vierges v3, seed v3, copie RC1 migrée par ORG-01, références incomplètes, référence orpheline, échec avant commit, reprise et digest stable.

Le rollback RES-02 v4→v3 restaure la sauvegarde seulement avant le démarrage de `foundation-04-projects-v4-to-v5` et avant toute écriture utilisateur v4. Après une écriture v4 ou un handoff aval, il exige un export de sécurité, la preuve qu'aucune référence aval ne subsiste et l'autorisation explicite du Product Owner ; aucun rollback silencieux avec perte de ressource, relation humaine ou lien Stock n'est permis.

## 15. Definition of Done du lot

Le lot Ressources 02 est prêt à intégrer lorsque :

- la dépendance Organisation 01 et le parcours séquentiel sont effectivement bloquants côté serveur ;
- le modèle salles/RH/types et les affectations de Parc sont implémentés sans duplication du matériel ;
- les invariants d'isolation, d'unicité, d'historique et de disponibilité sont couverts par tests positifs et négatifs ;
- la volumétrie de 120+ salles et les budgets API/UI sont mesurés ;
- les scénarios E2E obligatoires passent avec persistance après redémarrage ;
- les quatre identifiants immuables de la chaîne sont vérifiés ; `foundation-02-resources-v3-to-v4`, son rollback et son handoff vers `foundation-04-projects-v4-to-v5` sont testés ;
- revue indépendante, QA, sécurité, performance, intégration et E2E portent tous sur le même état candidat et ne laissent aucun P0/P1 ouvert ;
- la documentation de release et `docs/project-status.md` sont mis à jour par l'intégrateur.
