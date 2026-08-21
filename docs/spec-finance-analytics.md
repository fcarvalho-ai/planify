# Spécification fonctionnelle — Finance 09a / Analytics 10a

Statut : candidate Gate SPEC révisée ; baseline de développement adoptée, revue indépendante requise  
Date : 2026-08-14  
Portée : incrément post-MVP `0.2`, compatible avec `0.1.0-rc1`

## 1. Intention et positionnement

Cet incrément transforme les réservations du planning en indicateurs financiers prévisionnels et en relevés de préfacturation internes. Il couvre le premier palier réaliste des modules **Finance** et **Analytics** du synoptique cible : coûts directs, revenus planifiés, marge brute, rentabilité, KPI d'occupation et préparation de facturation.

La roadmap le livre en deux lots liés : **Finance 09a** construit les tarifs, budgets, valorisations et relevés ; **Analytics 10a** consomme leurs contrats pour les KPI et ventilations. Finance 09a publie le contrat partagé de valorisation avant l'intégration d'Analytics 10a. Cette séquence n'introduit ni microservice ni duplication des règles.

Il ne modifie pas les invariants du planning définis dans `docs/spec-mvp.md`. Le planning reste l'autorité sur les périodes, statuts, ressources, quantités, sociétés et sites ; Finance valorise cet état sans le réinterpréter.

Le document emploie volontairement **préfacturation** : un relevé produit par cet incrément est une pièce de contrôle interne, pas une facture fiscale. La numérotation légale, la TVA, les avoirs, les paiements et l'export comptable exigent un lot ultérieur avec validation métier et réglementaire.

## 2. Compatibilité RC1 et décision d'architecture

L'implémentation de référence reste celle de la RC1 :

```text
app.js
  -> API JSON /api/v1 + SSE /api/v1/events
  -> server.js / CommonJS / API natives Node
  -> data/planify.json, écriture atomique
```

La cible TypeScript/React/SQLite de `docs/architecture.md` n'est pas activée par ce lot. Aucune dépendance npm, migration de stack, API distante, CDN, télémétrie ou SaaS n'est autorisé. Les nouvelles collections sont ajoutées au document JSON ; elles référencent les entités RC1 sans en changer la forme.

Une sauvegarde du fichier de données précède l'activation. Le rollback consiste à revenir au code RC1 et, si des données financières doivent être supprimées, à restaurer cette sauvegarde. Le code RC1 doit pouvoir ignorer les nouvelles collections sans altérer clients, projets, ressources ou réservations. Aucune donnée Planning existante n'est réécrite par une migration Finance.

### 2.1 Découpage roadmap et ownership

| Frontière | Lot / owner responsable | Critère de handoff |
|---|---|---|
| Contrat produit et règles de calcul | Product/Domain Lead Finance + Analytics (`finance_analytics_spec`) | présente spécification non ambiguë et revue |
| Tarifs, budgets, valorisations, préfacturation, API et persistance | **Finance 09a** (`finance_09a`) | contrats publiés, tests domaine/API verts, rollback démontré |
| Hook transactionnel dans les mutations de réservation | **Finance 09a**, avec revue du owner Planning Engine (`Agent 04`) | planning + valorisation + audit atomiques, SSE après commit |
| KPI, agrégats, ventilations et navigation Analytics → Planning | **Analytics 10a** (`analytics_10a`) | conformité aux contrats Finance 09a, tests d'agrégats et UI |
| Permissions et shell frontend des deux lots | Finance 09a / Analytics 10a, intégrés par le **Frontend owner** (`Agent intégrateur`) | aucune exposition sans permission, états UI complets |
| Tests indépendants | **QA owner** (`Agent 08`) | tests ciblés puis `npm test`, rapport daté |
| Revue sécurité | **Security owner** (`Agent 11`) | RBAC, isolation, CSRF, exports et absence de fuite vérifiés |
| Mesures de performance | **Performance reviewer indépendant** (`Agent performance`) | jeu section 13, mesures p95 reproductibles |
| Assemblage et statut candidat | **Integration owner** (`Agent 12`) | statut projet à jour, gates aval sur le même état |

Finance 09a est owner du contrat `reservationValuations`. Analytics 10a le lit uniquement via le service/contrat publié et ne recalcule pas les montants. Le owner Planning conserve l'autorité sur les statuts, périodes et allocations. Un reviewer ne corrige pas le code qu'il approuve.

## 3. Périmètre

### Inclus

- tarifs internes de coût et de vente par ressource, avec date d'effet ;
- budget de coût direct et budget de revenu par projet ;
- valorisation automatique des réservations `option` et `confirmed` ;
- snapshot des tarifs utilisés, pour expliquer tout montant historique ;
- revenus planifiés, coûts directs planifiés, marge brute et taux de marge ;
- KPI d'occupation existants, rapprochés des KPI financiers ;
- ventilations par période, site, projet, client, ressource et type de ressource ;
- comparaison budget / planifié par projet ;
- création, recalcul, export CSV local et archivage logique de relevés de préfacturation ;
- permissions dédiées, isolation société/site, audit, contrôle optimiste et invalidations SSE ;
- données de démonstration et tests déterministes sans réseau.

