# Sprint 1 V1 — Données métier & fondation analytique

Statut : **SPEC de référence — DEV S1-A en cours, gates indépendants requis avant G1**  
Date : 2026-08-20  
Gate de sortie : **G1 — Données métier fiables**

## 1. Autorité et objectif

Cette spécification traduit sans réordonner l'Ordre de lancement V1 et le Backlog V1. Elle couvre les douze stories affectées au Sprint 1 : `US-007` à `US-016`, `US-081` et `US-082`.

Le Sprint 1 crée les sources de vérité nécessaires aux modules commerciaux, Planning et Finance :

- comptes clients et contacts ;
- projets et cycle de vie canonique ;
- sites et rattachement des ressources ;
- catalogue de prestations ;
- grilles et résolution tarifaires ;
- recherche universelle ;
- dimensions analytiques et définitions auditables du chiffre d'affaires.

Le runtime RC1 reste un monolithe CommonJS avec persistance JSON atomique. Le Sprint 1 ne déclenche ni migration React/TypeScript/SQLite, ni dépendance distante, ni appel réseau à l'exécution.

## 2. Périmètre

### 2.1 Inclus

| Story | Résultat obligatoire |
|---|---|
| US-007 | CRUD et archivage logique Client, contacts, devise, conditions et grille tarifaire ; recherche disponible |
| US-008 | Projet rattaché à un Client avec dates, site, commercial, chef de projet et responsable Planning |
| US-009 | Cycle Projet canonique, transitions historisées et filtres |
| US-010 | Hiérarchie Site → Catégorie → Ressource et consultation multi-site |
| US-011 | Recherche client, projet, devis, ressource, personne et prestation en moins de 300 ms sur le dataset cible |
| US-012 | Catalogue de prestations administrable, planifiable ou non, avec unité et compatibilités |
| US-013 | Tarifs génériques versionnés avec période de validité |
| US-014 | Tarifs Client prioritaires, datés, avec remise ; les documents historiques restent inchangés |
| US-015 | Majorations paramétrables de nuit et de week-end, déterministes |
| US-016 | Détection des lignes sans tarif et blocage de l'envoi/acceptation commerciale finale |
| US-081 | Modèle analytique filtrable sur les neuf dimensions du Backlog |
| US-082 | Définitions formelles et calculs auditables de la chaîne de CA |

### 2.2 Exclus

- construction du noyau Planning performant et virtualisé, réservée au Sprint 2 ;
- transformation automatique d'une prestation en réservation ;
- facture fiscale, paiement, rapprochement bancaire et comptabilité ;
- reconnaissance OCR/IA distante, SaaS, data warehouse ou BI externe ;
- écrans commerciaux lourds hors adaptations nécessaires aux contrats Sprint 1 ;
- invention de données « réalisé », « facturé », « encaissé » quand aucune source métier ne les fournit.

Les Budgets, Devis et réservations déjà présents restent compatibles. Le Sprint 1 stabilise leurs référentiels et leurs lectures analytiques, sans réécrire leurs snapshots historiques.

## 3. Découpage d'implémentation

Le Sprint 1 est livré en quatre incréments séquentiels. Chaque incrément revient à DEV si un gate aval découvre un P0/P1.

1. **S1-A — Référentiels** : Client, Projet, statuts, Site, Catalogue Prestation.
2. **S1-B — Tarification** : grilles, périodes, priorité, remises, majorations, tarif manquant.
3. **S1-C — Recherche** : index local déterministe, périmètres et navigation.
4. **S1-D — Analytics foundation** : dimensions, chaîne de CA, contrôles de réconciliation.

G1 ne peut être `APPROVED` que lorsque les quatre incréments portent sur le même candidat.

## 4. Contrats métier

### 4.1 Client

Le contrat canonique reprend `docs/spec-clients-05.md` et ajoute les champs utiles au Backlog :

```text
Client
  id, companyId, code, name, status
  currency, paymentTermsDays, billingTerms
  billingAddress, email?, phone?, website?
  active, version, createdAt, updatedAt, archivedAt?
```

- `status ∈ {prospect, active, inactive}`.
- `currency` est un code ISO 4217 pris en charge par le profil société ; défaut : devise de la société.
- `paymentTermsDays` est un entier de `0` à `365`.
- La création exige une adresse de facturation structurée (`line1`, `postalCode`, `city`, `country`). Les conditions et le délai peuvent utiliser les valeurs professionnelles par défaut publiées par l'API ; ils sont toujours persistés dans le Client.
- L'archivage est logique. Un Client archivé reste visible dans les Projets, Budgets, Devis, audits et snapshots existants mais n'est plus sélectionnable pour un nouveau Projet.
- Les contacts sont des enfants versionnés `0..n` et restent isolés par société.
- Une grille dédiée active est liée au Client, jamais copiée dans le compte Client.

