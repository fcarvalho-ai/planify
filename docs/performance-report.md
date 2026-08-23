# Gate PERFORMANCE indépendant S7-B — Actuals, Finance, cache et snapshots

Date : 2026-08-23

Candidat de gate exact : `6bbc224c55415f5753ecd363fcfb1ae1693e018a`

Code applicatif exact : `0aec6303c9b9f5672be4c512277cfca6a6e99988`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 3 P2 ouverts.**

Le backfill global de snapshots a disparu des confirmations/corrections Actual, le cache validé évite la validation complète à chaque lecture et le JSON compact limite la taille écrite. Les lectures et l'agrégat Finance respectent largement leurs seuils. Les écritures restent néanmoins à la limite : un premier passage isolé réussit, mais le second passage isolé échoue avec une confirmation p95 `252,79 ms` pour un contrat strict `< 250 ms`. Le gate ne peut pas être approuvé sur un seuil non reproductible.

## P1 bloquant

### PERF-S7B-08 — le seuil d'écriture Actual n'est pas tenu de façon reproductible

Deux exécutions isolées fraîches de `npm run benchmark:actuals` sur le même code et le même dataset donnent :

| Passage | Liste p95 | Pending p95 | Détail p95 | Confirmation p95 | Correction p95 | Verdict |
|---|---:|---:|---:|---:|---:|---|
| isolé 1 | `119,21 ms` | `134,93 ms` | `114,25 ms` | `239,19 ms` | `245,87 ms` | PASS, marge correction `4,13 ms` |
| isolé 2 | `118,34 ms` | `131,30 ms` | `116,12 ms` | **`252,79 ms`** | `239,72 ms` | **FAIL** |

Le processus sort avec code `1` au second passage. Les six réservations à confirmer ont leurs snapshots préparés avant démarrage, et les routes Actual passent `trackReservationCosts: false`; le backfill de 8,9 s du candidat précédent est donc fermé. Le coût résiduel vient principalement du clone transactionnel, de la création révision/audit/digest puis de la sérialisation et du rename de tout le document JSON contenant environ 10 000 Réservations, 10 000 snapshots et 2 500 ActualRecords. Le cache supprime les validations répétées, mais pas la réécriture globale.

Correction requise : obtenir une marge reproductible sous `250 ms` sur plusieurs passages propres, soit en réduisant la taille/duplication persistée et le travail de mutation, soit via une persistance transactionnelle approuvée. Conserver l'atomicité, les digests et le rollback ; augmenter le nombre d'écritures mesurées avant re-gate.

## Benchmark Finance représentatif — conforme

Commande fraîche : `npm run benchmark:finance`.

Dataset : **250 ressources, 10 000 réservations, 2 000 documents commerciaux, 2 000 ActualRecords, 2 000 ProjectCosts et 10 000 snapshots planifiés**.

| Chemin | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| `financeMargins()` | `28,95 ms` | `41,76 ms` | `41,76 ms` | `< 300 ms` |

Résultat réconcilié : 2 000 items, CA signé `20 000 000`, coût planifié `25 200 000`, coût réel `5 200 000` unités mineures. Le moteur est indexé et reste très en dessous du seuil.

## P2 importants

1. **Échantillon d'écriture trop faible.** Cinq confirmations et cinq corrections rendent le p95 égal au maximum et ne caractérisent pas suffisamment la variance observée autour de 250 ms. Une campagne d'au moins 20 écritures par chemin, avec warm-up exclu, est nécessaire au prochain gate.
2. **Dataset Actual partiellement représentatif.** Le harness couvre 10 011 Réservations et 2 500 ActualRecords, mais seulement 161 ressources et aucun lot de 2 000 documents commerciaux. Le benchmark Finance couvre séparément le dataset complet, sans toutefois mesurer les routes HTTP Actual sur ce même document combiné.
3. **Finance HTTP/UI non profilés.** Le benchmark Finance mesure directement le moteur, pas GET/POST/PATCH via HTTP, les rafales SSE ni le rendu navigateur avec 2 000 lignes. L'UI limite le drill-down à 200, mais l'interactivité `<2 s` n'a pas de profil frais.

## Analyse du correctif

- `freezeReservationPlannedCosts()` est exécuté explicitement avant la mesure Actual ; les écritures interactives ne lancent plus le backfill global.
- `mutate(..., { trackReservationCosts: false })` est appliqué aux confirmations/corrections, évitant le scan de détection des Réservations pour ces chemins.
- Le cache `validatedDatabaseCache` est lié à la signature du fichier et retourne un clone ; après écriture atomique réussie, le nouvel état normalisé est mis en cache.
- `atomicWriteFile()` sérialise en JSON compact, puis renomme atomiquement. Cela réduit les octets, mais le coût reste proportionnel à toute la base.
- Les snapshots planifiés restent dans une collection séparée et ne gonflent pas les DTO Réservation ; ils gonflent néanmoins le document persistant réécrit à chaque mutation.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande | Résultat |
|---|---|
| `npm run benchmark:finance` | **PASS**, marge p95 `41,76 ms` |
| `npm run benchmark:actuals` — isolé 1 | **PASS**, lectures `<135 ms`, écritures p95 `239,19/245,87 ms` |
| `npm run benchmark:actuals` — isolé 2 | **FAIL (exit 1)**, confirmation p95 `252,79 ms` |
| Contrôle statique JSON/cache/snapshots | backfill global fermé ; réécriture document complet toujours critique |

Empreintes SHA-256 :

```text
server.js                           a65c81f95c013fa66ac61306d285b50abdbe461f901fe3da4b957e4c779a220e
scripts/benchmark-actuals.js        6bd42742306e65ce72db3ac62c1d80cbaa20c7df93116cfaf1884fdf56741873
scripts/benchmark-finance.js        1d0b4726837026923736bdb27210ea9a5262b429afa9771b665ecc3aee715e11
```

## Handoff

- Gate PERFORMANCE S7-B : **REJECTED** sur `6bbc224c…`, code `0aec6303…`; retour DEV requis pour PERF-S7B-08.
- Fichier modifié par ce gate : `docs/performance-report.md` uniquement pour l'axe Performance.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

---

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
