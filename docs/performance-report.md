# Revue PERFORMANCE indépendante — G6, revalidation de provenance

Date : 2026-08-23

Candidat Git : `14c1268cfcdcbefdcee8bf7a6be10419ef307f14`

Verdict : **REJECTED — 0 P0, 1 P1, 1 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `3903abe5d6bf1503dd0102e0fa798f27c8da1a9bae67609ff74eaa85828c1f0c` |
| `app.js` | `d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54` |
| `tests/plany.test.js` | `f3f292017f74163b6e30bb1653604d02c51d44860a87f84bf60b55e80b5a3294` |
| `tests/quotes.test.js` | `16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a` |
| `docs/api/openapi-v1.yaml` | `5c5da7dfd2ea2911a49432112adaad301eeab5ae63b9d6a9c175cce67a2aba84` |
| `docs/specifications/sprint-6-planybot-excel.md` | `94d4bd35683782043c63a6d52ffc1b13e74c6b2d1cf0cbcb5e35c8c322f93ae1` |

Le diff `6381cbeb…14c1268` ne touche ni les parseurs d'import, ni le moteur de conflit/réservation, ni l'interface. Il modifie en revanche le volume et le traitement des métadonnées de provenance PlanyBot ; ce nouveau chemin fait l'objet d'une mesure fraîche.

## P1 bloquant

### PERF-G6-03 — listes de provenance non bornées et traitement quadratique

Le résumé projet collecte désormais tous les `reservationIds` et `resourceIds` correspondants. Aucun plafond n'est appliqué. `planyAccessSnapshot`, `mergePlanyAccess` et `planyAccessAllowed` effectuent ensuite des recherches linéaires répétées (`includes`/`some`) pour chaque identifiant, donnant un coût O(n²). La représentation est en outre sérialisée plusieurs fois dans les messages, la conversation et l'idempotence.

Microbenchmark local Node `v26.6.0`, 2026-08-23, reproduisant les boucles exactes de snapshot, validation et fusion :

| Identifiants | Snapshot | Validation | Fusion | Total | JSON d'une copie |
|---:|---:|---:|---:|---:|---:|
| 100 | — | — | — | `0,27 ms` | `610 o` |
| 1 000 | — | — | — | `7,64 ms` | `6 910 o` |
| 5 000 | — | — | — | `161,80 ms` | `38 910 o` |
| 10 000 | `111,81 ms` | `178,31 ms` | `109,77 ms` | `399,89 ms` | `78 910 o` |

La mesure exclut la sélection des réservations, les contrôles supplémentaires, la lecture du JSON, la sérialisation des multiples copies et l'écriture atomique de la base. À 10 000 identifiants, les seules boucles de provenance consomment déjà environ 400 ms et dépassent individuellement les budgets des chemins planning les plus sensibles une fois combinées au coût de persistance. La croissance n'est pas bornée par une limite métier et devient rapidement incompatible avec l'objectif d'interface exploitable en moins de 2 s.

Condition de fermeture : plafond explicite et testé sur le cardinal de provenance ; structure `Set`/index pour obtenir O(n) ; représentation canonique stockée une fois et référencée ; benchmark bout en bout à 10 000 réservations et répétition au quota maximal de messages.

## Preuves non-régressives réutilisées après analyse d'impact

Les résultats du candidat `6381cbeb` sont réutilisés uniquement pour les chemins dont le code est inchangé entre les deux hashes :

### Import représentatif borné et non bloquant

- XLSX : 4 001 lignes, 5 colonnes, 20 005 cellules, 20 itérations ; parsing p50 `23,90 ms`, p95 `28,42 ms`, max `35,46 ms`.
- Retard de boucle événementielle : p95 `23,54 ms`, max `29,57 ms`.
- Dépassement cumulé de 16 MiB : rejet `422 CLIENT_PLANNING_LIMIT_EXCEEDED` en `17,25 ms`, avant persistance.

Les fonctions et constantes concernées ne figurent pas dans le diff ; il n'est donc pas justifié de fabriquer une nouvelle mesure identique.

### Planning 250 ressources / 10 000 réservations

Le moteur de lecture/conflit/écriture mesuré par `npm run benchmark:http` est inchangé : lecture p95 `125,35 ms` (`< 300 ms`), conflit p95 `180,97 ms` (`< 250 ms`), écriture p95 `230,37 ms` (`< 250 ms`). Ces résultats prouvent la non-régression du moteur planning isolé, mais pas celle du nouveau traitement PlanyBot qui l'enveloppe.

## P2 non bloquant conservé

### PERF-G6-02 — double parcours de la première feuille générique

`parseClientPlanningXlsx` tente le format spécialisé puis reparcourt la première feuille lorsqu'il ne le reconnaît pas. Le coût reste strictement borné, mais une feuille générique consomme deux fois certains compteurs et duplique du travail. Le diff revalidé ne modifie pas ce comportement. Recommandation : représentation intermédiaire analysée une fois ou budgets physique et fonctionnel distincts.

## Preuves fraîches complémentaires

- `node --test tests/plany.test.js` : **14/14 PASS**, 0 échec, durée `648,21 ms`.
- Scan sémantique OpenAPI des templates et paramètres requis : `OPENAPI_PATH_PARAMETERS_OK` ; aucune incidence runtime.
- Inspection indépendante de `git diff 6381cbeb…14c1268` : les chemins parser et benchmark planning précédemment mesurés sont inchangés ; le nouveau chemin de provenance est circonscrit et mesuré séparément.

## Limites

- Aucun benchmark HTTP bout en bout du résumé à 10 000 identifiants n'a été exécuté ; le microbenchmark exclut la persistance et sous-estime le temps total.
- Les mesures import/planning reprises ne sont pas fraîches sur ce hash, mais leur réutilisation repose sur l'absence vérifiée de modification de leurs chemins. Elles ne sont pas utilisées pour approuver le nouveau chemin.
- Pas de mesure navigateur : `app.js` est identique et la régression identifiée est serveur/persistance.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur, conformément à l'ownership limité demandé.

## Verdict

Le parsing reste borné/non bloquant et le moteur planning isolé conserve ses résultats antérieurs. Cependant, la nouvelle provenance est non bornée, quadratique et dupliquée en persistance. Ce P1 empêche de démontrer les objectifs de performance du parcours PlanyBot. **PERFORMANCE REJECTED** pour G6 sur `14c1268cfcdcbefdcee8bf7a6be10419ef307f14`.
