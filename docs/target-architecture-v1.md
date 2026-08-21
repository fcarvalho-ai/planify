# Architecture cible v1 — Planning Post Prod

Statut : cible directrice, non implémentée intégralement  
Date : 2026-08-14  
Source : synoptique d’architecture validé par le Product Owner  
Socle actuel : `0.1.0-rc1`, monolithe Node.js/CommonJS, API JSON + SSE, persistance atomique JSON

## 1. Portée et règle de lecture

Ce document traduit le synoptique validé en architecture cible. Il décrit les capacités, leurs responsabilités et leurs contrats sans autoriser une migration implicite de la RC1.

La distinction d’autorité est la suivante :

- **autorité runtime actuelle** : le comportement effectivement livré par `server.js`, `app.js` et `data/planify.json`, sous réserve des règles de `docs/spec-mvp.md` et des contrats RC1 de `docs/architecture.md` ;
- **autorité de migration** : la SPEC approuvée de chaque lot, ses migrations, tests et gates ; elle seule peut remplacer une partie de l’autorité runtime RC1 ;
- **direction cible** : le présent document ; il guide les frontières et dépendances futures, mais n’est ni une description du code courant ni une autorisation de bascule.

En cas d’écart avant migration approuvée, la RC1 reste exécutée et l’écart est consigné ; après un lot approuvé et intégré, l’autorité runtime se déplace uniquement pour le périmètre explicitement basculé.

La cible est un **monolithe modulaire extractible**. Les modules sont isolés par des contrats applicatifs et des ports ; ils restent, par défaut, livrés ensemble. Un passage en service indépendant n’est envisagé qu’après mesure d’un besoin d’isolation, de charge, de disponibilité ou de cadence de livraison. L’architecture doit rester exécutable localement, reproductible et sans dépendance réseau obligatoire.

Principes directeurs :

- API first, avec contrats versionnés et erreurs stables ;
- multi-société et multi-site appliqué à chaque cas d’usage et chaque accès aux données ;
- sécurité par défaut, moindre privilège et traçabilité des mutations ;
- dépendances orientées vers le domaine : adaptateurs → application → domaine ;
- cohérence forte dans un agrégat, événements après commit pour les projections ;
- modularité avant distribution ; cache, bus et haute disponibilité ajoutés sur preuves ;
- compatibilité ascendante et rollback vérifié à chaque étape.

## 2. Vue logique cible

```text
Web App / futur client mobile / clients API / assistants autorisés
                              │
                  API Gateway / entrée unique
       routage, versioning, limites, requestId, observabilité
                              │
             Authentification & autorisation
       session/OIDC, MFA différée, RBAC/ABAC, périmètre tenant
                              │
┌─────────────────────────────────────────────────────────────┐
│ Monolithe modulaire                                         │
│ 01 Organisation     06 Location matériel  11 Prévision      │
│ 02 Ressources       07 Stock/logistique   12 IA/assistant   │
│ 03 Planning         08 Commercial         13 Notifications  │
│ 04 Projets          09 Finance            14 Reporting      │
│ 05 Équipes          10 Dashboard          15 Intégrations   │
└─────────────────────────────────────────────────────────────┘
                              │
 Services transverses : fichiers, règles, audit, recherche,
 notifications, exports, paramétrage, événements internes
                              │
 Repositories et unités de travail / outbox transactionnelle
                              │
 Base relationnelle principale ─ objets ─ cache ─ warehouse optionnel
```

L’API Gateway est d’abord une responsabilité du processus Node (middleware de composition), pas un produit réseau séparé. De même, le cache, le stockage objet, le warehouse, Kubernetes, GraphQL et l’IA sont des capacités conditionnelles, pas des prérequis de la première migration.

## 3. Catalogue des modules métier 01–15

Chaque module possède son modèle, ses cas d’usage, ses permissions, ses repositories et ses événements. Il ne lit ni n’écrit les données privées d’un autre module. Les identifiants échangés sont opaques ; une référence intermodule n’accorde jamais l’autorisation d’accès.

