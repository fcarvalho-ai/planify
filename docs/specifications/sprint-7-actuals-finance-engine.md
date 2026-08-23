# Sprint 7 V1 — Réalisé & Finance Engine

Date de cadrage : 2026-08-23  
Statut : **SPEC de référence — DEV non démarré**  
Gate de sortie : **G7 — Finance fiable**

## 1. Autorité et objectif

Cette spécification traduit sans réordonner l’Ordre de lancement V1 et les quinze stories Sprint 7 du Backlog V1 : `US-077` à `US-080` et `US-083` à `US-093` (127 points).

Le Sprint 7 transforme les données commerciales et opérationnelles approuvées en sources Finance réconciliables :

```text
Devis accepté -> planifié -> réalisé confirmé -> facturable
              -> coûts historiques -> marges -> backlog/forecast
              -> occupation/rentabilité par dimension
```

Le Gate G7 exige que prévu, planifié, réalisé et facturable puissent être expliqués jusqu’aux documents, lignes, réservations, confirmations et coûts sources. Le serveur et ses moteurs déterministes restent l’unique autorité. PlanyBot peut expliquer ces résultats, jamais les calculer ni les modifier silencieusement.

Le runtime reste le monolithe local CommonJS/JSON de `0.3.0-rc1`. Le Sprint 7 n’autorise ni migration implicite vers React/TypeScript/SQLite, ni SaaS, ni modèle distant, ni accès réseau à l’exécution.

## 2. Périmètre canonique

| Story | Capacité obligatoire | Critère testable |
|---|---|---|
| US-077 | Réalisations à confirmer | une réservation éligible terminée apparaît dans une file déterministe sans mutation lors d’une simple lecture |
| US-078 | Confirmation/correction du réalisé | le planificateur confirme ou corrige quantité et période ; le planifié reste intact et chaque correction est historisée |
| US-079 | Écarts planifié/réalisé | écarts disponibles par réservation, prestation et projet avec sources et unités cohérentes |
| US-080 | Réalisé facturable | consommation confirmée non couverte par la base commerciale identifiée sans créer de facture ni altérer le Devis |
| US-083 | Backlog signé | CA signé restant à produire calculé et drillable jusqu’au Devis, à sa version et à ses lignes |
| US-084 | Forecast 30/60/90 | projection déterministe séparant production planifiée et reste signé non planifié |
| US-085 | Coût interne des salles | coût daté par ressource/catégorie et unité, historique conservé |
| US-086 | Coût humain | coût daté par personne/catégorie, sans exposition aux rôles non Finance |
| US-087 | Coûts matériel/cloud/fournisseurs | dépenses Projet rattachées à une date, une catégorie et, si possible, une prestation |
| US-088 | Marges | marge Devis, marge planifiée et marge réelle calculées en unités mineures avec formules publiées |
| US-089 | Occupation | capacité, occupation planifiée et occupation réelle par jour/semaine/mois, salle/catégorie/site |
| US-090 | Sous-utilisation/saturation | seuils configurables et liste des périodes/ressources sources |
| US-091 | Rentabilité multidimensionnelle | CA, coûts et marge par salle, prestation, client, projet et site |
| US-092 | Dépassements non facturés | valeur actionnable des réalisés hors couverture commerciale, sans la compter comme CA signé/facturé |
| US-093 | Analyse tarifs/remises | comparaison du prix figé Client/Projet au catalogue applicable, remise et marge moyennes |

### 2.1 Explicitement exclu

- factures fiscales, avoirs, paiements, encaissements et rapprochement bancaire ;
- modification d’un Devis accepté ou de son instantané fiscal HT/TVA/TTC ;
- dashboards Direction/Finance/Planning/Commercial/Exploitation/Chef de projet, réservés au Sprint 8 ;
- exports Excel/PDF/BI et API BI publique, réservés au Sprint 8 ;
- prédiction statistique ou IA du chiffre d’affaires ;
- inventer une valeur `facturé` ou `encaissé` sans source comptable ;
- optimisation automatique de ressources ou mutation autonome par PlanyBot.

## 3. État de départ et divergences maîtrisées

Le candidat `0.3.0-rc1` fournit déjà :

- la chaîne analytique filtrable et les définitions du CA de Sprint 1 ;
- le Devis accepté et son instantané commercial/fiscal immuable ;
- les liens Devis/version/ligne vers les réservations ;
- vendu, planifié, reste et dépassement de Sprint 4 ;
- des coûts et marges prévisionnels figés sur les lignes commerciales ;
- une occupation Planning en temps calendaire continu ;
- l’événement de domaine réservé `ActualConfirmed`.