### 4.2 Projet et cycle de vie

Un Projet exige un Client actif, un Site autorisé et les responsabilités suivantes :

```text
clientId, siteId, salesOwnerId, projectManagerId, planningOwnerId
```

Les identifiants doivent être fournis explicitement et référencer des membres actifs de la même société ; le serveur ne les remplace jamais silencieusement par l'utilisateur courant. `siteId` est également obligatoire à la création. Le cycle canonique est :

```text
prospect -> budget -> quote -> confirmed -> to_plan
         -> partially_planned -> planned -> production -> completed
         -> cancelled
```

Libellés UI : Prospect, Budget, Devis, Confirmé, À planifier, Partiellement planifié, Planifié, En production, Terminé, Annulé.

- `cancelled` et `completed` sont terminaux.
- Toute transition exige `version`, permission `project.manage`, audit `before/after`, `operationId`, origine et événement après commit.
- Une transition non autorisée retourne `409 PROJECT_STATUS_TRANSITION_INVALID`.
- Les anciens statuts RC1 sont migrés vers `lifecycleStatus` selon une table publiée et testée. Le champ historique `status` reste lisible durant la migration mais aucun nouveau write n'accepte un alias legacy.

Table de reprise :

| Statut RC1 | Statut canonique |
|---|---|
| `prospect` | `prospect` |
| `budget_preparation` | `budget` |
| `quote_preparation`, `quote_sent`, `option` | `quote` |
| `confirmed`, `active` | `confirmed` |
| `preparation`, `on_hold` | `to_plan` |
| `planned` | `planned` |
| `production`, `post_production` | `production` |
| `completed`, `archived` | `completed` |
| `cancelled` | `cancelled` |

La migration conserve le statut source dans l'audit de reprise. Elle ne déduit jamais `partially_planned` : cet état est calculé ultérieurement depuis des allocations réelles.

### 4.3 Site, catégorie et ressource

- Une Ressource active possède exactement un `siteId` actif de la même société.
- Une Ressource possède exactement un `resourceCategoryId` actif, de la même société, du même Site et compatible avec son `type`.
- Une Prestation planifiable déclare au moins un type compatible ou une catégorie compatible.
- La lecture multi-site agrège seulement les sites autorisés par la session.
- Aucun `companyId` fourni par le client ne fait autorité.

```text
ResourceCategory
  id, companyId, siteId
  code, name, resourceType
  active, version, createdAt, updatedAt
```

La chaîne canonique est `Site → ResourceCategory → Resource`. Une catégorie n'est jamais partagée implicitement entre deux Sites ; la migration crée une catégorie déterministe par société, Site et type pour chaque ressource historique non classée. Une catégorie inutilisée peut être renommée ou archivée logiquement ; une catégorie référencée par une ressource ou une prestation active ne peut pas être désactivée. Un remplacement de Site remappe atomiquement les ressources, unités et compatibilités de prestations vers des catégories actives équivalentes du Site cible.

### 4.4 Catalogue Prestation

```text
ServiceOffering
  id, companyId, organizationUnitId?
  code, name, category, defaultUnit
  plannable, compatibleResourceTypes[], compatibleResourceCategoryIds[]
  active, version, createdAt, updatedAt, archivedAt?
```

Unités fermées V1 : `heure`, `demi_journee`, `jour`, `semaine`, `mois`, `forfait`, `unite`, `go_mois`, `to_mois`.

- `defaultUnit` appartient à cette liste.
- Une prestation non planifiable peut être vendue mais ne produit jamais d'allocation Planning.
- Une prestation planifiable exige une compatibilité non vide.
- Le prix générique n'est pas stocké sur la Prestation : il provient d'une ligne de tarif catalogue active. Cela évite deux autorités concurrentes.
- L'archivage est logique et ne modifie aucun document commercial historique.

## 5. Tarification

### 5.1 Grilles et lignes de tarif

```text
RateCard
  id, companyId, scope, clientId?, projectId?
  name, currency, active, version, timestamps

Rate
  id, companyId, rateCardId, sourceType, sourceId, unit
  costUnitMinor, saleUnitMinor
  discountBps
  validFrom, validTo?
  surcharges[]
  active, version, timestamps
```

- `scope ∈ {catalog, client, project}`.
- `validFrom` est une date ISO incluse ; `validTo`, si présente, est une date ISO exclue.
- Deux tarifs actifs de même portée, source et unité ne se chevauchent pas.
- Tous les montants sont des chaînes décimales d'entiers en unités mineures.
- `discountBps` est compris entre `0` et `10000`.
- Une mutation de tarif est versionnée et auditée ; un tarif appliqué est figé dans le snapshot du Budget/Devis.

### 5.2 Résolution

Pour une ligne, une date fiscale et une unité données :