| N° | Module | Responsabilités cibles | Contrats fournis | Dépendances autorisées | État RC1 / priorité |
|---|---|---|---|---|---|
| 01 | Organisation & socle | sociétés, sites, départements, utilisateurs, rôles, permissions et paramètres de tenant | contexte d’identité et de périmètre, catalogue sites, permissions | Auth, audit, paramétrage | Partiel et prioritaire : sociétés/sites/utilisateurs/RBAC existent |
| 02 | Ressources | salles, stations, équipements, licences, capacités, statuts, indisponibilités et maintenance | catalogue de ressources, disponibilité structurelle, événements de ressource | 01 ; règles transverses | Partiel et prioritaire : ressources/capacité existent |
| 03 | Planning | calendriers, réservations, allocations multi-ressources, statuts, conflits, override, vues et disponibilités calculées | commandes de réservation, lecture par fenêtre, contrôle de conflit, événements versionnés | **01, 02 et 04 obligatoires**, audit | Cœur RC1 ; migration après 01 → 02 → 04 |
| 04 | Clients, projets & workflow | **autorité unique des clients et projets**, saisons/épisodes, phases, tâches, jalons, budgets et documents de projet | référentiel client/projet actif, structure de travail, jalons | 01 ; fichiers/règles ; 05 et 09 par contrats | Clients/projets simples en RC1 ; workflow différé |
| 05 | Équipes & compétences | collaborateurs, équipes, compétences, disponibilités, tarifs/coûts, contrats et charge de travail | profils affectables, compétences, capacité humaine | 01 ; 03 pour allocations ; 09 pour coûts | Nouveau ; modèle produit à valider |
| 06 | Location matériel | parc locatif, numéros de série, réservations, tarifs/retours, maintenance, assurance et amortissement | disponibilité locative, réservation de matériel, état de retour | 01, 02, 03, 04, **07a socle stock**, 09a | Nouveau ; après consolidation ressources/planning et 07a |
| 07 | Stock & logistique | articles, stocks, kits, mouvements, transferts, inventaires et codes-barres/QR | stock disponible, commandes de mouvement, traçabilité | 01, 02, 04 ; audit | Nouveau ; **07a socle stock précède 06a Location**, fonctions logistiques avancées ensuite |
| 08 | Commercial & options | demandes, devis, options, probabilités et transformation en projet confirmé ; **owner et writer des Devis et de leur snapshot fiscal** | pipeline commercial, devis, option projet/planning | 01 via `CompanyFiscalProfilePort.v1`, 03, 04, 09a pour valorisation interne non fiscale | Nouveau ; règles d’option et Devis à spécifier |
| 09 | Finance & rentabilité | coûts, revenus, marge, facturation, paiements et rentabilité ; **09a ne possède ni fiscalité, ni taux TVA, ni snapshot de Devis** | écritures métier, synthèses financières, statut de facturation | 01, 04, 05, 06, 08 ; exports | Nouveau ; premier incrément **09a Finance 0.2 non fiscal**, droits séparés et audit renforcé |
| 10 | Dashboard & analytics | KPI opérationnels, occupation, tableaux de bord, heatmaps et tendances | projections de lecture, navigation vers sources | événements/contrats de tous modules autorisés | Occupation RC1 ; premier incrément cible **10a Analytics**, puis généralisation |
| 11 | Prévision & capacité | prévisions de charge, scénarios, besoins de capacité et alertes anticipées | scénarios versionnés, prévisions explicables | 02, 03, 04, 05, 08, 10 | Nouveau ; dépend d’un historique fiable |
| 12 | IA & assistant | aide conversationnelle, recherche assistée, synthèses et recommandations sous contrôle humain | outils bornés, propositions non exécutées par défaut, provenance | recherche, contrats de lecture, 15 pour fournisseur éventuel | Nouveau ; opt-in, jamais requis au runtime local |
| 13 | Notifications & alertes | règles d’alerte, préférences, modèles, inbox, email/SMS/Teams/Slack optionnels | commande de notification, état de livraison, événements | événements métiers, 15 ; paramétrage | Nouveau ; inbox locale avant connecteurs externes |
| 14 | Reporting | rapports opérationnels/financiers, planification et exports PDF/Excel/CSV | requêtes de rapport, artefacts exportables | projections, fichiers, 09 selon droits | Nouveau ; lecture seule sur projections |
| 15 | Intégrations & API | REST, webhooks, imports/exports, connecteurs dédiés, synchronisation et gestion des erreurs | API publique versionnée, abonnements webhook, jobs d’import | contrats publics des modules ; audit/fichiers | Nouveau ; REST interne actuel constitue le point de départ |

### Règles de dépendance