### Exclus

- facture fiscale, numéro de facture légal, TVA, taxes, mentions réglementaires et PDF certifié ;
- devis, options commerciales, probabilités et pipeline CRM ;
- paiement, échéancier, relance, rapprochement bancaire et comptabilité générale ;
- avoir, remboursement et correction d'une facture émise ;
- coûts indirects, frais généraux, amortissement, paie et **marge nette** ;
- temps réellement passé, feuille de temps, achats fournisseurs et coûts réels ;
- tarification par client, remise, forfait, minimum de facturation ou règle d'arrondi commerciale ;
- multi-devise et conversion de change ;
- prévision statistique, recommandation ou IA ;
- data warehouse, BI externe, GraphQL et connecteur comptable ;
- modification rétroactive d'un relevé exporté sans nouvelle révision.

Le synoptique reste la cible globale. Les fonctions exclues ne doivent ni apparaître comme disponibles, ni être simulées par des données inventées.

## 4. Vocabulaire et règles de calcul

### 4.1 Unités monétaires et temporelles

- L'incrément accepte une seule devise par société, `EUR` pour le seed.
- Tout montant persistant est un entier en unité mineure (`amountMinor`, centimes pour EUR). Les nombres flottants ne sont jamais persistés comme montants.
- Un tarif est exprimé en unité mineure par **heure-capacité** : `rateMinorPerCapacityHour`.
- La durée financière est la durée réelle entre les instants UTC de début et de fin. Elle respecte donc les changements d'heure et non un nombre nominal d'heures murales.
- Une allocation utilise : `durationMs × quantity` ; `quantity` vient de `reservation.resources`.
- Chaque montant d'allocation est arrondi à l'entier le plus proche, demi-unité vers le haut. Les totaux sont la somme des lignes déjà arrondies.
- Les intervalles restent semi-ouverts `[startsAt, endsAt)`.

Formules pour une allocation :

```text
capacityHours = durationMs / 3 600 000 × quantity
plannedCostMinor = roundHalfUp(capacityHours × costRateMinorPerCapacityHour)
plannedRevenueMinor = roundHalfUp(capacityHours × saleRateMinorPerCapacityHour)
grossMarginMinor = plannedRevenueMinor - plannedCostMinor
grossMarginRate = plannedRevenueMinor > 0
  ? grossMarginMinor / plannedRevenueMinor × 100
  : null
```

Un taux de marge nul n'est pas affiché lorsque le revenu vaut zéro : la valeur est `null` et l'interface affiche « non calculable ».

### 4.2 Statuts et scénarios

| Statut Planning | Occupation | Coût/revenu prévisionnel | Préfacturable |
|---|---:|---:|---:|
| `option` | oui | oui, catégorie `forecast` | non |
| `confirmed` | oui | oui, catégorie `committed` | oui |
| `cancelled` | non | 0 dans les agrégats actifs | non |

Les montants d'une option ne sont jamais additionnés aux montants engagés. Une vue « prévision totale » peut additionner `forecast + committed`, mais doit afficher séparément les deux composantes.

### 4.3 Tarifs et snapshots

- Un tarif appartient à une société et à une ressource.
- Il comporte `effectiveFrom`, `costRateMinorPerCapacityHour`, `saleRateMinorPerCapacityHour`, `currency`, `active` et `version`.
- Pour une ressource et une date d'effet, deux tarifs actifs ne peuvent pas commencer au même instant.
- Le tarif applicable est le tarif actif dont `effectiveFrom` est le plus récent sans dépasser `reservation.startsAt`.
- Une réservation multi-ressources est valorisée allocation par allocation.
- Lorsqu'une réservation active est créée ou modifiée, sa valorisation est recalculée dans la même mutation atomique et conserve les identifiants, versions et montants des tarifs appliqués.
- Une modification de tarif ne réévalue pas silencieusement les réservations déjà valorisées. Une action explicite de simulation puis de réévaluation est nécessaire ; elle est auditable et exclut toute ligne d'un relevé exporté.
- Une ressource sans tarif produit une valorisation `incomplete`, avec le code `MISSING_RATE`. Elle reste planifiable mais n'est pas ajoutable à un relevé de préfacturation.

### 4.4 Budgets projet

Un projet peut avoir un budget de revenu et un budget de coût direct, tous deux facultatifs et positifs ou nuls. Leur absence est distincte de zéro. Les budgets sont définis dans la devise de la société et modifiables sous contrôle de `version`.