Ces éléments sont des bases partielles, pas une preuve G7. Aujourd’hui, `revenueChain()` expose réellement `budgeted`, `quoted` et `signed`, mais marque `planned`, `actual`, `billable`, `invoiced` et `collected` indisponibles. Aucun registre de réalisé ni de dépenses Projet ne fait autorité.

`docs/spec-mvp.md` classe encore Finance hors de son ancien MVP `0.1`. Pour la V1 actuelle, l’Ordre de lancement et le Backlog V1 autorisent explicitement Finance au Sprint 7. Cette extension est additive et ne réécrit pas les règles historiques du MVP.

## 4. Contrats du réalisé

### 4.1 Éligibilité « À confirmer »

Une réservation est éligible si :

- elle appartient à la société et aux scopes autorisés ;
- elle est rattachée à un Projet ;
- son intervalle est terminé selon l’instant serveur ;
- son statut opérationnel est `confirmed` ou `completed` ;
- elle n’est ni annulée, ni indisponibilité, ni maintenance ;
- aucune dernière révision de réalisé confirmée ne couvre sa version opérationnelle courante.

`pendingConfirmation` est un état **dérivé**. Une lecture ne modifie jamais la réservation et aucun balayage automatique n’écrit silencieusement dans la base. La file est triée par fin, site, ressource puis identifiant stable.

### 4.2 Registre append-only

```text
ActualRecord
  id, companyId, projectId, siteId, reservationId
  reservationVersion, sourceQuoteId?, sourceQuoteVersionId?
  sourceQuoteLineId?, serviceOfferingId?
  plannedSnapshot
  currentRevisionId, version, createdAt, createdBy

ActualRevision
  id, companyId, actualRecordId, revisionNumber
  startsAt, endsAt, quantityMilli, unit
  confirmationKind: confirmed|corrected
  correctionReason?
  confirmedAt, confirmedBy
  sourceDigest, priorRevisionId?
```

- Le premier enregistrement capture le planifié : période, allocations, quantités, liens commerciaux, prestation, site, Projet et versions sources.
- Une correction crée une nouvelle `ActualRevision`; elle ne remplace ni ne supprime l’ancienne.
- Une différence de période ou quantité exige un motif d’au moins trois caractères.
- La quantité est une chaîne d’entier milli-unité positive ou nulle. L’unité vient de la ligne commerciale/prestation ; une conversion explicite et versionnée est nécessaire si elle diffère.
- Une confirmation fondée sur une ancienne version de réservation répond `409 ACTUAL_SOURCE_STALE`.
- Une réservation sans mapping commercial peut avoir un réalisé opérationnel ; elle est classée `unmapped` et ne reçoit aucune valeur financière inventée.
- La réservation et son historique planifié ne sont jamais modifiés par une confirmation du réalisé.

### 4.3 Commandes et concurrence

Toute confirmation ou correction exige :

- `Idempotency-Key` stable ;
- permission `actual.confirm` ;
- `reservationVersion` et, pour une correction, `actualVersion` ;
- société, site, Projet, réservation et ressources autorisés au moment initial comme au rejeu ;
- audit canonique `before/after`, acteur, origine et `operationId` ;
- événement `ActualConfirmed` après commit seulement ;
- absence totale d’écriture/audit/SSE en cas d’erreur.

Un rejeu exact restitue le résultat historique seulement après revalidation des permissions et de toutes les sources exposées. Un même identifiant avec un corps différent retourne `409 IDEMPOTENCY_CONFLICT`.

## 5. Réconciliation planifié, réalisé et facturable

Le `QuoteConsumptionEngine` étend son contrat sans dupliquer les calculs dans l’UI :

```text
sold       = devis principal accepté + compléments acceptés
planned    = réservations actives liées, converties dans l’unité de la ligne
actual     = dernières révisions de réalisé confirmées liées
remaining = max(sold - max(planned, actual), 0)
overage    = max(max(planned, actual) - sold, 0)
billable   = max(actual - sold, 0)
```

- Les agrégats utilisent les quantités entières en milli-unités et des intervalles semi-ouverts.
- Une prestation non planifiable reste `nonApplicable` pour la complétude Planning ; une dépense liée peut néanmoins contribuer aux coûts.
- `billable` signifie « consommation à traiter commercialement », pas « facturée ».
- Un dépassement planifié peut continuer à préparer un complément selon Sprint 4 ; seul un réalisé confirmé alimente le réalisé facturable G7.
- Aucun surplus facturable n’entre dans le CA signé ou la marge réelle tant qu’un document commercial correspondant n’est pas accepté.