1. tarif Projet applicable ;
2. sinon tarif Client applicable ;
3. sinon tarif Catalogue applicable ;
4. sinon résultat structuré `missing`.

À priorité égale, la source directe prévaut sur une famille compatible, puis le tarif au `validFrom` le plus récent. Une ambiguïté résiduelle est une erreur de configuration, jamais un choix silencieux.

Le résultat expose : `rateId`, `rateVersion`, `origin`, `unit`, `baseSaleUnitMinor`, remise, majorations, `resolvedSaleUnitMinor` et date de résolution.

### 5.3 Nuit et week-end

Une majoration est :

```text
{ kind: weekend|night, adjustmentBps, timezone, startsAtLocal?, endsAtLocal? }
```

- `adjustmentBps` est compris entre `-10000` et `100000`.
- Le week-end utilise samedi/dimanche dans le fuseau du Site.
- La nuit utilise une plage locale semi-ouverte, pouvant traverser minuit.
- Les majorations applicables s'additionnent en points de base sur le prix remisé, puis un unique arrondi `half-up` est effectué en unités mineures.
- Une même période et une même règle ne sont appliquées qu'une fois.
- Sans période de prestation connue, aucun supplément temporel n'est inventé ; le tarif de base reste affiché et la ligne est marquée `temporalPricingPending`.

### 5.4 Tarif manquant

- Une ligne sans tarif peut exister dans un brouillon avec `pricingStatus=missing`.
- Le serveur refuse l'action d'envoi ou d'acceptation avec `409 COMMERCIAL_MISSING_RATES` et la liste des `lineIds`.
- Une saisie manuelle exige la permission `quote.overridePrice` et un motif dédié d'au moins trois caractères.
- Le Planning n'est jamais bloqué par l'absence de tarif ; seuls les gates commerciaux finaux le sont.

## 6. Recherche universelle

Route canonique :

```http
GET /api/v1/search?q=...&types=client,project,quote,resource,person,serviceOffering&limit=...
```

- `q` contient de 2 à 160 caractères ; `limit` vaut 20 par défaut, maximum 100.
- La réponse est paginée et chaque résultat contient `type`, `id`, `label`, `secondaryLabel`, `href` et, si applicable, `siteId`/`projectId`.
- L'index est local et reconstruit depuis les collections persistées ; aucun index distant.
- Les contrôles société, site, projet, entité et permissions sont appliqués avant scoring.
- Les contacts n'exposent jamais email ou téléphone dans la recherche universelle.
- Objectif : p95 `< 300 ms` sur le dataset G1.

## 7. Modèle analytique et chaîne de CA

### 7.1 Dimensions

Toute ligne analytique porte les dimensions disponibles parmi :

```text
date, clientId, projectId, serviceOfferingId,
resourceId, siteId, legalEntityId, salesOwnerId, userId
```

Une dimension inconnue est `null`, jamais un libellé inventé. Les agrégats appliquent les mêmes scopes que les lectures sources.

### 7.2 Mesures canoniques

| Étape | Source V1 | Règle |
|---|---|---|
| `budgeted` | dernière version active d'un Budget | montant HT du snapshot, sans contribution au CA signé |
| `quoted` | dernière version active d'un Devis non remplacé | montant HT du snapshot |
| `signed` | Devis accepté avec reconnaissance active | montant HT immuable de la version acceptée |
| `planned` | réservation liée à une ligne signée | valeur commerciale allouée, disponible au Sprint 2 |
| `actual` | aucune source Sprint 1 | `unavailable`, jamais zéro implicite |
| `billable` | aucune source Sprint 1 | `unavailable` |
| `invoiced` | aucune source Sprint 1 | `unavailable` |
| `collected` | aucune source Sprint 1 | `unavailable` |

Le chiffre d'affaires reconnu dans G1 correspond exclusivement à `signed`. Les autres étapes restent des mesures distinctes. Les montants HT, TVA et TTC du Devis accepté restent consultables ; les agrégats de CA utilisent HT et groupent par devise, sans conversion implicite.

### 7.3 API analytique

```http
GET /api/v1/analytics/revenue-chain?from=YYYY-MM-DD&to=YYYY-MM-DD&dimensions=...
GET /api/v1/analytics/dimensions
```

La réponse fournit : période, devise, étapes, valeur, disponibilité, filtres appliqués, `sourceCount`, `generatedAt` et `definitionVersion`.

Chaque total doit se réconcilier avec ses identifiants sources. Les remplacements de Devis désactivent la reconnaissance précédente sans supprimer son historique.

## 8. API, RBAC, isolation, audit et SSE