```text
revenueVarianceMinor = revenueBudgetMinor - committedRevenueMinor
costVarianceMinor = directCostBudgetMinor - committedDirectCostMinor
revenueConsumptionRate = revenueBudgetMinor > 0
  ? committedRevenueMinor / revenueBudgetMinor × 100
  : null
```

Un dépassement n'est pas bloquant pour le planning. Il est signalé dans Analytics et audité lors de la mutation qui le provoque.

### 4.5 Préfacturation

Un relevé regroupe des allocations de réservations confirmées pour un client, une période et un périmètre de sites autorisé. Il possède les statuts fermés :

- `draft` : lignes recalculables, modifiables et supprimables ;
- `exported` : snapshot en lecture seule, export CSV déjà produit ;
- `archived` : masqué des vues courantes, conservé pour l'audit.

L'obsolescence n'est **pas** un statut. Elle est exposée par le champ dérivé persistant `sourceState`, de valeurs fermées `current` ou `stale`, calculé en comparant les versions des sources aux versions capturées dans les lignes. `sourceState` et `sourceAnomalies` sont maintenus uniquement par le serveur et sont en lecture seule dans les commandes clientes. `sourceAnomalies` contient des codes structurés sans données sensibles.

| Action | Précondition | `status` après action | `sourceState` après action |
|---|---|---|---|
| création | allocations valides | `draft` | `current` |
| mutation d'une source d'un draft | aucune | `draft` inchangé | `stale` |
| recalcul | `draft` + sources toutes valides | `draft` | `current` |
| export | `draft` + `current` | `exported` | `current` |
| mutation d'une source exportée | aucune ; snapshot immuable | `exported` inchangé | `stale`, anomalie `SOURCE_CHANGED_AFTER_EXPORT` |
| archivage | `draft` ou `exported` | `archived` | inchangé |
| libération des lignes | `archived` + motif | `archived` | inchangé ; `linesReleasedAt` renseigné |

Les seules transitions de `status` sont donc `draft -> exported`, `draft -> archived` et `exported -> archived`. Un relevé `archived` est terminal. `recalculate` est autorisé uniquement sur un `draft`; un relevé `exported` ou `archived` ne change jamais ses lignes.

Une même allocation ne peut figurer que dans un relevé `draft`, `exported`, ou `archived` dont `linesReleasedAt` est absent. Une option, une réservation annulée, une valorisation incomplète ou une réservation d'un autre client/site est refusée.

L'export CSV est généré localement en UTF-8, avec en-têtes stables et montants en unité mineure plus une colonne d'affichage décimale. Il ne contient ni mot de passe, ni session, ni notes libres de réservation. Passer à `exported` fige les lignes, tarifs, libellés, montants et période. L'archivage est logique. Réouvrir ou corriger un relevé exporté est hors périmètre ; l'opérateur l'archive et crée un nouveau relevé avec les lignes redevenues disponibles uniquement après une action explicite `releaseLines`, auditée.

## 5. Modèle de données fonctionnel

Les noms ci-dessous définissent le contrat logique ; le stockage RC1 les représente comme collections JSON.

| Entité | Champs structurants | Invariants |
|---|---|---|
| `financeSettings` | `companyId`, `currency`, `version`, timestamps | une par société ; `currency = EUR` dans ce lot |
| `resourceRates` | `id`, `companyId`, `resourceId`, `effectiveFrom`, deux tarifs, `currency`, `active`, `version`, timestamps | ressource du même tenant ; tarifs entiers >= 0 |
| `projectBudgets` | `id`, `companyId`, `projectId`, budgets facultatifs, `currency`, `version`, timestamps | un actif par projet ; même tenant |
| `reservationValuations` | `id`, `companyId`, `siteId`, `reservationId`, `reservationVersion`, `status`, totaux, `lines`, `version`, timestamps | une valorisation canonique par réservation |
| `billingDrafts` | `id`, `companyId`, `clientId`, `siteIds`, `periodFrom`, `periodTo`, `status`, `sourceState`, `sourceAnomalies`, `linesReleasedAt?`, `currency`, `lines`, totaux, `revision`, `version`, timestamps | période semi-ouverte ; transitions fermées ; lignes homogènes client/devise/périmètre |

Une ligne de valorisation contient au minimum :

```json
{
  "allocationKey": "reservation-id:resource-id",
  "resourceId": "opaque-id",
  "quantity": 1,
  "durationMs": 14400000,
  "rateId": "opaque-id",
  "rateVersion": 2,
  "costRateMinorPerCapacityHour": 6500,
  "saleRateMinorPerCapacityHour": 12000,
  "plannedCostMinor": 26000,
  "plannedRevenueMinor": 48000
}
```

La clé d'allocation doit rester stable pour une version de réservation. Tout document modifiable porte `version`. Toute collection est bornée au `companyId` de session ; `companyId` reçu du client est ignoré comme autorité.