Les réponses exposent les identifiants sources bornés ou une provenance compacte revalidable, sans fuite hors scopes ni croissance quadratique.

## 6. Coûts historiques

### 6.1 Tarifs de coût internes

```text
CostRate
  id, companyId, scopeType, scopeId
  unit, costUnitMinor, currency
  validFrom, validTo?
  active, version, createdAt, updatedAt
```

`scopeType` appartient à `resource`, `resourceCategory`, `person`, `personCategory`. La résolution est déterministe : source directe, puis catégorie ; à niveau égal, période applicable la plus récente. Les périodes sont semi-ouvertes et deux coûts actifs équivalents ne se chevauchent pas.

- Les montants sont des chaînes d’entiers en unités mineures, jamais des flottants.
- La devise est celle de la société pour G7 ; une autre devise est refusée tant qu’aucun contrat de change n’est défini.
- Un calcul historique choisit le coût applicable à la date du planifié/réalisé et conserve `costRateId`, `version` et montant résolu dans son snapshot analytique.
- Modifier ou archiver un tarif ne change aucun résultat déjà figé.

Le champ `costUnitMinor` déjà présent sur les tarifs commerciaux reste une source prévisionnelle compatible. La migration G7 le projette vers un coût interne versionné lorsqu’il est démontrable ; elle ne fabrique aucune valeur manquante.

### 6.2 Dépenses Projet

```text
ProjectCost
  id, companyId, projectId, siteId?
  serviceOfferingId?, reservationId?
  category: equipment|license|cloud|storage|supplier|other
  occurredOn, amountMinor, currency
  description, supplierReference?
  status: draft|confirmed|cancelled
  version, createdAt, createdBy, updatedAt
```

- Seules les dépenses `confirmed` alimentent le coût réel.
- Une correction conserve la version antérieure et son audit ; une suppression métier est une annulation logique.
- Une référence fournisseur est informative et ne vaut ni facture ni paiement.
- Les pièces jointes et la comptabilité fournisseur restent hors Sprint 7.

## 7. Formules Finance publiées

Toutes les formules sont calculées côté serveur et renvoient `definitionVersion`, période, devise, filtres, fraîcheur et sources/drill-down.

### 7.1 Revenus et marges

```text
signedRevenue       = HT des Devis et compléments acceptés actifs
plannedCost         = coûts résolus des réservations planifiées + dépenses Projet planifiées confirmées
actualCost          = coûts résolus des réalisés confirmés + dépenses Projet confirmées
earnedSignedRevenue = part du HT signé couverte par min(actual, sold), par ligne
quoteMargin         = signedRevenue - coût prévisionnel figé du Devis
plannedMargin       = signedRevenue - plannedCost
actualMargin        = earnedSignedRevenue - actualCost
marginBps           = margin / revenue * 10 000, null si revenu nul
```

Le surplus `billable` est présenté séparément à sa valeur commerciale déterministe ; il n’est ajouté à aucun revenu tant qu’un Devis complémentaire n’est pas accepté.

### 7.2 Backlog et forecast

```text
signedBacklog = max(signedRevenue - earnedSignedRevenue, 0)
```

Le forecast 30/60/90 jours sépare :

- `scheduled`: part du CA signé portée par des réservations dans la fenêtre ;
- `unscheduled`: reste signé non planifié dont la date Projet tombe dans la fenêtre ;
- `total = scheduled + unscheduled`, sans double comptage.

La distribution respecte les lignes commerciales et les jours/unités du moteur. Si les dates manquent, le montant est retourné dans `undated`, jamais réparti arbitrairement. Le forecast est déterministe et n’est pas une prédiction IA.

Décision d’implémentation S7-C : ces indicateurs sont des read-models calculés à la demande depuis les Devis acceptés, Réservations et Réalisations déjà versionnés. Ils ne créent aucune collection mutable, aucun audit de lecture et aucun SSE propre. Leur rollback consiste à retirer les routes et consommateurs additifs sans modifier les données S7-A/S7-B. Les réponses publient une définition, une date de situation, la fraîcheur, les compteurs de sources visibles et un drill-down borné ; les droits et scopes sont appliqués avant tout total.

### 7.3 Occupation et capacité

Pour une période et les ressources autorisées :

```text
grossCapacity = capacité nominale dans la fenêtre
blockedCapacity = maintenance + indisponibilités
availableCapacity = max(grossCapacity - blockedCapacity, 0)
plannedOccupied = options + confirmations bornées à la fenêtre
actualOccupied = réalisés confirmés bornés à la fenêtre
plannedOccupancyRate = plannedOccupied / availableCapacity
actualOccupancyRate = actualOccupied / availableCapacity
```

