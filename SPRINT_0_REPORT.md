# Rapport Sprint 0 V1

Date : 2026-08-19  
État : **DEV intégré — Gate G0 non encore approuvé**

## Référentiel pris en compte

- Ordre de lancement V1 copié dans `docs/specifications/` ;
- Backlog V1 copié dans `docs/specifications/` ;
- prompt Sprint 0 appliqué ;
- Master V2 non présent dans le paquet reçu, absence tracée sans inventer son contenu.

## Diagnostic initial

La RC1 possédait déjà auth/session/CSRF, RBAC dynamique, isolation société/site, audit, version optimiste, idempotence sur plusieurs commandes, SSE revalidé, migrations JSON sécurisées et 170 tests verts. Il manquait le cadre G0 : ADR numérotés, OpenAPI V1, rôles V1 fermés, contrats de moteurs nommés, journal d'événements rejouable, enveloppe `error_id`, CI et dataset de charge reproductible.

## Livré dans l'incrément DEV

- SPEC Sprint 0 et stratégie de test ;
- ADR-001 à ADR-007 ;
- OpenAPI 3.1 candidate couvrant 16 chemins et tous les domaines V1 disponibles dans la RC1 ;
- contrats exécutables `SchedulingEngine`, `PricingEngine`, `QuoteConsumptionEngine` ;
- rôles V1 et contrôle de scope, installés par migration additive sauvegardée et authentifiée ;
- erreurs/enveloppes, idempotence déterministe, audit assaini, événements ordonnés/rejouables ;
- `error_id` ajouté aux erreurs et audits RC1 en compatibilité avec `requestId` ;
- métriques protégées de requêtes, erreurs, latence, SSE et événements, avec logs JSON corrélés ;
- CI locale/GitHub sans dépendance externe ;
- dataset déterministe 250 ressources / 10 000 réservations / six mois ;
- tests de fondation.

## Preuves DEV

Environnement : Node.js local, macOS, dépôt CommonJS sans dépendance npm externe.

| Commande | Résultat |
|---|---|
| `npm run lint` | PASS |
| `npm run test:foundations` | PASS, 14/14 tests |
| `npm run build` | PASS, 5 actifs runtime |
| `npm test` | PASS, 188/188 tests, 0 échec |
| `npm run benchmark:foundations` | PASS, 250 ressources / 10 000 réservations ; disponibilité p95 0,982 ms sur 220 itérations |
| Validation YAML OpenAPI | PASS, OpenAPI 3.1.0 ; 16 chemins ; 5 schémas |
| Smoke local temporaire `localhost:8196` | PASS : frontend 200, login 200, 7 rôles standards, métriques 200 ; serveur arrêté proprement |

## État des stories

| Story | État DEV | Limite avant G0 |
|---|---|---|
| US-001 | Couvert | revue indépendante des frontières |
| US-002 | Couvert par contrat candidat | validation OpenAPI indépendante et convergence progressive des routes RC1 |
| US-003 | Couvert | journal RC1 persisté, séquencé, tenant-scopé et rejouable |
| US-004 | Couvert | revue sécurité du masquage |
| US-005 | Couvert | logs corrélés et métriques protégées ; SSE remplace WebSocket dans la RC1 |
| US-006 | Couvert pour les commandes sensibles V1 | le CRUD historique restant conserve version optimiste ; extension d’idempotence suivie par module |
| US-106 | Couvert | sept rôles installés par migration rejouable avec sauvegarde et contrôle d’intégrité |
| US-108 | Couvert | société issue de session, scopes site/unité et masquage hors tenant testés |

## Gate G0 — état du candidat

| Critère | État |
|---|---|
| Repository, frontend, backend et persistance locale opérationnels | PASS DEV |
| Migrations et seed | PASS DEV |
| Authentification, RBAC et scopes | PASS DEV |
| OpenAPI et sept ADR présents | PASS DEV, validation indépendante requise |
| Audit, événements, versioning et idempotence | PASS DEV |
| Erreurs et observabilité | PASS DEV |
| CI, build, tests critiques et dataset | PASS DEV |
| REVIEW indépendante | FAIL — non exécutée sur ce candidat |
| QA indépendante | FAIL — non exécutée sur ce candidat |
| SECURITY/PERFORMANCE indépendante | FAIL — non exécutée sur ce candidat |
| INTEGRATION/E2E du même candidat | FAIL — non exécutés |

## Verdict

Le lot est prêt à entrer en **REVIEW**, pas à franchir G0. Les gates REVIEW, QA, SECURITY/PERFORMANCE et INTEGRATION doivent porter sur le même candidat. Sprint 1 reste bloqué tant que zéro P0/P1 et toutes les preuves G0 ne sont pas obtenus.