## 6. KPI et dimensions Analytics

### 6.1 KPI exposés

| KPI | Définition |
|---|---|
| `occupancyRate` | formule exacte du dashboard MVP, réservations actives bornées à la période |
| `bookedCapacityHours` | heures-capacité des options et confirmées dans la période |
| `forecastRevenueMinor` | revenu des options, borné à la période |
| `committedRevenueMinor` | revenu des confirmées, borné à la période |
| `forecastDirectCostMinor` | coût direct des options, borné à la période |
| `committedDirectCostMinor` | coût direct des confirmées, borné à la période |
| `committedGrossMarginMinor` | revenu engagé moins coût direct engagé |
| `committedGrossMarginRate` | marge brute engagée / revenu engagé ; `null` si revenu nul |
| `prebillableRevenueMinor` | revenu des allocations confirmées, complètes et absentes d'un relevé actif |
| `budgetRevenueVarianceMinor` | budget revenu moins revenu engagé, par projet |
| `budgetCostVarianceMinor` | budget coût direct moins coût direct engagé, par projet |
| `incompleteValuationCount` | nombre de réservations actives sans valorisation complète |

Tous les KPI financiers sont qualifiés **planifiés**. Aucun écran ne les nomme « réel », « encaissé », « facturé » ou « marge nette ».

### 6.2 Filtres et ventilations

Filtres combinables : `from`, `to`, `siteIds`, `clientIds`, `projectIds`, `resourceIds`, `resourceTypes`, `reservationStatuses`. La période est obligatoire, semi-ouverte, limitée à 366 jours par requête interactive.

Dimensions disponibles : `site`, `client`, `project`, `resource`, `resourceType`, `day`, `week`, `month`. Une requête accepte au plus une dimension temporelle et une dimension métier. Les groupes vides ne sont pas créés implicitement.

Les réservations qui traversent les bornes sont proratisées sur la partie dans la fenêtre, allocation par allocation. Les budgets ne sont jamais proratisés ; ils apparaissent uniquement dans une ventilation par projet. Les totaux d'une réponse sont calculés depuis les lignes sources arrondies, pas depuis l'addition de pourcentages affichés.

### 6.3 Cohérence Occupation / Finance

L'occupation conserve la capacité de la ressource au dénominateur. La finance multiplie la quantité allouée par le tarif. Les deux vues utilisent la même intersection temporelle et les mêmes statuts. Une allocation incomplète reste comptée dans l'occupation mais pas dans les montants ; `incompleteValuationCount` rend cet écart visible.

## 7. Événements sources et cohérence transactionnelle

### 7.1 Événements Planning consommés

- `reservation.created.v1` ;
- `reservation.updated.v1` ;
- `reservation.cancelled.v1` ;
- `resource.updated.v1` ;
- `project.updated.v1`.

L'enveloppe conserve `eventId`, `occurredAt`, `companyId`, `siteId?`, `entityId`, `entityVersion`. Un événement ne transporte pas de note libre ni de montant faisant autorité.

### 7.2 Règle RC1

Le SSE actuel est une invalidation après commit ; ce n'est ni un bus durable ni une source de vérité. Pour éviter une perte de valorisation, création/mise à jour/annulation de réservation et mise à jour de `reservationValuations` sont effectuées dans la **même fonction `mutate` et la même écriture atomique JSON**. L'audit est écrit avant commit ; l'événement et l'invalidation SSE ne sont publiés qu'après succès.

Une modification affectant un relevé `draft` fixe `sourceState: "stale"` sans modifier ses lignes. Le recalcul explicite, uniquement sur un draft, le remet à `current` après validation atomique. Une modification ne change jamais les lignes d'un relevé `exported` : elle fixe `sourceState: "stale"` et ajoute l'anomalie `SOURCE_CHANGED_AFTER_EXPORT`. Un relevé archivé conserve son snapshot et son `sourceState`.

### 7.3 Événements Finance émis

- `finance.rate.updated.v1` ;
- `finance.project_budget.updated.v1` ;
- `finance.valuation.updated.v1` ;
- `billing.draft.created.v1` ;
- `billing.draft.recalculated.v1` ;
- `billing.draft.exported.v1` ;
- `billing.draft.archived.v1`.

Le SSE transmet seulement le type, l'identifiant, la version et le périmètre autorisé. Le client recharge la ressource API concernée. Aucun total financier n'est diffusé à une session dépourvue de permission financière.

## 8. Contrats API

Les conventions de `docs/architecture.md` s'appliquent : JSON UTF-8 en `camelCase`, listes `{ items, page, pageSize, total }`, erreurs `{ error: { code, message, details?, requestId } }`, `Idempotency-Key` pour les créations et `version` obligatoire pour les mises à jour.

### 8.1 Tarifs et budgets