Les doubles options ne sont comptées qu’une fois selon leur groupe/priorité canonique. Les agrégats sont disponibles par jour, semaine et mois, ressource, catégorie et site. Un dénominateur nul donne un taux `null` accompagné de `availability=unavailable`, jamais une division par zéro.

Sous-utilisation et saturation utilisent des seuils versionnés par société/site. Les valeurs par défaut proposées par DEV restent informatives tant qu’elles ne sont pas modifiées par un utilisateur habilité ; toute alerte conserve son seuil, sa fenêtre et ses ressources sources.

### 7.4 Rentabilité, non-facturé et remises

- La rentabilité reprend les mêmes revenus/coûts/marges et les neuf dimensions analytiques existantes ; G7 rend obligatoires salle, prestation, client, Projet et site.
- Le non-facturé liste chaque réalisé facturable avec quantité, valeur, Devis/ligne/réservation sources et action commerciale suggérée, sans créer automatiquement de document.
- La comparaison tarifaire utilise le prix figé du Devis et le tarif catalogue applicable à sa date fiscale et à son unité. Elle expose l’écart en unités mineures et en points de base.
- Une moyenne de remise ou marge est pondérée par le HT, jamais une moyenne simple de pourcentages.

## 8. API V1 prévue

Les contrats détaillés sont ajoutés à OpenAPI pendant DEV ; les chemins minimaux sont :

```text
GET  /api/v1/actuals/pending
GET  /api/v1/reservations/{reservationId}/actual
POST /api/v1/reservations/{reservationId}/actual/confirm
POST /api/v1/actuals/{actualId}/revisions

GET  /api/v1/finance/cost-rates
POST /api/v1/finance/cost-rates
PATCH /api/v1/finance/cost-rates/{costRateId}
GET  /api/v1/finance/project-costs
POST /api/v1/finance/project-costs
PATCH /api/v1/finance/project-costs/{projectCostId}

GET /api/v1/analytics/revenue-chain
GET /api/v1/analytics/backlog
GET /api/v1/analytics/forecast
GET /api/v1/analytics/margins
GET /api/v1/analytics/occupancy
GET /api/v1/analytics/profitability
GET /api/v1/analytics/unbilled-overages
GET /api/v1/analytics/rate-discounts
```

Listes paginées et filtres sont bornés. Les mutations utilisent enveloppes d’erreur stables, `version`, `Idempotency-Key`, contrôle Origin/CSRF, audit et SSE après commit. La chaîne `/analytics/revenue-chain` conserve les stages existants ; G7 rend `planned`, `actual` et `billable` disponibles. `invoiced` et `collected` restent explicitement `unavailable`.

## 9. Permissions, visibilité et confidentialité

Nouvelles permissions fermées :

- `actual.read` : file et quantités opérationnelles de réalisé dans les scopes autorisés ;
- `actual.confirm` : confirmer/corriger un réalisé ;
- `finance.cost.manage` : administrer coûts internes et dépenses Projet ;
- `finance.read` : lire CA, coûts, marges, facturable et analyses Finance.
- `finance.cost.manage` : créer ou modifier toute valeur de coût interne, y compris via une ligne de devis, un tarif commercial ou l'activation d'une grille client importée. Les permissions `quote.manage` et `client.manage` seules ne donnent jamais cette autorité.

Le responsable Planning et le planificateur reçoivent `actual.read`; les profils habilités à valider reçoivent explicitement `actual.confirm`. Finance lit les métriques et gère les coûts selon la matrice, sans obtenir implicitement `planning.write`. Les coûts, marges, tarifs internes et valeurs facturables ne sont jamais inclus dans une réponse ou un SSE destiné à un acteur sans `finance.read`.

Tous les endpoints appliquent société, sites, Projets et scopes d’entités **avant** agrégation. Les totaux sont recalculés sur le sous-ensemble autorisé : aucun total global n’est filtré après calcul. Les replays et historiques revalident les autorités courantes et échouent fermés si leur provenance n’est plus démontrable.

## 10. UI incluse au Sprint 7

Sprint 7 livre les surfaces nécessaires à la production et au contrôle des sources, pas les dashboards finaux :

- file « Réalisations à confirmer » accessible depuis Planning/Projet ;
- panneau de confirmation avec planifié en lecture seule, réalisé proposé, correction motivée et écarts avant validation ;
- historique des confirmations/corrections ;
- administration simple des coûts internes et dépenses Projet ;
- vues analytiques tabulaires de contrôle avec filtres et drill-down vers Projet, Devis, ligne, réservation et réalisé ;
- états chargement, vide, accès refusé, version obsolète et erreur actionnable ;
- navigation clavier, focus visible, labels explicites et écarts non fondés sur la couleur seule.