| Domaine | Lecture | Mutation |
|---|---|---|
| Clients/contacts | membres autorisés et scopes entité | `client.manage` |
| Projets | `project.read` ou permission existante équivalente | `project.manage` |
| Prestations | `resource.read`/`quote.read` selon usage | `serviceOffering.manage` |
| Tarifs | `quote.read` avec masquage des coûts si nécessaire | `quote.manage`; override manuel séparé |
| Recherche | permission de chaque objet | aucune |
| Analytics CA | permission Finance/analytics dédiée ou administrateur | aucune dans Sprint 1 |

Toute mutation exige : validation, scope, `version` si document existant, `Idempotency-Key` si sensible, écriture atomique, audit canonique `before/after`, événement après commit. Les familles SSE inconnues échouent fermées.

## 9. Migration et rollback

La migration additive Sprint 1 :

1. sauvegarde byte-exacte du JSON avant mutation ;
2. ajoute uniquement les champs/collections absents ;
3. migre les statuts Projet selon la table de la section 4.2 ;
4. ajoute dates de validité ouvertes aux tarifs historiques (`validFrom` = date de création ou baseline documentée, `validTo=null`) ;
5. ne réécrit aucun snapshot Budget/Devis accepté ;
6. persiste marqueur, digests, compteurs et version de politique ;
7. refuse un rejeu si marqueur, backup ou projection divergent.

Les marqueurs sont appliqués dans l'ordre : `sprint-1-referentials-v1`, `sprint-1-pricing-v1`, `sprint-1-analytics-v1`, puis `sprint-1-contracts-v2`. Ce dernier backfille les champs Client canoniques, les trois responsabilités Projet, les catégories de ressources et les périmètres de grilles/tarifs sans réécrire les snapshots commerciaux. Au rejeu, son `outputDigest` reste une preuve immuable de la sortie initiale protégée par `integrityDigest` ; il n'est pas recalculé depuis les valeurs métier courantes. La relecture contrôle plutôt les invariants structurels canoniques, afin qu'une modification légitime d'adresse, de conditions de paiement, de responsable ou de tarif ne rende jamais la base indisponible.

Le rollback valide la présence des quatre marqueurs, les backups byte-exacts et leurs digests, exige un export de reprise en mode `0600`, puis restaure les octets source de la première migration Sprint 1. Sans chemin d'export explicite, il échoue avec `ROLLBACK_EXPORT_REQUIRED`; si un marqueur manque, il échoue avant toute création d'export ou restauration. Aucun paramètre `allowDataLoss` ne contourne cette règle. La commande locale exacte, basée sur `rollbackSprint1Migrations({ exportFile })`, est documentée dans `README.md` ; aucun script npm implicite n'est revendiqué.

## 10. Critères d'acceptation et tests

### Référentiels

1. créer, modifier, rechercher et archiver logiquement un Client ; conserver ses documents historiques ;
2. créer un Projet complet et refuser Client/Site/responsables étrangers ou inactifs ;
3. autoriser uniquement les transitions Projet publiées et les auditer ;
4. filtrer ressources et résultats par Site autorisé ;
5. créer/modifier/archiver une Prestation planifiable et une non planifiable.

### Tarification

6. résoudre Projet > Client > Catalogue à date et unité identiques ;
7. refuser les périodes de tarifs qui se chevauchent ;
8. conserver le prix d'un Devis historique après changement de grille ;
9. calculer nuit/week-end, y compris passage de minuit et changement d'heure ;
10. bloquer envoi/acceptation si une ligne est sans tarif et autoriser un override motivé.

### Recherche et Analytics

11. rechercher les six familles en respectant tenant/site/projet/entité et sans fuite de contact ;
12. p95 recherche `< 300 ms` sur le dataset G1 ;
13. filtrer les neuf dimensions analytiques ;
14. réconcilier `budgeted`, `quoted` et `signed` avec les snapshots sources ;
15. exposer `actual/billable/invoiced/collected` comme indisponibles tant que leurs sources n'existent pas ;
16. remplacer un Devis accepté sans double comptage et sans modifier l'historique.

### Non-régression

17. `node --check server.js`, `node --check app.js`, tests ciblés et `npm test` verts ;
18. auth, CSRF, Origin, RBAC, isolation, scopes, audit, SSE et idempotence G0 restent verts ;
19. aucune dépendance réseau ni donnée sensible ajoutée ;
20. REVIEW, QA, SECURITY et PERFORMANCE indépendants portent sur le même candidat avant G1.

## 11. Preuves G1

Le gate G1 exige :

- zéro P0/P1 ouvert ;
- suite complète verte sur état déterministe ;
- benchmark recherche et routes affectées ;
- E2E navigateur Client → Projet → Prestation → Tarif → recherche → lecture analytique ;
- preuve de persistance après rechargement/redémarrage ;
- documentation OpenAPI, migration/rollback et `docs/project-status.md` à jour.

Tant que ces conditions ne sont pas réunies, le Sprint 2 reste bloqué.