```text
GET    /api/v1/finance/resource-rates?resourceId=&effectiveAt=&page=&pageSize=
POST   /api/v1/finance/resource-rates
PATCH  /api/v1/finance/resource-rates/:id

GET    /api/v1/finance/project-budgets?projectId=&page=&pageSize=
PUT    /api/v1/finance/project-budgets/:projectId
```

Corps de création d'un tarif :

```json
{
  "resourceId": "opaque-id",
  "effectiveFrom": "2026-09-01T00:00:00+02:00",
  "costRateMinorPerCapacityHour": 6500,
  "saleRateMinorPerCapacityHour": 12000,
  "currency": "EUR"
}
```

Corps d'un budget :

```json
{
  "revenueBudgetMinor": 5000000,
  "directCostBudgetMinor": 2400000,
  "currency": "EUR",
  "version": 1
}
```

Le premier `PUT` accepte l'absence de `version`; les suivants l'exigent. Une version obsolète renvoie `409 VERSION_CONFLICT` avec la représentation courante uniquement si elle appartient au périmètre autorisé.

### 8.2 Valorisation et Analytics

```text
GET    /api/v1/finance/valuations?reservationIds=&siteIds=&from=&to=&status=&page=&pageSize=
POST   /api/v1/finance/valuations/revalue-preview
POST   /api/v1/finance/valuations/revalue

GET    /api/v1/analytics/summary?from=&to=&siteIds=&clientIds=&projectIds=&resourceIds=&resourceTypes=&reservationStatuses=
GET    /api/v1/analytics/breakdown?from=&to=&dimension=&timeGrain=&siteIds=&clientIds=&projectIds=&resourceIds=&resourceTypes=&reservationStatuses=&page=&pageSize=
```

`revalue-preview` ne persiste rien et renvoie anciens/nouveaux montants, taux sélectionnés, réservations incomplètes et lignes exclues. `revalue` exige les `reservationIds`, leurs versions courantes, un `previewToken` opaque à durée courte et une `reason` non vide. Toute la sélection est validée avant écriture ; aucune réévaluation partielle.

Réponse synthétique minimale :

```json
{
  "from": "2026-09-01T00:00:00.000Z",
  "to": "2026-10-01T00:00:00.000Z",
  "currency": "EUR",
  "occupancyRate": 62.4,
  "bookedCapacityHours": 842.5,
  "forecastRevenueMinor": 1800000,
  "committedRevenueMinor": 4200000,
  "forecastDirectCostMinor": 920000,
  "committedDirectCostMinor": 2100000,
  "committedGrossMarginMinor": 2100000,
  "committedGrossMarginRate": 50,
  "prebillableRevenueMinor": 3900000,
  "incompleteValuationCount": 2
}
```

### 8.3 Relevés de préfacturation

```text
GET    /api/v1/billing/drafts?status=&sourceState=&clientId=&siteIds=&from=&to=&page=&pageSize=
POST   /api/v1/billing/drafts
GET    /api/v1/billing/drafts/:id
PATCH  /api/v1/billing/drafts/:id
POST   /api/v1/billing/drafts/:id/recalculate
POST   /api/v1/billing/drafts/:id/export
POST   /api/v1/billing/drafts/:id/archive
POST   /api/v1/billing/drafts/:id/release-lines
```

La création reçoit `clientId`, `siteIds`, `periodFrom`, `periodTo` et une liste d'`allocationKeys`. Le serveur reconstruit chaque ligne depuis la valorisation canonique ; il n'accepte aucun montant fourni par le client. Les champs clients `status`, `sourceState`, `sourceAnomalies`, totaux et montants de ligne sont rejetés comme champs inconnus. `PATCH` ne change que le libellé interne et la sélection de lignes d'un `draft`, avec `version`, puis fixe `sourceState` à `current` à partir des sources relues. `recalculate` exige `status: "draft"` et `version`; il échoue atomiquement si une source est devenue invalide et remet `sourceState` à `current` en cas de succès. `export` exige `status: "draft"`, `sourceState: "current"`, `version`, une confirmation explicite et un `Idempotency-Key`; il retourne le snapshot JSON canonique et un téléchargement CSV local. `archive` applique les transitions fermées ci-dessus. `release-lines` exige `status: "archived"`, l'absence d'une libération antérieure, `version` et une justification ; il renseigne `linesReleasedAt` sans changer le statut.

### 8.4 Erreurs métier nouvelles

| HTTP | Code | Cas |
|---:|---|---|
| 409 | `VERSION_CONFLICT` | document financier modifié concurremment |
| 409 | `RATE_EFFECTIVE_DATE_CONFLICT` | date d'effet dupliquée pour la ressource |
| 409 | `VALUATION_STALE` | version Planning différente du snapshot |
| 409 | `BILLING_LINE_ALREADY_USED` | allocation déjà rattachée à un relevé actif |
| 409 | `BILLING_DRAFT_STALE` | une source du relevé a changé |
| 409 | `BILLING_DRAFT_IMMUTABLE` | mutation interdite après export |
| 422 | `MISSING_RATE` | tarif absent pour une allocation requise |
| 422 | `CURRENCY_MISMATCH` | devise différente de celle de la société |
| 422 | `VALIDATION_ERROR` | période, entier monétaire, filtre ou champ invalide |