Les cartes KPI décoratives, compositions Direction et exports sont différés au Sprint 8.

## 11. Migration et rollback

La migration G7 est additive et crée au minimum les collections/référentiels du réalisé, des révisions, coûts internes, dépenses Projet, seuils et marqueurs idempotents.

Avant tout backfill :

- sauvegarde byte-exacte privée `0600`, digest source vérifié et marqueur versionné ;
- reprise idempotente après interruption ;
- aucune déduction de réalisé à partir d’une réservation historique : l’état reste `pendingConfirmation` ;
- projection des coûts commerciaux existants seulement si source, unité, période et devise sont démontrables ; sinon `historicalAccuracy=unknown` ;
- validation d’invariants structurels au rejeu sans figer les champs métier mutables ;
- rollback précédé d’un export de reprise, refusant sauvegarde/marqueur falsifiés et restaurant exactement les octets sources.

Le rollback peut retirer les structures G7 tant qu’aucun réalisé/coût utilisateur n’a été confirmé. Après données G7, l’export est obligatoire et le risque de perte doit être explicite ; aucun bypass silencieux n’est autorisé.

## 12. Performance et observabilité

Jeu de référence : 250 ressources, 10 000 réservations, 2 000 documents commerciaux et 2 000 réalisations/coûts.

- file des réalisations et agrégats Finance : lecture p95 `<300 ms` ;
- confirmation/correction : p95 `<250 ms` hors génération d’export ;
- analyse sur les neuf dimensions : p95 `<300 ms` avec pagination/drill-down bornés ;
- UI de contrôle interactive `<2 s` ;
- calculs linéaires ou indexés, aucune jointure en boucles quadratiques sur les collections complètes ;
- logs corrélés sans montant interne ni donnée personnelle libre ; métriques de latence, erreurs, confirmations et réconciliations, sans télémétrie distante.

## 13. Incréments DEV ordonnés

1. **S7-A — Réalisé fiable (`US-077` à `US-080`)** : modèles, file dérivée, confirmation/correction append-only, écarts, facturable, permissions, audit, événement, OpenAPI, migration/rollback et tests négatifs.
2. **S7-B — Coûts & marges (`US-085` à `US-088`)** : coûts datés, dépenses Projet, résolutions/snapshots et trois marges réconciliées.
3. **S7-C — Backlog & forecast (`US-083`, `US-084`)** : chaîne CA enrichie, backlog signé et projection 30/60/90 sans double comptage.
4. **S7-D — Occupation & rentabilité (`US-089` à `US-093`)** : capacité nette, alertes, rentabilité multidimensionnelle, non-facturé et analyse remises.

Chaque incrément inclut tests positifs/négatifs, RBAC/scopes, idempotence, version, audit, SSE, compatibilité des données existantes et mise à jour du statut. G7 ne peut couvrir qu’un candidat unique regroupant S7-A à S7-D.

## 14. Critères Gate G7

G7 est `APPROVED` uniquement si :

- une réservation terminée apparaît à confirmer sans mutation de lecture ;
- confirmation et correction conservent le planifié et toutes les révisions du réalisé ;
- une double confirmation, un rejeu divergent, une version obsolète ou un scope retiré échoue sans état partiel ;
- les écarts réservation/prestation/Projet proviennent du même moteur que les agrégats Finance ;
- `billable` identifie le réalisé non couvert sans le compter comme signé, facturé ou encaissé ;
- les coûts historiques restent stables après modification des grilles ;
- Devis, planifié et réel produisent les trois marges selon les formules publiées ;
- backlog et forecast 30/60/90 se réconcilient au CA signé sans double comptage ;
- occupation planifiée/réelle, sous-utilisation et saturation se réconcilient à la capacité nette ;
- rentabilité, non-facturé et remises sont filtrables et drillables sur les dimensions autorisées ;
- un rôle sans `finance.read` ne reçoit aucun coût, marge, valeur facturable ni total permettant de les déduire ;
- migrations/replays/rollback sont sûrs et testés ;
- les seuils de performance sont respectés ;
- REVIEW, QA, SECURITY et PERFORMANCE indépendants concluent à zéro P0/P1 ;
- INTEGRATION et E2E démontrent Devis accepté → Planning → réalisé corrigé → facturable → coûts/marge → reload/redémarrage.

Tant que ces critères ne sont pas réunis sur le même candidat, le statut G7 reste **BLOQUÉ** et le Sprint 8 ne démarre pas.