1. Les modules 01–09 sont autorités de leurs écritures. Les modules 10, 11 et 14 consomment des contrats de lecture ou des projections et ne modifient pas les tables source.
2. L’ordre de fondation est obligatoire : **01 Organisation → 02 Ressources → 04 Clients/Projets → 03 Planning**. Le module 04 est l’unique owner de `clientId` et `projectId` ; le module 01 ne conserve aucun doublon client.
3. Dans la cible, toute réservation active référence exactement un `projectId` valide et au moins un `resourceId`. Le planning ne réplique pas les règles de projet ou de ressource et valide leur état par les ports contractuels. La RC1 autorise encore un projet absent : **`foundation-03-planning-v5-to-v6` applique obligatoirement la décision de reprise ci-dessous** avant le handoff du writer Planning ; aucune autre stratégie n’est conforme.
4. Les intégrations ne contournent jamais les cas d’usage : un import, webhook ou assistant appelle les mêmes commandes autorisées que l’interface.
5. La finance et les données personnelles d’équipes sont des périmètres sensibles avec permissions dédiées, journalisation et vues minimales.
6. Une dépendance circulaire est remplacée par un contrat, un événement après commit ou une orchestration applicative explicite.

### Décision normative — réservations RC1 sans `projectId`

La reprise utilise une seule stratégie : le module 04 crée un **Projet technique de reprise explicite par couple `companyId`/`siteId`**, puis `foundation-03-planning-v5-to-v6` rattache à ce Projet chaque réservation legacy du même périmètre dont `projectId` est absent.

DTO canonique du Client technique, unique par `companyId` :

```json
{
  "id": "opaque-id",
  "companyId": "opaque-company-id",
  "name": "Reprise RC1",
  "code": "MIGRATION-RC1",
  "active": true,
  "systemManaged": true,
  "migrationPurpose": "rc1_project_backfill",
  "version": 1,
  "createdAt": "UTC-ISO-8601",
  "updatedAt": "UTC-ISO-8601"
}
```

DTO canonique du Projet technique, unique par couple `companyId`/`siteId` :

```json
{
  "id": "opaque-id",
  "companyId": "opaque-company-id",
  "siteId": "opaque-site-id",
  "clientId": "opaque-recovery-client-id",
  "name": "Reprise RC1 — <siteId>",
  "code": "MIGRATION-RC1-<siteId>",
  "status": "active",
  "color": "#64748B",
  "systemManaged": true,
  "migrationPurpose": "rc1_project_backfill",
  "version": 1,
  "createdAt": "UTC-ISO-8601",
  "updatedAt": "UTC-ISO-8601"
}
```

Les valeurs entre chevrons sont remplacées par l’identifiant opaque exact, sans transformation. Les codes réservés sont uniques dans leur périmètre. Aucun champ supplémentaire de périmètre (`scopeSiteId`, `organizationId`, `tenantId`) n’est admis dans ces DTO.

Création et rattachement produisent exactement les contrats suivants ; `details` désigne le contenu de l’audit append-only et `payload` celui de l’événement après commit :

| Opération | Audit (`action`, `entityType`, `entityId`) | Événement | Champs exacts de `details` et `payload` |
|---|---|---|---|
| création Client technique | `client.recovery.created`, `client`, `clientId` | `client.recovery.created.v1` | `migrationId: "foundation-04-projects-v4-to-v5"`, `companyId`, `clientId`, `code: "MIGRATION-RC1"` |
| création Projet technique | `project.recovery.created`, `project`, `projectId` | `project.recovery.created.v1` | `migrationId: "foundation-04-projects-v4-to-v5"`, `companyId`, `siteId`, `clientId`, `projectId`, `code: "MIGRATION-RC1-<siteId>"` |
| rattachement réservation | `reservation.project.backfilled`, `reservation`, `reservationId` | `reservation.project.backfilled.v1` | `migrationId: "foundation-03-planning-v5-to-v6"`, `companyId`, `siteId`, `reservationId`, `previousProjectId: null`, `projectId` |

L’enveloppe d’événement ajoute uniquement les champs canoniques de la section 4.5. L’audit ajoute uniquement son enveloppe commune (identifiant, acteur technique de migration, instant et `requestId`) ; les contenus `details`/`payload` ci-dessus ne reçoivent aucun alias.

Le Projet et le Client techniques sont de vraies entités 04, actives, visibles aux administrateurs et immuables hors procédure de migration. Le Projet reste explicitement identifiable jusqu’à réaffectation métier des réservations ; il n’est ni masqué ni converti en absence de Projet.

Il est interdit de persister un champ, statut, pseudo-identifiant ou fallback `legacyUnassigned`. Après `foundation-03-planning-v5-to-v6`, `projectId` est non nul ; le Projet technique est l’unique représentation durable de la reprise. Le couple Projet/site est validé : une réservation ne peut recevoir que le Projet technique correspondant exactement à son `companyId` et son `siteId`.

