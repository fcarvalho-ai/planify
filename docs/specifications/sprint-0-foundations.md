# Sprint 0 V1 — Fondations techniques

Statut : SPEC candidate  
Date : 2026-08-19  
Références : Ordre de lancement V1, Backlog V1, prompt maître Sprint 0

## 1. But et autorité

Le Sprint 0 construit les contrats qui rendent les futurs modules cohérents. Il ne livre pas de nouvel écran métier lourd. L'ordre d'autorité est :

1. ordre de lancement V1 ;
2. backlog V1 ;
3. spécifications métier approuvées ;
4. OpenAPI et ADR approuvés ;
5. code et tests.

PlanyBot assiste l'utilisateur mais n'est jamais source de vérité. Les validations métier, les droits, les conflits, les tarifs, l'idempotence et l'audit restent côté serveur.

## 2. Compatibilité avec la RC1

La RC1 est un monolithe Node.js/CommonJS autonome avec persistance JSON atomique. La cible TypeScript/React/SQLite documentée n'est pas activée implicitement. Le Sprint 0 introduit des frontières de modules, des contrats exécutables et des documents de migration sans déplacer encore le runtime.

Les réponses historiques de l'API restent compatibles avec le frontend actuel. Toute nouvelle API V1 utilise l'enveloppe de succès `{ data, meta }`. Pendant la transition, les erreurs exposent `error_id` comme identifiant canonique et conservent temporairement `requestId` pour les consommateurs RC1.

## 3. Périmètre des huit stories

| Story | Sortie Sprint 0 |
|---|---|
| US-001 | Architecture modulaire et responsabilités décrites par ADR et contrats CommonJS |
| US-002 | OpenAPI v1 versionné avec exemples, pagination, filtres, erreurs, idempotence et version |
| US-003 | Enveloppe d'événement, journal ordonné, rejeu par séquence et catalogue fermé |
| US-004 | Contrat d'audit append-only avec acteur, société, cible, avant/après et `error_id` |
| US-005 | `error_id` corrélé, logs structurés, chronométrage et règles d'observabilité |
| US-006 | Clé d'idempotence liée à acteur/commande/cible/payload, replay et conflit |
| US-106 | Rôles V1 standards et permissions fermées |
| US-108 | Périmètre serveur société/site/projet/entité, sans autorité venant du client |

## 4. Contrats métier obligatoires

- Les intervalles sont semi-ouverts `[startsAt, endsAt)` et stockés en UTC ; la saisie calendrier utilise le fuseau IANA du site.
- `SchedulingEngine` est l'unique autorité pour chevauchement, capacité et disponibilité.
- `PricingEngine` résout les tarifs dans l'ordre projet, client, catalogue ; une surcharge manuelle exige permission et motif.
- `QuoteConsumptionEngine` compare vendu, planifié et réalisé sans modifier le devis accepté.
- Un devis commercial n'est pas une réservation. Le lien reste optionnel et traçable.
- Toute mutation sensible est autorisée, validée, idempotente, versionnée, atomique, auditée, puis publiée après commit.
- `companyId` vient de la session. Les scopes site/projet/entité sont intersectés côté serveur.

## 5. Rôles V1

`ADMIN`, `PLANNING_MANAGER`, `PLANNER`, `SALES`, `PROJECT_MANAGER`, `FINANCE`, `READ_ONLY`.

Le catalogue, les périmètres et la coexistence temporaire avec les rôles RC1 sont documentés dans ADR-007. La compatibilité historique n'élargit jamais une permission existante et doit être retirée lorsque toutes les memberships V1 sont migrées.

## 6. Événements V1

Catalogue initial : `ClientCreated`, `ProjectCreated`, `QuoteCreated`, `QuoteValidated`, `ReservationCreated`, `ReservationUpdated`, `ReservationDeleted`, `ResourceConflictDetected`, `ActualConfirmed`, `OverageDetected`, `SupplementaryQuoteCreated`.

Chaque événement porte `eventId`, `sequence`, `type`, `version`, `occurredAt`, `companyId`, `actorUserId`, `entityType`, `entityId`, `payload`. Le journal est append-only et le rejeu utilise `sequence > afterSequence`.

## 7. Données et migrations

Le modèle conceptuel couvre User, Role, Client, Project, Site, Service, Resource, PricingGrid/Line, Budget, Quote/Line, Reservation et AuditLog. La persistance JSON RC1 reste active. Toute migration SQLite ultérieure devra fournir mapping, sauvegarde, digest, comptages, reprise idempotente et rollback vérifié.

Le dossier `docs/specifications` contient les références de lancement. Le Master V2 n'a pas été fourni dans le paquet V1 reçu ; son absence est tracée mais ne bloque pas les contrats techniques réversibles du Sprint 0.

## 8. Critères du Gate G0

Le Gate G0 est `APPROVED` uniquement si :

- les sept ADR sont relus sans P0/P1 ;
- l'OpenAPI est syntaxiquement valide et cohérent avec les conventions ;
- les contrats RBAC, scope, audit, événements, temps et idempotence sont couverts par tests ;
- la suite complète reste verte ;
- le jeu de charge déterministe produit 250 ressources et 10 000 réservations sur six mois ;
- REVIEW, QA et SECURITY/PERFORMANCE indépendants portent sur le même candidat.

Tant que ces conditions ne sont pas réunies, Sprint 1 reste bloqué.

## 9. Rollback

Les ajouts documentaires et les packages de contrats sont additifs. Le runtime existant continue de fonctionner sans eux. Leur rollback consiste à revenir au candidat antérieur ; aucune donnée métier n'est transformée par ce lot. Toute intégration ultérieure dans `server.js` aura sa migration et son rollback propres.
