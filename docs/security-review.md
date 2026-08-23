# Revue SECURITY indépendante — S7-A, verdict final

Date : 2026-08-23

Candidat Git : `27ad4965dc6c4c4fc3336e58b1dff70ea59e3d91`

Verdict : **APPROVED — 0 P0, 0 P1, 1 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `857243146a3aa2b5b136f0a4f57f50186c18c0df211d756a1dad3e118ccc8d98` |
| `app.js` | `eb2c927f161dfbb45e05942bcda929bb37c8217c133a0913c6a0f0cd58263afa` |
| `packages/auth/rbac.js` | `068cb8cffb79be89a9c09d0aed81e98e5f971e8d45d4d3f5dfd2d70fdf5ee55b` |
| `packages/quote-consumption/index.js` | `58bba2239793950530f93392794b0e71ac388c9be7670bd2ee70a176afa1f63b` |
| `tests/sprint7-actuals.test.js` | `30c03d2fd46c277833913527c64920398d6226864eab21f79361ecd8fae8ebb9` |
| `tests/migration-sprint7.test.js` | `129f32023259f7eb98d2f845c5cfcd11f28199ba378bcb5b8eff6fbb88e72a94` |
| `scripts/benchmark-actuals.js` | `2f0847a809ac93dbdf018a8ad8ed50a0370301e55b13ba2b5b8a2e0c95916456` |
| `docs/api/openapi-v1.yaml` | `59df65fca73f2f80d49c0dca46a6f288a674174bedb1b24b4d581855f75c2352` |

La revue finale couvre le Devis principal et chacun de ses compléments, `quote.read`, société/site/Projet et `entityScopes.quote`, liste/détail/pending/rejeu, DTO, SSE, digest V2, idempotence, audit et migration.

## Agrégation des compléments

`actualIndexes()` ne préagrège plus une quantité opaque. Il conserve pour chaque ligne source la paire `{ quoteId, quantityMilli }`. `actualCommercialSummary()` retrouve ensuite chaque Devis complémentaire et ne l'inclut que si `quoteAllowed(auth, complement)` réussit.

Le contrôle est donc appliqué individuellement à chaque complément :

- même société via `quoteAllowed()` ;
- Projet autorisé ;
- site autorisé, ou scope organisationnel pour un document sans site ;
- identifiant présent dans `entityScopes.quote` lorsque ce scope est restreint.

Le test ajoute un complément autorisé de `500` milli-unités et un complément masqué de `9 000`. Le résultat visible reste `1 500`; après autorisation explicite du complément masqué, il devient `10 500`. Aucune quantité cachée ne contribue à la réconciliation.

## DTO, rejeu et SSE

- Liste, détail et historique n'acceptent le record qu'après `actualRecordAllowed()`, qui exige le Devis principal visible.
- Le DTO recalcule la réconciliation avec les seuls compléments autorisés; les révisions V1 sont projetées explicitement avec `digestVersion: 1` sans mutation de la base.
- Confirmation, correction et rejeu repassent par les gardes actuels avant restitution/écriture.
- `sseScopeAllowed()` délègue les événements Actual à `actualRecordAllowed()`. L'invalidation ne contient que société, site, entité et version; elle n'expose aucun complément. Après réception, le DTO applique à nouveau le filtrage individuel des compléments.
- Un utilisateur autorisé sur le réalisé principal peut légitimement recevoir son invalidation même si certains compléments lui sont cachés; aucune donnée commerciale de ces compléments n'est présente dans l'événement.

## Intégrité et autres contrôles satisfaisants

- `digestVersion: 2` protège société, valeurs, chaîne, auteurs et horodatages; auteurs validés dans la société.
- `actual.read`/`actual.confirm`, origine, CSRF, rejet des champs tenant et plafonds de corps restent inchangés et fail-closed.
- Contrôles optimistes et idempotence revalident les scopes au rejeu.
- L'unité ne peut pas être changée sans contrat de conversion versionné.
- Audit/événement sont atomiques; SSE est émis après commit.
- Migration/rollback, sauvegarde/export `0600` et compatibilité V1 restent conformes.

## P2 non bloquant

### SEC-S7A-03 — parcours HTTP de révocation commerciale à compléter

Les tests prouvent directement le garde du Devis principal et l'agrégation complémentaire autorisée. Un scénario HTTP/SSE bout en bout retirant successivement le Devis principal puis un complément n'est pas encore conservé. Recommandation : vérifier liste, détail, rejeu, événement et recalcul après chaque révocation.

## Preuves fraîches

- `node --test tests/sprint7-actuals.test.js tests/migration-sprint7.test.js`, Node `v26.6.0` : **14/14 PASS**, 0 échec, `621,10 ms`; migration `198,89 ms`.
- Inspection indépendante du diff `e4af056…27ad496` et des chemins DTO/SSE/rejeu.
- Benchmark HTTP représentatif complet avec confirmations/corrections : code `0`.

## Limites

- Aucun fuzzing externe.
- Digest V1 conservé uniquement pour compatibilité historique.
- L'absence d'un marqueur « agrégat partiel » peut être clarifiée fonctionnellement lorsqu'un complément est caché, sans constituer une fuite.
- `docs/project-status.md` reste sous ownership intégrateur.

## Verdict

Chaque complément est autorisé individuellement avant agrégation et aucune donnée cachée ne traverse DTO ou SSE. Aucun P0/P1 n'est ouvert. **SECURITY APPROVED** sur `27ad4965dc6c4c4fc3336e58b1dff70ea59e3d91`.
