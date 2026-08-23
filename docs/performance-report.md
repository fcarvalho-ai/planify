# Revalidation PERFORMANCE indépendante — S7-B

Date : 2026-08-23

Candidat Git : `b42ea165ed32eeebae0b3f9f2080520bf946d4d8`

Verdict : **REJECTED — 0 P0, 1 P1, 2 P2**

## Seuils et environnement

Seuils S7 : lectures/agrégats p95 `< 300 ms`, confirmations/corrections p95 `< 250 ms`, UI interactive `< 2 s`.

Environnement : Node `v26.6.0`, runtime local CommonJS/JSON, données temporaires privées nettoyées par les scripts.

## Benchmark Finance représentatif

Commande : `npm run benchmark:finance`

Dataset : **250 ressources, 10 000 réservations, 2 000 documents commerciaux, 2 000 ActualRecords, 2 000 ProjectCosts**, 250 taux internes et 10 000 snapshots planifiés.

| Chemin | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| `financeMargins()` | `23,00 ms` | `36,49 ms` | `36,49 ms` | `< 300 ms` |

Le résultat est réconcilié sur 2 000 lignes : CA signé `20 000 000`, coût planifié `25 200 000`, coût réel `5 200 000` en unités mineures. Le benchmark termine sans échec.

L'index `costRateIndex()` est construit une fois par contexte et partagé par les résolutions ; le scan `allocations × costRates` du rapport précédent est fermé. Le comptage de révisions ProjectCost est désormais préagrégé en `Map`, supprimant `O(page × revisions)`.

## P1 bloquant

### PERF-S7B-05 — confirmation et correction dépassent le seuil d'écriture

Commande : `npm run benchmark:actuals`

Dataset : 161 ressources, 10 011 réservations et 2 500 réalisations. Les lectures passent, mais les écritures échouent au seuil `<250 ms` :

| Chemin HTTP | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| Liste Actual | `97,13 ms` | `103,99 ms` | `110,04 ms` | `< 300 ms` |
| Pending | `112,19 ms` | `122,78 ms` | `122,82 ms` | `< 300 ms` |
| Détail | `95,11 ms` | `106,00 ms` | `106,73 ms` | `< 300 ms` |
| Confirmation | `296,41 ms` | `8 937,01 ms` | `8 937,01 ms` | `< 250 ms` |
| Correction | `283,10 ms` | `284,22 ms` | `284,22 ms` | `< 250 ms` |

La première confirmation déclenche `freezeReservationPlannedCosts()` depuis `atomicWrite()` et matérialise les snapshots manquants de l'ensemble des réservations, expliquant le pic de 8,9 s. Les écritures suivantes réécrivent un JSON enrichi d'environ 10 000 snapshots et restent autour de 280–300 ms, au-dessus du contrat.

Correction requise : ne pas backfiller toute la base sur une mutation interactive. Réaliser le backfill en migration bornée/explicite, puis figer uniquement les réservations affectées par la commande ; mesurer de nouveau confirmation, correction et écritures Finance sur le dataset représentatif.

## P2 importants

### PERF-S7B-06 — benchmark Finance incomplet sur HTTP et écritures

Le nouveau harness mesure directement le moteur de marge, pas les endpoints HTTP de listes ni POST/PATCH CostRate/ProjectCost. La preuve de lecture principale est excellente, mais une campagne aval devra conserver p50/p95/max HTTP des trois lectures et des mutations Finance après correction du P1.

### PERF-S7B-07 — UI Finance sans profil navigateur frais

L'UI lance trois lectures en parallèle et limite les drill-down à 200 items. Chaque invalidation CostRate/ProjectCost recharge encore listes et marge complètes. Aucun profil navigateur scripting/paint/heap ne démontre l'interactivité `<2 s` avec 2 000 lignes sources.

Recommandation : profiler chargement initial et rafale SSE, puis cibler l'entité/l'agrégat invalidé.

## Analyse statique favorable

- Agrégat marge linéaire/indexé : index Actual, snapshots planifiés par clé, lignes visibles par clé et taux par scope/unité.
- Les listes restent paginées à 200 ; le drill-down renvoie au plus 200 items et son total séparé.
- Les scopes sont appliqués avant agrégation, ce qui borne les jeux visibles.
- SSE compact, aucune collection sérialisée dans l'événement.
- Runtime local sans dépendance ni accès réseau ajouté.

## Limites

- Huit itérations seulement pour le benchmark direct Finance ; l'écart au seuil reste néanmoins très large (`36,49` contre `300 ms`).
- Le benchmark Actual utilise 161 ressources mais dépasse les volumes de réservations/réalisations contractuels ; il démontre directement l'échec des écritures affectées.
- Aucun test multi-session soutenu ni profil navigateur frais.
- `docs/project-status.md` reste sous ownership intégrateur.

## Verdict

L'agrégat Finance passe largement et les scans identifiés sont optimisés, mais confirmation/correction ne respectent plus le seuil d'écriture. **PERFORMANCE REJECTED** sur `b42ea165ed32eeebae0b3f9f2080520bf946d4d8`.