L’adaptateur `/api/v1` peut, pendant sa fenêtre de dépréciation, convertir l’omission d’un projet en référence explicite vers le Projet technique du site et retourner ce `projectId`. Les commandes internes et les nouveaux contrats refusent l’omission ; aucun autre fallback n’est autorisé.

Cette décision est appliquée uniquement après la chaîne complète **`foundation-01-organization-v2-to-v3` → `foundation-01b-organization-fiscal-v3` → `foundation-02-resources-v3-to-v4` → `foundation-04-projects-v4-to-v5` → `foundation-03-planning-v5-to-v6`**. Les quatre identifiants historiques restent immuables ; `foundation-01b-organization-fiscal-v3` est un marker additif distinct, lui aussi immuable, qui conserve `schemaVersion=3`. Aucun identifiant ne possède d’alias court. `foundation-04-projects-v4-to-v5` crée les entités techniques ; `foundation-03-planning-v5-to-v6` effectue les rattachements et active la contrainte `projectId` obligatoire.

Le marker `foundation-01b-organization-fiscal-v3` exige `schemaVersion=3` et la présence conforme de `foundation-01-organization-v2-to-v3`; il doit être absent avant sa première application et aucun marker Ressources ou aval ne peut déjà exister. Il ajoute profils fiscaux/monétaires, taux et policies versionnées, inscrit son identifiant une seule fois dans `migrations[]`, conserve les identifiants et collections existants, conserve `schemaVersion=3`, puis publie digest, comptages, anomalies et `CompanyFiscalProfilePort.v1`. Chaque profil effectivement converti écrit l’audit masqué `company.fiscalProfile.migrated` avec `migrationId: "foundation-01b-organization-fiscal-v3"`; le migrateur hors ligne n’émet aucun SSE. Un rejeu conforme ne produit aucune écriture, aucun audit et aucun événement ; une divergence bloque la chaîne. `foundation-02-resources-v3-to-v4` refuse de démarrer sans ce marker.

### Incréments initiaux nommés

Les suffixes identifient une tranche livrable d’un module, pas un nouveau bounded context :

- **07a — Socle stock** : articles sérialisables/non sérialisables, emplacements, quantité disponible, mouvement atomique et audit. Ce socle est livré avant **06a** afin que Location ne crée pas un second inventaire. Les fonctions 07 avancées (kits, transferts, inventaires et codes-barres) peuvent suivre 06a.
- **06a — Location matériel** : réservation, sortie et retour d’un article/parc existant ; dépend de 07a pour l’état physique et du module 03 pour la période.
- **09a — Finance 0.2** : coûts/revenus rattachés aux projets et locations, marge opérationnelle et exports ; la facturation, les paiements et la comptabilité complète restent dans les incréments ultérieurs du module 09.
- **10a — Analytics** : projections d’occupation, activité, revenus/coûts autorisés et navigation vers les sources ; il étend le dashboard d’occupation RC1 sans créer de seconde autorité transactionnelle.

Les numéros 09a et 10a positionnent les premiers lots Finance et Analytics de la trajectoire `0.2` ; ils ne changent ni la version RC1 actuelle ni les numéros fonctionnels 09 et 10 du synoptique.

## 4. Contrats et frontières

### 4.0 Glossaire canonique

| Terme | Sens contractuel |
|---|---|
| Organisation | terme métier et libellé UI pour la société cliente de la plateforme |
| `companyId` / `company_id` | identifiant canonique unique de l’Organisation, respectivement dans les DTO/API/événements et en persistance |
| Tenant | propriété d’isolation portée par `companyId`, pas une entité ou un identifiant supplémentaire |
| Client | donneur d’ordre commercial appartenant à une Organisation ; données et identifiants possédés exclusivement par le module 04 |
| Projet | contexte de production appartenant à un Client ; `projectId` est obligatoire pour toute réservation cible active ; la reprise RC1 utilise le Projet technique normatif par `companyId`/`siteId` |
| Ressource | capacité planifiable possédée par 02 : salle, station, équipement, licence, personne ou autre |
| Article de stock | unité ou quantité physique possédée par 07 ; son `stockItemId` reste distinct d’un éventuel `resourceId` planifiable |
| Allocation planning | engagement temporel possédé par 03 ; elle ne modifie ni la définition d’une Ressource ni le mouvement physique de Stock |

