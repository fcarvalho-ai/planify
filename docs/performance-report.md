# Revue PERFORMANCE indépendante — S7-B

Date : 2026-08-23

Candidat Git : `59ad25a339112dc4faa7df556e43aace6c1cb1ae`

Verdict : **BLOCKED — 0 P0, 1 P1, 3 P2**

## Périmètre et seuils

La SPEC S7 impose un jeu représentatif de **250 ressources, 10 000 réservations, 2 000 documents commerciaux et 2 000 réalisations/coûts**, avec lectures Finance p95 `< 300 ms`, confirmation/correction p95 `< 250 ms` et UI interactive `< 2 s`.

Le candidat ne contient ni benchmark Finance dédié ni preuve fraîche mesurant `/api/v1/finance/cost-rates`, `/api/v1/finance/project-costs` et `/api/v1/analytics/margins` sur ce dataset. Le benchmark S7-A existant couvre 161 ressources, 10 011 réservations et 2 500 réalisations, mais aucun volume de 2 000 documents/coûts ni la nouvelle route de marge; il ne peut donc pas approuver S7-B.

## P1 bloquant

### PERF-S7B-01 — seuils contractuels Finance non démontrés

Les résultats DEV fonctionnels (20/20 ciblés et 291/291 suite complète, transmis avec le candidat) ne sont pas des mesures de charge. Sans p50/p95/max des listes, de la marge et des écritures sur le volume exigé, le Gate PERFORMANCE ne peut conclure `APPROVED`.

Correction requise : ajouter ou exécuter un harness local déterministe incluant 250 ressources, 10k réservations, 2k Devis, au moins 2k réalisations/dépenses et un nombre représentatif de taux datés; mesurer après échauffement les trois lectures, création/correction de coût/dépense et confirmation/correction Actual enrichie du snapshot.

## P2 importants

### PERF-S7B-02 — résolution de taux rescannée pour chaque allocation

`financeMargins()` appelle `resolveInternalCostRate()` pour chaque allocation planifiée. Cette fonction filtre et trie toute `db.costRates` à chaque appel. La complexité devient approximativement `O(allocations × costRates log costRates)` au lieu d'un index daté construit une fois par requête. À 10 000 réservations et plusieurs centaines de tarifs, cette route est la plus exposée au dépassement du p95.

Recommandation : indexer une fois par calcul les tarifs par `(companyId, scopeType, scopeId, unit)`, déjà triés par période/version, puis résoudre en parcours borné.

### PERF-S7B-03 — nombre de révisions recalculé par scan pour chaque ligne

La liste des dépenses pagine d'abord à 200, puis exécute pour chaque élément un `filter()` complet sur `projectCostRevisions`. Le coût est `O(pageSize × revisions)`. Recommandation : préagréger une `Map<projectCostId,count>` en un seul passage.

### PERF-S7B-04 — rafraîchissement UI Finance intégral sur chaque invalidation

Une invalidation coût/dépense déclenche `loadFinance()`, soit trois appels parallèles et un recalcul complet des marges. Le debounce SSE global limite les rafales à 250 ms mais ne cible ni l'entité ni le Projet. En édition concurrente, ce comportement peut multiplier les scans JSON/Finance et les rendus complets.

Recommandation : recharger la liste concernée et invalider les marges une fois par lot/version; mesurer réseau, scripting, paint et interactivité navigateur.

## Analyse statique favorable

- Les listes HTTP sont paginées et bornées à 200.
- Les trois lectures UI initiales sont parallélisées.
- Les agrégats utilisent `BigInt` et des passages linéaires sur documents, réservations, réalisations et dépenses hors résolution de taux signalée.
- `actualIndexes()` construit les principaux index Actual une fois par calcul de marge.
- Les SSE restent compacts et ne sérialisent aucune collection financière.
- Le runtime demeure local sans dépendance ou accès réseau ajouté.

## Preuves et limites

- Empreinte candidat contrôlée : `59ad25a339112dc4faa7df556e43aace6c1cb1ae`.
- Inspection indépendante du diff `27ad496…59ad25a`, des boucles de `financeMargins()`, des listes Finance et du flux UI/SSE.
- Dernière preuve disponible non suffisante pour S7-B : benchmark S7-A sur 161 ressources/10 011 réservations/2 500 actuals, lectures p95 sous 300 ms et écritures sous 250 ms; elle précède le moteur Finance et ne mesure pas ses routes.
- La campagne représentative S7-B n'a pas été lancée après instruction de finaliser sans nouvelle commande longue.
- Aucun profil navigateur paint/heap frais; l'objectif `<2 s` n'est pas démontré.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

## Verdict

Les seuils S7-B ne sont pas prouvés sur le dataset contractuel et deux chemins présentent une complexité évitable. **PERFORMANCE BLOCKED** sur `59ad25a339112dc4faa7df556e43aace6c1cb1ae`.
