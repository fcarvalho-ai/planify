# Revue SECURITY indépendante — S7-A, revalidation

Date : 2026-08-23

Candidat Git : `e4af056e5203bace13ce09821c80a7dc768cef32`

Verdict : **APPROVED — 0 P0, 0 P1, 1 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `c63e5f0465ad7621bed356933e14d8679c8e1a2518ee43ae204ef08a72bf0906` |
| `app.js` | `eb2c927f161dfbb45e05942bcda929bb37c8217c133a0913c6a0f0cd58263afa` |
| `packages/auth/rbac.js` | `068cb8cffb79be89a9c09d0aed81e98e5f971e8d45d4d3f5dfd2d70fdf5ee55b` |
| `packages/quote-consumption/index.js` | `58bba2239793950530f93392794b0e71ac388c9be7670bd2ee70a176afa1f63b` |
| `tests/sprint7-actuals.test.js` | `e9d755f5b58db0df15adc6614492b819aa5aa24452ea3b0c11e6ad47f05f8b75` |
| `tests/migration-sprint7.test.js` | `129f32023259f7eb98d2f845c5cfcd11f28199ba378bcb5b8eff6fbb88e72a94` |
| `scripts/benchmark-actuals.js` | `2f0847a809ac93dbdf018a8ad8ed50a0370301e55b13ba2b5b8a2e0c95916456` |
| `docs/api/openapi-v1.yaml` | `59df65fca73f2f80d49c0dca46a6f288a674174bedb1b24b4d581855f75c2352` |

La revalidation couvre `quote.read`, scopes Devis/Actual/Réservation/Ressource/Projet/site, liste, détail, file pending, confirmation, correction, rejeu, historique, SSE, digest V2, validation d'unité, migration et rollback.

## Fermeture de SEC-S7A-01

La provenance commerciale est désormais fail-closed :

- `actualRecordAllowed()` exige `quote.read`, retrouve le Devis source et applique `quoteAllowed()`, donc société, Projet, site et `entityScopes.quote` ;
- liste et détail réutilisent ce garde avec les mêmes index ;
- la file pending et le détail d'une Réservation contrôlent le Devis avant de retourner le snapshot ;
- confirmation et correction contrôlent le Devis source avant toute écriture ;
- les rejeux exacts repassent par `actualRecordAllowed()` et retournent `404` après révocation ;
- `sseScopeAllowed()` délègue les événements Actual à `actualRecordAllowed()`, empêchant l'invalidation après retrait de `quote.read` ou du scope Devis.

Le test ciblé démontre que `actual.read` seul est insuffisant, que `actual.read + quote.read` avec le Devis autorisé passe et qu'un `entityScopes.quote` vide bloque. L'inspection des consommateurs confirme l'application à liste, détail, pending, rejeu et SSE.

## Fermeture de SEC-S7A-02

Les nouvelles révisions utilisent `digestVersion: 2`. L'empreinte couvre désormais société, valeurs opérationnelles, chaîne, confirmeur, date de confirmation, créateur et date de création. Le validateur vérifie aussi que `confirmedBy` et `createdBy` existent dans la société. Une altération de `confirmedAt` est refusée au rejeu de migration.

Le format V1 reste lisible pour compatibilité et rollback. Aucun nouveau record V1 n'est créé.

## P2 non bloquant

### SEC-S7A-03 — couverture HTTP incomplète de la révocation Devis

Le comportement est démontré directement sur le garde central et vérifié statiquement dans tous ses consommateurs. Il manque toutefois un scénario HTTP automatisé complet qui crée une réalisation liée, retire `quote.read` ou `entityScopes.quote`, puis vérifie liste, détail, pending, rejeu et absence SSE. Recommandation : conserver ce parcours comme test d'intégration de non-régression.

## Autres contrôles satisfaisants

- Authentification et permissions `actual.read`/`actual.confirm` côté serveur.
- Origine stricte, CSRF, taille de corps bornée, rejet des champs tenant.
- Contrôles optimistes Réservation/Actual et idempotence par acteur/commande/cible/clé.
- Changement arbitraire d'unité refusé sans contrat de conversion versionné.
- Audit et événement dans l'écriture atomique; SSE seulement après succès.
- Sorties UI échappées et montants Finance masqués sans `finance.read`.
- Migration ordonnée, sauvegarde/export `0600`, intégrité et rollback exact.

## Preuves fraîches

- `node --test tests/sprint7-actuals.test.js tests/migration-sprint7.test.js`, Node `v26.6.0` : **13/13 PASS**, 0 échec, `707,86 ms`; migration `234,70 ms`.
- Inspection indépendante du diff `5c613d3…e4af056` et des consommateurs de `actualRecordAllowed()`.
- Benchmark HTTP représentatif exécuté sans erreur, incluant cinq confirmations et cinq corrections avec audit/persistance.

## Limites

- Aucun fuzzing externe.
- Digest V1 volontairement conservé pour les éventuels enregistrements historiques; seule la V2 garantit les métadonnées renforcées.
- Revue limitée à S7-A; S7-B/C/D ne sont pas présents.
- `docs/project-status.md` reste sous ownership intégrateur.

## Verdict

Les deux constats précédents sont fermés. Aucun P0/P1 sécurité n'est ouvert. **SECURITY APPROVED** pour S7-A sur `e4af056e5203bace13ce09821c80a7dc768cef32`.