Les documents peuvent employer « organisation » ou « tenant » en prose. Les DTO, API et événements emploient exclusivement `companyId` ; la persistance emploie exclusivement `company_id`. `organizationId`, `organisationId`, `tenantId`, `organization_id`, `organisation_id` et `tenant_id` sont interdits. Une requête contenant `organizationId`, seul ou avec `companyId`, est rejetée en `400 VALIDATION_ERROR` avec `details: { "field": "organizationId", "reason": "FIELD_NOT_ALLOWED" }`. Aucun alias n’est normalisé silencieusement.

### 4.1 Contrats HTTP

Les contrats RC1 `/api/v1` restent compatibles durant la migration. La convention demeure : JSON UTF-8, `camelCase`, dates ISO 8601 avec offset à l’entrée, UTC en persistance, pagination structurée et erreur `{ error: { code, message, details?, requestId } }`.

Toute évolution suit l’une des stratégies suivantes :

- ajout rétrocompatible dans `/api/v1` ;
- nouvelle représentation ou sémantique dans `/api/v2` avec période de coexistence ;
- adaptateur de compatibilité v1 vers le nouveau cas d’usage ;
- dépréciation documentée avec métrique d’usage, date et rollback.

Chaque mutation transporte : contexte de session, permission requise, périmètre organisation/site, clé d’idempotence si rejouable, `version` si concurrence possible et `requestId`. Le `companyId` canonique provient toujours de la session ; il est ignoré ou refusé comme autorité lorsqu’il est fourni par le client.

### 4.2 Contrats applicatifs

Les interfaces applicatives sont séparées en :

- **commands** : une intention métier, validation complète, résultat canonique ou erreur stable ;
- **queries** : lecture bornée, filtrée et paginée, sans effet de bord ;
- **ports** : horloge, identifiants, repositories, transactions, stockage fichiers, messagerie et fournisseurs externes ;
- **policies** : autorisation, capacité, transition d’état et règles configurables ;
- **events** : faits immuables, versionnés, émis après commit.

Les DTO publics ne sont pas les entités de persistance. Un contrat partagé contient uniquement les schémas et codes d’erreur nécessaires aux consommateurs.

### 4.3 Ports Stock ↔ Ressources ↔ Planning

Ces noms désignent des interfaces applicatives versionnées, non des accès aux repositories d’autrui :

| Port fourni par | Opérations contractuelles minimales | Consommateurs | Autorité préservée |
|---|---|---|---|
| 02 `ResourceCatalogPort.v1` | `resolveAssignable(resourceIds, companyId, siteId)` → identités, type, état, capacité planifiable et versions | 03, 07, 06 | 02 décide si une Ressource existe, est active et planifiable |
| 04 `ProjectCatalogPort.v1` | `resolveActiveProject(projectId, companyId)` → client, projet, état et version | 03, 06, 08, 09 | 04 décide de l’existence/activité du Client et du Projet |
| 07 `StockAvailabilityPort.v1` | `check`, `allocate`, `release` avec `stockItemId`, quantité, fenêtre éventuelle, version et clé d’idempotence | orchestrateur de 03/06 | 07 décide de la quantité et de l’état physique ; aucune écriture directe depuis 02/03 |
| 03 `PlanningAllocationPort.v1` | `checkWindow`, `reserve`, `reschedule`, `cancel` avec `projectId` obligatoire, ressources, fenêtre, version et politique de conflit | 06, 08 et orchestrateurs applicatifs | 03 décide des allocations temporelles et conflits |

Un `stockItemId` peut référencer un `resourceId` externe pour signaler qu’un article est planifiable ; ce lien appartient à 07, est validé via `ResourceCatalogPort.v1` et n’entraîne pas une fusion d’identités. Une Ressource peut ne pas être stockée et un article peut ne pas être planifiable.

Une opération combinant stock et planning est composée par un cas d’usage d’orchestration explicite. Dans le monolithe/base partagée, `StockAvailabilityPort.allocate` et `PlanningAllocationPort.reserve` participent à la même unité de travail ; aucune disponibilité n’est confirmée avant commit. Après distribution éventuelle, une saga versionnée avec compensation remplace cette transaction. Les événements ne servent jamais à contourner un contrôle synchrone de capacité.

### 4.4 `CompanyFiscalProfilePort.v1` et frontière Devis

Le module 01 possède le profil fiscal/monétaire et publie `CompanyFiscalProfilePort.v1`. Le module **Commercial 08 est l’unique owner/writer des Devis** et appelle :

```text
snapshotForQuote(
  { companyId, siteId?, taxDate, requestedVatRateId? },
  authContext
) -> CompanyFiscalSnapshot
```

