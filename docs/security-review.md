# Revue SECURITY indépendante — S7-A Réalisé fiable

Date : 2026-08-23

Candidat Git : `5c613d3f683b73fd14830ad76e165dfa641f5749`

Verdict : **NOT APPROVED — 0 P0, 1 P1, 1 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `f81919705c8d5522580cc3a279ea56ca18756f399b34ee8e054cd8058e2e929f` |
| `app.js` | `9387d6913f1cbe934b61e548908f7015aecd59a175201a39f19e4fa1939a9d6e` |
| `packages/auth/rbac.js` | `068cb8cffb79be89a9c09d0aed81e98e5f971e8d45d4d3f5dfd2d70fdf5ee55b` |
| `packages/quote-consumption/index.js` | `58bba2239793950530f93392794b0e71ac388c9be7670bd2ee70a176afa1f63b` |
| `tests/sprint7-actuals.test.js` | `c94f884fc1f0f7a12ba6797e36f9507a1505d522d5e755509f01e6f3077e22f1` |
| `tests/migration-sprint7.test.js` | `129f32023259f7eb98d2f845c5cfcd11f28199ba378bcb5b8eff6fbb88e72a94` |
| `docs/api/openapi-v1.yaml` | `3a84d89420a734fb663483537abf39a1e4e3229feffdabfb40aa72ad5c607e44` |
| `docs/specifications/sprint-7-actuals-finance-engine.md` | `9a0d63334a98d544f648dd9394149704c2cc1ab4ae83cb92111f95f73673a304` |

La revue couvre authentification, origine/CSRF, RBAC `actual.read`/`actual.confirm`, isolation société/site/Projet/entités, rejeu et historique, SSE, validation, idempotence, audit, intégrité append-only, migration/rollback, XSS et abus.

## Constats bloquants

### SEC-S7A-01 — P1 — le scope commercial du Devis source n'est pas revalidé

`actualRecordAllowed()` revalide société, site, Projet, Réservation, ressource et scope `actual`, mais jamais `quote.read`, `entityScopes.quote` ni `quoteAllowed()` pour le Devis de `plannedSnapshot`. `actualCommercialSummary()` charge ensuite directement le Devis accepté et expose identifiants Devis/ligne, quantité vendue, état commercial et devise. Le DTO restitue aussi `sourceQuoteId`, `sourceQuoteVersionId` et `sourceQuoteLineId`.

Un rôle personnalisé avec `planning.read` obtient implicitement `actual.read` même sans `quote.read`. Après retrait du scope Devis, un utilisateur peut encore consulter l'historique, obtenir la réconciliation commerciale ou rejouer une commande, puisque le rejeu ne revalide que `actualRecordAllowed()`.

Correction requise : intégrer la provenance commerciale dans l'autorisation du DTO et du rejeu. Si le Devis n'est plus visible, répondre `404` ou retourner une projection opérationnelle expurgée selon un contrat explicite. Ajouter les tests de retrait de `quote.read`, réduction `entityScopes.quote`, liste, détail, historique, rejeu et SSE.

## Constat important

### SEC-S7A-02 — P2 — l'empreinte append-only omet l'identité et la date de confirmation

`sourceDigest` couvre les valeurs opérationnelles et la chaîne, mais pas `companyId`, `confirmedAt`, `confirmedBy`, `createdAt` ni `createdBy`. Le validateur exige seulement une date ISO et un identifiant non vide; il ne vérifie pas le confirmeur dans la société. Une altération locale de l'auteur ou de la date reste acceptée au redémarrage.

Correction recommandée : versionner l'empreinte, inclure ces métadonnées immuables et vérifier les références utilisateur/société, avec migration/rollback.

## Contrôles satisfaisants

- Session et permissions dédiées sur toutes les routes; mutation réservée à `actual.confirm`.
- Origine stricte et CSRF sur les mutations; corps générique plafonné à 1 Mio.
- Champs tenant client refusés; société issue de la session.
- Scopes site, Projet, Réservation et ressources vérifiés côté serveur avec `404` hors scope.
- Rejeu exact borné à l'acteur et aux scopes opérationnels; contenu divergent en `409`.
- Versions Réservation/Actual contrôlées; correction append-only.
- Audit et événement dans la mutation atomique; SSE seulement après commit, revalidé, limité à une connexion/session et 256 globales.
- Données UI échappées via `esc()`; aucun nouveau HTML utilisateur non échappé trouvé.
- Migration ordonnée S6→S7, sauvegarde `0600`, marqueur vérifié, export obligatoire et rollback exact.

## Preuves fraîches

- `node --test tests/sprint7-actuals.test.js tests/migration-sprint7.test.js`, Node `v26.6.0` : **11/11 PASS**, 0 échec, `572,36 ms`; migration `258,24 ms`.
- Inspection des routes Actual, de `actualRecordAllowed`, `actualCommercialSummary`, des gardes de mutation, de l'idempotence, du SSE et des invariants.
- Les tests couvrent la réduction de scope site au rejeu, pas la révocation du Devis source décrite par `SEC-S7A-01`.

## Limites

- Aucun fuzzing externe ni test de saturation hostile.
- Revue limitée à S7-A; coûts et agrégats S7-B/C/D absents.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

## Verdict

La provenance commerciale traverse le registre Actual sans revalidation du droit et du scope Devis. Ce P1 bloque le gate. **SECURITY NOT APPROVED** sur `5c613d3f683b73fd14830ad76e165dfa641f5749`.