Pour un identifiant hors tenant ou hors site, répondre `404 NOT_FOUND`; ne jamais révéler son existence par un code financier plus précis.

## 9. Permissions, isolation et confidentialité

### 9.1 Catalogue

| Permission | Capacités |
|---|---|
| `dashboard.read` | KPI d'occupation uniquement, comportement MVP inchangé |
| `analytics.financial.read` | KPI financiers et ventilations autorisées |
| `finance.read` | lire tarifs, budgets, valorisations et relevés |
| `finance.manage` | créer/modifier tarifs, budgets, valorisations et drafts |
| `finance.export` | exporter/archiver/libérer les lignes d'un relevé |
| `audit.read` | lire les événements d'audit autorisés |

Le seed 0.2 attribue les permissions financières à l'administrateur seulement. Le planificateur et le lecteur conservent `dashboard.read` mais ne voient ni tarifs, ni budgets, ni montants. Toute extension future de cette matrice constitue un nouveau changement de spécification. Masquer un écran ne remplace jamais le contrôle serveur.

### 9.2 Isolation

- `companyId` est exclusivement issu de la session.
- Chaque ressource, projet, client, valorisation et relevé est vérifié dans la même société.
- Les agrégats ne portent que sur les sites présents à la fois dans le filtre et dans `auth.user.siteIds`.
- Un utilisateur sans accès à tous les sites demandés reçoit `404 NOT_FOUND`; le serveur ne réduit pas silencieusement le périmètre, afin d'éviter un total trompeur.
- Un relevé multi-site exige l'accès à tous ses sites au moment de chaque lecture et mutation.
- Une ventilation ne révèle ni groupe, ni compte, ni total provenant d'un site interdit.
- Les exports reprennent le même contrôle au moment du téléchargement ; une URL de téléchargement n'est ni publique ni durable.

Les montants financiers sont considérés sensibles : ils sont absents des logs techniques, des événements SSE destinés aux autres rôles et des erreurs génériques.

## 10. Audit et concurrence

Sont audités au minimum : création/modification/désactivation d'un tarif, modification de budget, réévaluation, dépassement de budget, création/recalcul/export/archivage/libération de relevé, tentative refusée de modification d'un relevé immuable.

Chaque audit contient `companyId`, acteur, action, type et identifiant d'entité, instant UTC, version avant/après, `requestId` et détails structurés bornés. Il conserve les deltas de montants et les identifiants de taux, jamais de cookie, jeton, mot de passe, notes libres ou contenu du CSV.

Toutes les mutations sensibles appliquent dans l'ordre : validation, RBAC, isolation, contrôle `version`, calcul complet, écriture atomique des données et de l'audit, commit, puis SSE. Une erreur ne laisse ni ligne, ni réservation de ligne, ni audit de succès partiel.

## 11. UX minimale

- Un onglet Finance, visible seulement avec `finance.read`, présente tarifs, budgets et préfacturation.
- Analytics conserve les KPI d'occupation et ajoute un panneau financier seulement avec `analytics.financial.read`.
- Chaque montant indique la devise, la catégorie `prévision` ou `engagé`, et la période.
- Les options et confirmations sont distinguées par libellé et icône, pas seulement par couleur.
- Une valorisation incomplète affiche les ressources sans tarif et un lien vers leur paramétrage si autorisé.
- Le détail d'un KPI permet d'ouvrir le planning avec période et filtres conservés.
- Une action destructive logique (`archive`, `releaseLines`) exige confirmation et motif quand prévu.
- Chargement, état vide, données partielles, accès refusé, version obsolète et export en cours ont des états explicites.
- Navigation clavier, focus visible, libellés accessibles et largeur minimale 1024 px suivent le MVP.

## 12. Critères d'acceptation

### Tarifs et valorisation

- [ ] Un administrateur crée des tarifs entiers positifs ou nuls, effectifs à une date donnée ; une date dupliquée est refusée sans écriture partielle.
- [ ] Une réservation confirmée de 4 heures, quantité 2, avec coût 65 EUR/h-capacité et vente 120 EUR/h-capacité produit 520 EUR de coût, 960 EUR de revenu et 440 EUR de marge brute.
- [ ] Une réservation traversant un changement DST est valorisée selon la durée UTC réelle.
- [ ] Une réservation multi-ressources utilise le tarif applicable de chaque ressource et somme les lignes arrondies.
- [ ] Une ressource sans tarif laisse la réservation planifiable, marque sa valorisation incomplète et interdit sa préfacturation.
- [ ] Modifier dates, statut, quantité ou ressources recalcule la valorisation dans la même écriture atomique.
- [ ] Annuler une réservation retire ses montants des agrégats actifs sans supprimer son snapshot ni son audit.
- [ ] Modifier un tarif ne change aucune valorisation passée sans preview, versions courantes et motif.