`taxDate` est une date civile `YYYY-MM-DD`. Le serveur résout `taxTimezone` depuis le fuseau IANA du `siteId` autorisé ou, sans site, depuis `defaultTimezone`; le navigateur ne le fournit jamais. `requestedVatRateId` absent sélectionne `defaultVatRateId`; présent, il exige `quote.overrideVatRate`, le même `companyId` et une période applicable.

Le résultat exact est :

```text
CompanyFiscalSnapshot = {
  companyId,
  fiscalProfileVersion,
  legalName,
  tradeName?,
  registeredOfficeAddress: {
    line1, line2?, postalCode, city, region?, country
  },
  taxCountry,
  taxIdentifiers: [{ type, country, value, policyVersion }],
  vatStatus,
  currency,
  currencyExponent,
  currencyPolicyVersion,
  taxDate,
  taxTimezone,
  vatRate: {
    id, code, label, rateBps, validFrom, validTo?, version
  },
  capturedAt
}
```

Déterminisme résumé : pour les mêmes données versionnées, `companyId`, `siteId`, `taxDate`, `requestedVatRateId` et policies, tous les champs métier du snapshot sont identiques. L’adresse est le siège principal validé. `taxIdentifiers` ne contient que les types exigés, ordonnés `businessRegistration`, `establishment`, `vat`, `taxNumber`, `other`. Le taux est celui applicable à `taxDate` dans `taxTimezone`; les égalités de borne suivent `[validFrom, validTo)`. Seul `capturedAt`, fixé une fois par l’horloge serveur lors de la création/révision du Devis, varie entre deux captures. Commercial 08 persiste le snapshot complet et immuable ; une évolution ultérieure du profil/taux ne réécrit jamais un Devis, et une révision crée un nouveau snapshot.

Le premier contrat Devis utilise un taux unique au niveau document. **Finance 09a est non fiscal** : il peut consommer les montants et faits commerciaux autorisés pour coûts, revenus et marges, mais ne choisit ni taux, ne calcule la fiscalité du Devis, n’appelle ce port comme writer et ne possède/modifie jamais `CompanyFiscalSnapshot`. Les erreurs contractuelles du port sont `FISCAL_PROFILE_INCOMPLETE`, `VAT_RATE_NOT_APPLICABLE` et `CURRENCY_NOT_SUPPORTED`.

### 4.5 Événements

Enveloppe minimale :

```json
{
  "eventId": "opaque-id",
  "eventType": "reservation.updated.v1",
  "occurredAt": "2026-08-14T09:00:00Z",
  "companyId": "opaque-id",
  "siteId": "opaque-id",
  "entityId": "opaque-id",
  "entityVersion": 2,
  "correlationId": "opaque-id"
}
```

Dans le monolithe, un dispatcher mémoire suffit pour les invalidations SSE. Quand des projections ou connecteurs deviennent durables, une **outbox transactionnelle** précède tout bus externe. Les consommateurs sont idempotents, ordonnent par entité/version et tolèrent la livraison au moins une fois. Aucun événement ne contient secret ni contenu libre sensible.

### 4.6 Invariants transverses

- intervalles de planning semi-ouverts `[début, fin)` ;
- `option` et `confirmed` consomment la capacité, `cancelled` ne la consomme pas ;
- réservation active avec un `projectId` valide et au moins une ressource du même `companyId`/site ;
- concurrence optimiste par `version` ;
- override avec permission, motif obligatoire et audit ;
- annulation/désactivation logique par défaut ;
- audit et émission d’événement seulement après mutation réussie ;
- fuseau IANA pour l’interprétation locale, instant UTC pour la persistance.

### 4.7 Permissions canoniques d’override

Les deux permissions sont indépendantes et non substituables :

| Situation outrepassée | Permission exacte | Admin | Planificateur | Lecteur | Commande et motif | Audit exact |
|---|---|---:|---:|---:|---|---|
| dépassement de capacité ou conflit entre réservations | `planning.override_conflict` | Oui | Oui | Non | `conflictPolicy: "override"` et `overrideReason` non vide | `reservation.conflict.overridden` |
| calendrier d’indisponibilité d’une ressource | `planning.override_unavailability` | Oui | Non | Non | `unavailabilityPolicy: "override"` et `unavailabilityOverrideReason` non vide | `reservation.unavailability.overridden` |

Sans override autorisé, les erreurs restent respectivement `409 PLANNING_CONFLICT` et `409 RESOURCE_UNAVAILABLE`. Si les deux situations existent, la commande exige les deux permissions, les deux politiques et les deux motifs ; un seul droit ou motif ne permet pas l’écriture. Chaque audit contient `companyId`, `siteId`, `reservationId`, `resourceIds`, acteur, instant, motif correspondant et `requestId`. Le frontend peut masquer l’action, mais le serveur réévalue chaque permission et le périmètre.

