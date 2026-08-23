# Revue PERFORMANCE indépendante — S7-A, verdict final

Date : 2026-08-23

Candidat Git : `27ad4965dc6c4c4fc3336e58b1dff70ea59e3d91`

Verdict : **APPROVED — 0 P0, 0 P1, 3 P2**

## Périmètre et dataset

Benchmark HTTP local avec persistance JSON : **161 ressources**, **10 011 réservations**, **2 500 réalisations**, pages de 200 éléments. Vingt mesures par lecture après échauffement et cinq écritures par type. Seuils : lecture p95 `< 300 ms`, écriture p95 `< 250 ms`.

Le changement contrôlé remplace, pour les compléments, un total `BigInt` par une courte liste `{ quoteId, quantityMilli }`, filtrée par `quoteAllowed()` lors de la projection. Les index de records/révisions, la pagination avant DTO et la complexité O(A+R) restent inchangés.

## Benchmark frais

Commande : `npm run benchmark:actuals`

Environnement : Node `v26.6.0`, runtime local autonome, données temporaires privées nettoyées.

| Chemin HTTP | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| Liste Actual, page 200 | `95,70 ms` | `105,60 ms` | `109,94 ms` | `< 300 ms` |
| File pending | `120,90 ms` | `281,85 ms` | `290,59 ms` | `< 300 ms` |
| Détail Actual | `102,06 ms` | `115,72 ms` | `117,69 ms` | `< 300 ms` |
| Confirmation | `210,03 ms` | `236,07 ms` | `236,07 ms` | `< 250 ms` |
| Correction | `200,84 ms` | `210,99 ms` | `210,99 ms` | `< 250 ms` |

Tous les seuils contractuels passent. Le benchmark termine avec code `0`.

## Analyse du coût complémentaire

L'indexation des compléments reste linéaire dans le nombre de lignes complémentaires. La projection d'une ligne parcourt uniquement ses compléments associés et effectue une recherche `Map` puis `quoteAllowed()` par document. Aucun retour au scan global des Devis ou des révisions n'est introduit.

Le dataset représentatif ne contient pas une forte densité de compléments sur une même ligne; le test fonctionnel couvre néanmoins le filtrage correct de deux compléments. Pour les volumes métier attendus, ce coût est borné par le nombre de documents complémentaires de la ligne, pas par le nombre total de réalisations.

## Tests et non-régression

- `node --test tests/sprint7-actuals.test.js tests/migration-sprint7.test.js` : **14/14 PASS**, `621,10 ms`.
- Petit seed : pending `5 ms`, confirmation `9 ms`, correction `8 ms`, détail `5 ms`.
- Pagination avant DTO, index `revisionsByRecordId` et validation O(A+R) confirmés par inspection.
- SSE reste compact et ne sérialise aucune liste de compléments.

## P2 non bloquants

### PERF-S7A-02 — marge variable sur pending

Le pending p95 atteint `281,85 ms`, soit `18,15 ms` sous le seuil; quatre mesures consécutives ont été observées entre `264` et `281 ms`, alors que la médiane reste `120,90 ms`. Recommandation : profiler GC/lecture JSON et suivre ce percentile en CI locale.

### PERF-S7A-03 — marge étroite sur confirmation

La confirmation p95 atteint `236,07 ms`, soit `13,93 ms` de marge. Cinq échantillons sont suffisants pour le gate local mais peu précis. Recommandation : campagne plus longue et alerte à 225 ms avant croissance du registre.

### PERF-S7A-04 — rafraîchissement UI complet après SSE

Une invalidation Actual recharge toujours pending et liste. Le debounce court limite les rafales, mais aucune annulation ou mise à jour différentielle n'existe. Recommandation : rafraîchissement ciblé par entité/version avant forte concurrence.

## UI et limites

La page reste bornée à 200 records et charge ses deux agrégats en parallèle. Les invalidations SSE ne transportent que des métadonnées. Aucun profil paint/heap navigateur frais n'a été exécuté; l'exploitabilité sous 2 s repose sur les réponses bornées, les mesures HTTP et le smoke DEV antérieur.

Le benchmark utilise 161 ressources, supérieur au minimum de 100, mais seulement cinq écritures par type. Il ne simule pas une forte densité de compléments par ligne ni une charge multi-session soutenue.

`docs/project-status.md` reste sous ownership intégrateur.

## Verdict

Le filtrage individuel des compléments conserve la complexité et tous les seuils passent. Aucun P0/P1 n'est ouvert. **PERFORMANCE APPROVED** sur `27ad4965dc6c4c4fc3336e58b1dff70ea59e3d91`.