### Budgets et Analytics

- [ ] Pour un jeu contrôlé, occupation et finance utilisent la même intersection de période et les mêmes allocations actives.
- [ ] Les montants `forecast` et `committed` sont séparés et leur somme éventuelle est explicitement nommée prévision totale.
- [ ] Le coût direct, revenu, marge brute et taux de marge sont exacts ; un revenu nul produit un taux `null`.
- [ ] Les ventilations site/projet/client/ressource/type totalisent exactement la synthèse pour les mêmes filtres.
- [ ] Un budget absent est distinct de zéro ; un dépassement est visible et n'empêche pas la réservation.
- [ ] Une période vide retourne des montants à zéro, un taux de marge `null` et aucun groupe artificiel.
- [ ] Une réservation coupée par les bornes est proratisée sur l'intervalle retenu.

### Préfacturation

- [ ] Seules les allocations confirmées, complètes, du même client et du périmètre autorisé sont ajoutables.
- [ ] Deux relevés actifs ne peuvent pas contenir la même allocation, y compris en appels concurrents.
- [ ] Le serveur reconstruit les montants ; un montant falsifié fourni par le navigateur n'a aucun effet.
- [ ] Une source modifiée conserve `status: "draft"`, fixe `sourceState: "stale"` et impose un recalcul explicite avant export.
- [ ] Le recalcul réussi conserve `status: "draft"`, fixe `sourceState: "current"` et incrémente `version` ; un recalcul invalide n'écrit rien.
- [ ] L'export fige un snapshot et produit un CSV local UTF-8 reproductible, sans note libre ni donnée d'authentification.
- [ ] Une source modifiée après export conserve `status: "exported"`, fixe `sourceState: "stale"` et ajoute `SOURCE_CHANGED_AFTER_EXPORT` sans modifier les lignes.
- [ ] Un relevé exporté refuse toute modification ; archivage et libération de lignes sont audités et suivent les transitions fermées.

### Sécurité et robustesse

- [ ] Planificateur et lecteur reçoivent `403` sur les routes financières et ne voient aucun montant via UI, SSE, export ou erreur.
- [ ] Un administrateur de la société A ne peut ni déduire ni agréger une donnée de la société B.
- [ ] Un utilisateur limité au site A ne peut demander, lire ou exporter un relevé contenant le site B.
- [ ] Une version obsolète est refusée sans écraser l'état récent.
- [ ] CSRF, contrôle d'origine, bornes des listes/filtres et limites de corps s'appliquent à toute mutation.
- [ ] Après redémarrage, tarifs, budgets, valorisations, relevés et audits sont identiques.

## 13. Performance et volumétrie

Jeu de référence local déterministe : 100 ressources, 10 000 réservations sur 12 mois, 100 projets, 20 clients, 1 000 versions de tarifs, 100 relevés de 500 lignes au maximum et 20 utilisateurs locaux concurrents.

Objectifs sur machine de développement standard, données chaudes :

- `GET /api/v1/analytics/summary` p95 `< 300 ms` pour une période de 31 jours ;
- `GET /api/v1/analytics/breakdown` p95 `< 400 ms`, réponse paginée ;
- valorisation synchrone ajoutée à une mutation Planning p95 total `< 250 ms` au benchmark Planning existant ;
- création ou recalcul d'un relevé de 500 lignes p95 `< 500 ms` ;
- réponse JSON interactive `< 1 MiB`, page maximale 100 lignes hors export ;
- écran exploitable `< 2 s` et interactions de filtre sans blocage prolongé du thread UI ;
- invalidation SSE visible par une session autorisée en moins de 3 s.

Les benchmarks archivent commande, Node, machine, taille du jeu, médiane, p95, maximum et nombre d'itérations. Une cache mémoire éventuelle est bornée, indexée par société/périmètre/filtres et invalidée après commit ; elle ne devient jamais source de vérité.

## 14. Scénarios E2E obligatoires

