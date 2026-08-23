# Revue PERFORMANCE indépendante — S7-A, revalidation

Date : 2026-08-23

Candidat Git : `e4af056e5203bace13ce09821c80a7dc768cef32`

Verdict : **APPROVED — 0 P0, 0 P1, 2 P2**

## Périmètre et seuils

Mesure HTTP locale du registre Actual avec persistance JSON réelle : **161 ressources**, **10 011 réservations**, **2 500 réalisations initiales**, page de 200 éléments. Seuils contractuels : lectures p95 `< 300 ms`, écritures p95 `< 250 ms`.

Le jeu dépasse le minimum de 100 ressources et comprend 10 000 réservations ajoutées, six confirmations disponibles et 2 500 chaînes de révision V2.

## Fermeture de PERF-S7A-01

- `sprint7ActualsStateValid()` construit `revisionsByRecordId` une fois puis valide les chaînes sans filtrage global par record : O(A+R), hors tri local des révisions.
- `actualIndexes()` groupe les révisions une fois et fournit les index Réservation/Ressource/Devis.
- `/actuals` filtre les records autorisés, applique la pagination, puis projette uniquement la page; le `pageSize` borne désormais le travail DTO.
- correction réutilise le groupe indexé et dérive le numéro depuis la révision courante.

## Benchmark frais

Commande : `npm run benchmark:actuals`

Environnement : Node `v26.6.0`, runtime local, fichier temporaire privé nettoyé automatiquement. Vingt mesures par lecture après échauffement; cinq confirmations et cinq corrections uniques incluant validation, audit, événement et écriture atomique.

| Chemin HTTP | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| Liste Actual, page 200 | `103,92 ms` | `110,98 ms` | `114,65 ms` | `< 300 ms` |
| File pending | `117,77 ms` | `127,96 ms` | `131,32 ms` | `< 300 ms` |
| Détail Actual | `99,17 ms` | `108,01 ms` | `109,50 ms` | `< 300 ms` |
| Confirmation | `206,99 ms` | `214,31 ms` | `214,31 ms` | `< 250 ms` |
| Correction | `213,06 ms` | `234,70 ms` | `234,70 ms` | `< 250 ms` |

Tous les seuils passent. La lecture la plus lente conserve environ `172 ms` de marge; l'écriture la plus lente conserve `15,30 ms`.

## Tests et contrôle de complexité

- `node --test tests/sprint7-actuals.test.js tests/migration-sprint7.test.js` : **13/13 PASS**, `707,86 ms`.
- Les tests du petit seed observent pending `5–6 ms`, confirmation `10–11 ms`, correction `11 ms` et détail `6 ms`.
- La sortie du benchmark est non nulle si une lecture atteint 300 ms ou une écriture atteint 250 ms; cette exécution termine avec code `0`.
- Le benchmark nettoie le fichier actif temporaire et ses sauvegardes.

## P2 non bloquants

### PERF-S7A-02 — marge étroite sur la correction JSON

La correction p95 atteint `234,70 ms`, soit seulement `15,30 ms` sous le seuil. Cinq échantillons d'écriture établissent le passage local mais donnent une faible précision statistique. Recommandation : augmenter les itérations et surveiller la taille du fichier; la future persistance cible SQLite devra préserver audit et atomicité.

### PERF-S7A-03 — rafraîchissement UI complet après SSE

Chaque invalidation Actual recharge encore pending et liste. Le debounce de 250 ms absorbe une rafale courte, mais il n'existe ni annulation ni mise à jour différentielle. Recommandation : rafraîchissement par identifiant/version et requêtes annulables avant les usages fortement concurrents.

## UI et SSE

La page reçoit au plus 200 records et la projection serveur est paginée avant DTO. Les deux lectures nécessaires à la page sont parallèles; leurs p95 individuels sont `110,98` et `127,96 ms`, très inférieurs au budget UI de 2 s. Le DOM est borné par les pages reçues. L'invalidation SSE reste compacte et ne transporte aucun historique.

Aucun profil navigateur long n'a été exécuté; l'exploitabilité UI est déduite des réponses bornées, du smoke DEV antérieur et des mesures HTTP fraîches, pas présentée comme une mesure paint/interaction indépendante.

## Limites

- Cinq écritures seulement par type; pas de campagne soutenue multi-session.
- Le benchmark utilise 161 ressources issues du seed complet plutôt qu'exactement 100, ce qui est plus exigeant mais ne constitue pas un comparatif isolé de cardinalité.
- Pas de profil heap ni de mesure paint navigateur fraîche.
- `docs/project-status.md` reste sous ownership intégrateur.

## Verdict

La complexité quadratique et la pagination tardive sont corrigées. Toutes les mesures représentatives passent les seuils, sans P0/P1. **PERFORMANCE APPROVED** pour S7-A sur `e4af056e5203bace13ce09821c80a7dc768cef32`.