## 5. Services transverses

| Service | Responsabilité | Première implémentation | Condition d’évolution |
|---|---|---|---|
| Gestion des fichiers | documents et médias, métadonnées, contrôle d’accès, antivirus éventuel | répertoire local hors statique, noms opaques | stockage objet S3-compatible si volumétrie/HA le justifie |
| Moteur de règles | règles répétitives, validations et workflows configurables | fonctions de domaine versionnées | DSL seulement avec besoins récurrents validés |
| Notifications | inbox et orchestration des canaux | file locale/outbox + SSE | workers/connecteurs si livraison externe activée |
| Audit & logs | historique métier immuable et logs techniques corrélés | store principal append-only + logs JSON | stockage séparé selon rétention/volume |
| Recherche globale | indexation autorisée par tenant et type | recherche SQL bornée | moteur dédié après mesure de pertinence/charge |
| Exports | PDF, Excel, CSV et exports API | génération locale synchrone bornée | jobs asynchrones + stockage objet pour gros volumes |
| Paramétrage | champs, catalogues et réglages système | configuration typée et versionnée | moteur de schéma après validation des cas avancés |
| Identité/temps | requestId, clock, UUID, contexte tenant | ports internes centralisés | services distribués uniquement après extraction |

Un service transverse n’est pas un accès universel aux données. Il reçoit une commande bornée et un contexte d’autorisation ou travaille sur une projection explicitement publiée.

## 6. Couche de données

### 6.1 Cible par paliers

1. **RC1** : `data/planify.json`, écriture atomique, mono-processus.
2. **Palier relationnel local** : SQLite en mode WAL, contraintes, migrations versionnées, transactions courtes et seed déterministe.
3. **Palier multi-instance conditionnel** : PostgreSQL, verrouillage/concurrence adaptés, sessions et événements externalisés.
4. **Paliers spécialisés optionnels** : cache Redis, stockage objet S3-compatible, warehouse analytique.

Le passage d’un palier au suivant nécessite une spécification, une mesure et un rollback ; il n’est pas impliqué par ce document.

### 6.2 Propriété et isolation

Chaque table métier possède un module propriétaire et porte `company_id`; `site_id` est présent lorsque le périmètre site s’applique. Les repositories injectent le tenant depuis le contexte de session et interdisent toute requête non bornée. Les contraintes relationnelles renforcent, sans remplacer, les contrôles applicatifs.

Les écritures couvrant plusieurs agrégats sont orchestrées dans une transaction locale tant que les modules partagent la base. Après éventuelle distribution, elles deviennent saga explicite avec compensation ; aucune transaction distribuée implicite.

### 6.3 Cache, objets et analytics

- Le cache ne fait jamais autorité ; clés préfixées par tenant, TTL borné et invalidation après commit.
- Les sessions peuvent rester en mémoire/SQLite en mono-instance. Redis n’est requis qu’avant multi-instance.
- Les objets sont référencés par identifiant opaque et téléchargés après contrôle d’accès ; aucun chemin utilisateur direct.
- Le warehouse est alimenté par événements/projections pseudonymisés ; il n’est jamais interrogé pour une décision transactionnelle.

## 7. Sécurité et identité

Le point d’entrée applique request ID, taille maximale, validation de contenu, contrôle d’origine, CSRF, rate limiting ciblé, headers de sécurité et versioning. L’authentification locale RC1 reste disponible ; OIDC/SSO, MFA et Active Directory sont des adaptateurs ultérieurs, non des dépendances du domaine.

Le modèle d’autorisation combine :

- RBAC pour le catalogue de permissions ;
- attributs de session pour `companyId`, sites autorisés et contraintes sensibles ;
- contrôle d’objet dans chaque cas d’usage ;
- refus non discriminant pour tout identifiant hors périmètre.

Exigences permanentes : mots de passe adaptativement hachés, sessions opaques `HttpOnly`/`SameSite=Lax`/`Secure` hors localhost, rotation et expiration, requêtes paramétrées, HTML échappé, secrets hors dépôt, statique sur liste blanche, journaux expurgés et sauvegardes chiffrables. L’IA et les connecteurs externes sont opt-in, avec minimisation des données, consentement/configuration explicites et journalisation.

## 8. Intégrations