1. **Tarifs et budget** — l'administrateur se connecte, crée deux tarifs de ressources et un budget projet, recharge l'application et retrouve les mêmes versions.
2. **Réservation valorisée** — il crée une réservation confirmée multi-ressources ; Analytics affiche coût, revenu et marge attendus, et le détail revient au planning avec les mêmes filtres.
3. **Option puis confirmation** — une option apparaît en prévision mais pas en préfacturable ; après confirmation, les montants passent en engagé et deviennent sélectionnables dans un relevé.
4. **Tarif manquant** — une ressource sans tarif produit une alerte explicite, sans bloquer le planning et sans pouvoir entrer dans un relevé.
5. **Préfacturation** — l'administrateur crée un draft pour un client, contrôle les lignes, exporte le CSV, recharge puis vérifie que le snapshot est immuable.
6. **Source modifiée** — une réservation d'un draft est déplacée ; son `status` reste `draft`, son `sourceState` passe à `stale`, puis le recalcul met les montants à jour, repasse `sourceState` à `current` et laisse une trace d'audit.
7. **Annulation** — une réservation active est annulée ; occupation et agrégats actifs diminuent, son historique de valorisation reste consultable.
8. **Permissions** — planificateur et lecteur ne voient aucun panneau financier et leurs appels directs, SSE et tentatives d'export sont refusés côté serveur.
9. **Isolation** — les identifiants devinés d'une autre société ou d'un site interdit retournent `404` sans différence permettant d'en confirmer l'existence.
10. **Concurrence et persistance** — deux onglets modifient un budget ou un draft ; la version obsolète est refusée, le premier état persiste après redémarrage et l'autre onglet s'actualise par SSE.

Chaque scénario est exécuté par l'interface avec données seedées déterministes, puis vérifié après rechargement ; les contrôles d'autorité, concurrence et isolation sont également couverts par tests API.

## 15. Stratégie de tests et gates

- **Domaine** : durée UTC/DST, arrondi, multi-allocation, statut, marge nulle, budgets et prorata de période.
- **API** : schémas, pagination, filtres, idempotence, erreurs stables, versions et immutabilité.
- **Intégration** : mutation Planning + valorisation + audit atomiques ; relevé concurrent ; SSE après commit.
- **Sécurité** : matrice permissions × routes, isolation tenant/site, CSRF/origine, export et absence de fuite dans logs/SSE.
- **UI** : états incomplet/obsolète/vide/refusé, clavier, focus, libellés et conservation des filtres.
- **Performance** : jeu décrit en section 13 et comparaison avec les seuils Planning RC1.
- **E2E** : dix parcours de la section 14, persistance et redémarrage inclus.

Le workflow obligatoire est `SPEC -> DEV -> REVIEW -> QA -> SECURITY/PERFORMANCE -> INTEGRATION -> E2E -> RELEASE`. Les rapports `APPROVED` de la RC1 deviennent insuffisants pour les fichiers et contrats modifiés par ce lot.

## 16. Données de démonstration

Le seed 0.2 étend le seed RC1 sans donnée réelle :

- devise société EUR ;
- un historique de deux tarifs pour au moins deux ressources et un tarif courant pour les autres, sauf une ressource volontairement incomplète ;
- budgets sur trois projets, dont un proche du dépassement ;
- réservations option et confirmées permettant de vérifier un prorata, une multi-allocation et un changement DST ;
- un relevé `draft` et un relevé `exported` entièrement fictifs.

Le seed est répétable et ne contient ni coordonnées bancaires, ni numéro fiscal, ni donnée client réelle.

## 17. Décisions adoptées et validations produit

Les décisions suivantes constituent la baseline exécutable des lots ; elles ne nécessitent pas d'arbitrage supplémentaire avant DEV :

1. Finance 09a fournit de la préfacturation interne, jamais une facture fiscale.
2. Le seed attribue les permissions financières à l'administrateur uniquement.
3. Le seul modèle tarifaire 0.2 est le tarif par heure-capacité, snapshoté par allocation.
4. La devise est EUR ; TVA, paiement, marge nette et multi-devise sont exclus.
5. CommonJS, API natives Node et JSON atomique sont conservés ; aucune dépendance n'est ajoutée.
6. Une réévaluation est explicite, prévisualisée, versionnée, motivée et impossible sur une ligne exportée.
7. `status` et `sourceState` sont orthogonaux et suivent exclusivement les transitions de la section 4.5.
8. Finance 09a est owner du calcul canonique ; Analytics 10a consomme ce résultat sans règle financière dupliquée.

Les choix produit visibles sont eux aussi fixés pour l'implémentation : libellés « prévision » / « engagé », navigation Finance réservée à l'administrateur, alerte de tarif manquant, et export CSV depuis un draft courant. Le PO les évalue au Gate E2E/RELEASE comme tout choix d'expérience métier ; cette validation n'est pas une décision ouverte et ne bloque pas DEV. Toute demande de changement ultérieure revient à SPEC puis repasse les gates impactés.

L'Integration owner (`Agent 12`) ajoute dans `docs/project-status.md` deux lignes distinctes, `Finance 09a — À faire` et `Analytics 10a — À faire`, avec les owners définis en section 2.1, et consigne la sauvegarde/rollback avant toute mutation de données. Cette mise à jour reste hors du présent lot explicitement limité à un fichier.
