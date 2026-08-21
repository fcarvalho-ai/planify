# Stratégie de test — Sprint 0 V1

## Pyramide

- Unitaires : erreurs, idempotence, RBAC/scope, événements, audit, temps, pricing et consommation devis.
- Intégration : auth, isolation, API Planning/Commercial et migrations existantes via `npm test`.
- Contrat : présence et cohérence minimale de l'OpenAPI, exports des moteurs.
- Performance : dataset déterministe de 250 ressources et 10 000 réservations sur six mois ; mesures API au gate PERFORMANCE.
- E2E : différé après intégration des contrats dans les écrans, sans autoriser Sprint 1 avant G0.

## Cas bloquants

- tenant/site/projet hors scope invisible ;
- rôle sans permission refusé ;
- même clé/même payload rejoué, autre payload refusé ;
- intervalle adjacent accepté, chevauchement/capacité détecté ;
- priorité tarif projet > client > catalogue ;
- journal d'événements rejouable et borné au tenant ;
- audit sans secret ;
- vendu immuable, dépassement calculé séparément.

## Commandes

```bash
npm run lint
npm run test:foundations
npm test
npm run build
```