Le module 15 expose une façade stable vers les systèmes tiers : logiciels de location, comptabilité, CRM, RH, identité, Microsoft 365, Google Workspace et autres API. Chaque connecteur dispose de :

- configuration et secrets séparés par tenant ;
- permissions minimales et rotation des identifiants ;
- timeouts, quotas, retry exponentiel borné et coupe-circuit ;
- idempotence, dead-letter/rejeu contrôlé et mapping versionné ;
- audit sans données sensibles ;
- mode désactivé sans impact sur le cœur local.

REST est le contrat public initial. GraphQL n’est introduit que si des usages de composition mesurés dépassent ce que permettent les endpoints de lecture. Les webhooks sont signés, horodatés, protégés contre le rejeu et traités de manière asynchrone. Import/export passe par une zone de staging validée avant application métier.

## 9. Infrastructure, exploitation et disponibilité

La topologie de référence reste un processus local ou un conteneur unique avec volume persistant et sauvegarde. Les environnements `dev`, `staging` et `prod` utilisent la même configuration typée, avec secrets externes au dépôt. Une CI exécute syntaxe, tests, contrôles de contrats, sécurité et paquetage reproductible.

Observabilité minimale : logs JSON corrélés, métriques de latence/erreurs/saturation, traces aux frontières externes et alertes actionnables. Aucun contenu métier libre, token ou cookie dans les signaux.

Docker, orchestration, load balancer, auto-scaling et haute disponibilité sont des options progressives. Kubernetes n’est retenu qu’avec plusieurs instances/services et une capacité d’exploitation démontrée. Avant multi-instance, il faut PostgreSQL, sessions partagées, outbox/bus durable, stockage de fichiers partagé, jobs idempotents, migrations compatibles rolling et tests de panne.

Sauvegarde et reprise : sauvegardes cohérentes et chiffrables, rétention documentée, test de restauration, objectifs RPO/RTO décidés avant production réelle. Chaque migration destructive suit expand/contract et conserve un chemin de rollback ou une sauvegarde restaurable vérifiée.

## 10. Objectifs non fonctionnels et gates

- planning représentatif : 100 ressources et 10 000 réservations ;
- lecture planning p95 `< 300 ms` ;
- conflit + écriture p95 `< 250 ms` ;
- interface exploitable `< 2 s` et interactive ;
- invalidation locale ciblée en moins de 3 secondes ;
- zéro accès inter-tenant, vulnérabilité critique/élevée ou corruption tolérée ;
- fonctionnement local sans SaaS, CDN ni réseau requis.

Chaque lot suit `SPEC → DEV → REVIEW → QA → SECURITY/PERFORMANCE → INTEGRATION → E2E → RELEASE`. L’approbation d’un lot ne vaut que pour l’état testé ; toute correction repasse les gates impactés.

## 11. Décisions différées

| Décision | Déclencheur avant arbitrage | Options ouvertes |
|---|---|---|
| Stack TypeScript/React | spécification de migration UI/API, budget de dépendances et prototype hors ligne | CommonJS modulaire prolongé ou TypeScript progressif |
| SQLite → PostgreSQL | besoin multi-instance, contention mesurée ou exploitation centralisée | SQLite conservé ou PostgreSQL |
| Redis/cache distribué | sessions multi-instance, cache partagé ou files durables mesurées | mémoire/SQLite ou Redis |
| Bus d’événements | connecteurs/projections durables et débit mesuré | outbox + worker local ou broker |
| Microservices | autonomie d’équipe/charge/availability impossible dans le monolithe | monolithe modulaire ou extraction ciblée |
| GraphQL | besoins de composition client et coûts REST mesurés | REST, BFF ou GraphQL |
| SSO/MFA | politique d’identité d’entreprise et fournisseur disponibles | auth locale, OIDC/SAML et MFA |
| IA/fournisseur externe | cas d’usage, base légale, politique de données, coût et mode dégradé | local, fournisseur externe ou absence d’IA |
| Horaires ouvrés/options | décision produit sur capacité, expiration et priorité | calendrier continu ou règles configurables |
| RPO/RTO et HA | contexte de production, criticité et budget d’exploitation | sauvegarde locale ou topologie redondée |

## 12. Critères de conformité à la cible

Une évolution est conforme si elle conserve les invariants MVP, respecte le propriétaire de l’écriture, expose un contrat versionné, applique le tenant depuis la session, produit audit/événement après commit, fonctionne sans connecteur externe et dispose de tests/rollback. Le simple ajout d’une technologie du synoptique ne constitue pas un progrès architectural si ces propriétés ne sont pas démontrées.
