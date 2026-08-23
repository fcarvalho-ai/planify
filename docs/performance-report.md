# Revue PERFORMANCE indépendante — G6, revalidation terminale

Date : 2026-08-23

Candidat Git : `b25c61d085644525c18ce18a7b25d5b9f81c222c`

Verdict : **APPROVED — 0 P0, 0 P1, 1 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `5025a767d5d05bc08a46aab00d8a2302d86838ce4f3f0d5e8cc817cec91a5a7d` |
| `app.js` | `d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54` |
| `tests/plany.test.js` | `cfd8e782b2a78e00533a3f111337dcb266adcb7dfe91acb67e969e16c79acc58` |
| `tests/quotes.test.js` | `16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a` |
| `docs/api/openapi-v1.yaml` | `0632ef9e0c18adf793e662e883398701146c9a55a7a5fd73801ffe6ecd6a61fb` |
| `docs/specifications/sprint-6-planybot-excel.md` | `39ce221aff88530d0e33e95df82be1aeb9aaafb81897894e9d20305622ddfa23` |

La mesure fraîche couvre le chemin modifié : résumé d'un Projet à 10 000 réservations, création de provenance v3, revalidation et fusion. Deux profils sont distingués : scope organisation et scope d'entités explicite de 10 000 réservations.

## Fermeture du P1 précédent

### PERF-G6-03 — listes de provenance non bornées : **FERMÉ**

Les identifiants complets des réservations et ressources sources ont été remplacés, pour les agrégats, par deux gardes compacts. La taille de provenance ne dépend plus du nombre de réservations agrégées. La fusion ne traite que les identifiants directement exposés, déjà limités par les réponses (`10` conflits, `20` recommandations, actions unitaires).

Benchmark local frais, Node `v26.6.0`, seed déterministe enrichi à **10 000 réservations**, temps comprenant `planyAnswer` + snapshot + revalidation + fusion, avec échauffement exclu :

| Profil | Itérations mesurées | p50 | p95 | max | Taille provenance |
|---|---:|---:|---:|---:|---:|
| Scope organisation | 20 | `16,73 ms` | `17,21 ms` | `17,75 ms` | `270 o` |
| Scope explicite de 10 000 réservations | 6 | `66,67 ms` | `68,63 ms` | `68,63 ms` | `374 o` |

Le second profil inclut la canonicalisation, le tri et le hash du scope explicite ainsi que les contrôles d'accès aux 10 000 réservations. Il demeure largement inférieur à 2 s. La provenance étant constante, ses copies dans les deux messages, la conversation et l'idempotence n'entraînent plus d'amplification liée au volume Projet.

## Non-régression ciblée

- `node --test tests/plany.test.js` : **14/14 PASS**, durée `715,71 ms` sur exécution locale autorisée.
- Le diff `14c1268…b25c61d` ne modifie ni les parseurs CSV/XLSX/PDF, ni le moteur planning lecture/conflit/écriture, ni `app.js`.
- Les dernières mesures de ces chemins inchangés restent informatives : import XLSX représentatif p95 `28,42 ms`, retard de boucle max `29,57 ms`; planning 250 ressources/10 000 réservations, lecture p95 `125,35 ms`, conflit p95 `180,97 ms`, écriture p95 `230,37 ms`. Elles ne sont pas présentées comme mesures fraîches de ce hash.

## P2 non bloquant conservé

### PERF-G6-02 — double parcours de la première feuille générique

`parseClientPlanningXlsx` tente le format spécialisé puis reparcourt la première feuille lorsqu'il ne le reconnaît pas. Le coût reste strictement borné, mais une feuille générique consomme deux fois certains compteurs et duplique du travail. Ce chemin est inchangé par le candidat. Recommandation : analyser une seule fois vers une représentation intermédiaire, ou séparer budget physique et compteurs fonctionnels.

## Impact du constat SECURITY

Le défaut de garde multi-site décrit dans `docs/security-review.md` est fonctionnel et sécuritaire, pas un défaut de coût : ajouter une empreinte canonique des sites effectifs resterait O(s log s) avec un petit résultat fixe. Le verdict PERFORMANCE reste donc indépendant et approuvé.

## Limites

- Le benchmark 10 000 appelle directement les fonctions serveur ; il n'inclut pas HTTP ni l'écriture atomique du fichier. Il mesure précisément le calcul affecté et la taille sérialisée qui provoquaient le précédent P1.
- Les six itérations du scope explicite suffisent à caractériser l'ordre de grandeur local, mais ne constituent pas une campagne de charge longue.
- Aucun nouveau chronométrage navigateur n'est requis : `app.js` est inchangé et aucune donnée supplémentaire n'est rendue.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur conformément à l'ownership limité demandé.

## Verdict

La provenance est désormais compacte, bornée par les sorties réellement exposées et rapide à 10 000 réservations, y compris avec un scope explicite de même cardinal. Aucun P0/P1 de performance n'est ouvert ; seul le double parcours générique historique reste P2. **PERFORMANCE APPROVED** pour G6 sur `b25c61d085644525c18ce18a7b25d5b9f81c222c`.
