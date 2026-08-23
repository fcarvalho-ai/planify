# Revue SECURITY indépendante — S7-B

Date : 2026-08-23

Candidat Git : `59ad25a339112dc4faa7df556e43aace6c1cb1ae`

Verdict : **REJECTED — 0 P0, 1 P1, 2 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `3e4921e359e7b3455460443230e7b607b9711b93cae66c45367f32712fed35ee` |
| `app.js` | `39da92b68af5f4faf9c08b783d4d493cfe7c1965e70568e741f5e8a2d7c7ec04` |
| `tests/sprint7-finance.test.js` | `677569280b52e399242855b9f4576cff8fc328fa5e8761f43811f7641fb475e6` |
| `tests/sprint7-actuals.test.js` | `d83667ecd893ed88046f95474dd33bf1f5b508cbd83676db774e349f0742a7c9` |
| `docs/api/openapi-v1.yaml` | `eaa86411c7bea417ecf8e28494122dfb9cc8fbae42f06e285db95b5a3f3ba1cc` |

Revue statique indépendante du diff `27ad496…59ad25a`, des consommateurs HTTP/UI/SSE, de la migration/du rollback et des tests S7-B. Axes contrôlés : session, Origin/CSRF, RBAC, société/site/Projet/entités, rejeu idempotent, entrées et montants, XSS, audit/SSE, confidentialité Finance et intégrité des snapshots.

## P1 bloquant

### SEC-S7B-01 — instantanés de coût exposés aux rôles non Finance

`actualCostSnapshot()` ajoute à chaque `ActualRevision` `costRateId`, `costRateVersion`, `costUnitMinor`, montants par ressource et `totalMinor`. Or `actualRecordDto()` restitue `currentRevision` et, en détail, toutes les `revisions` sans retirer `costSnapshot` lorsque l'acteur ne possède pas `finance.read`.

Les routes Actual n'exigent que `actual.read`; le rôle `planner` possède cette permission mais pas `finance.read`. Il peut donc lire les coûts internes par `GET /api/v1/actuals`, `GET /api/v1/actuals/{id}` ou `GET /api/v1/reservations/{id}/actual`. Cela contredit directement la SPEC §9 : aucun coût ou montant Finance ne doit être inclus dans une réponse destinée à un acteur sans `finance.read`.

Correction requise : construire un DTO de révision contextualisé et supprimer intégralement `costSnapshot` (ou ne renvoyer qu'un état non financier explicitement autorisé) sans `finance.read`, pour la révision courante, l'historique, les listes, le détail et les replays. Ajouter des tests HTTP avec un planner et un rôle custom `actual.read` seul.

## P2 importants non bloquants isolément

### SEC-S7B-02 — invariants du snapshot de coût trop faibles au rejeu

`sprint7ActualsStateValid()` vérifie seulement que le snapshot V3 existe et que son `state` vaut `resolved|unavailable`, puis compare un digest non authentifié. Il ne valide pas la devise, les entiers minor, les identifiants/révisions de taux, l'unicité des ressources ni `totalMinor = somme(entries.amountMinor)`. Une corruption accompagnée d'un digest recalculé peut donc produire un historique Finance structurellement incohérent tout en passant la validation.

Recommandation : valider le schéma et les bornes de chaque entrée, la devise société, la somme et l'état `unavailable`; conserver le digest comme détection accidentelle, pas comme substitut aux invariants.

### SEC-S7B-03 — matrice HTTP de révocation/scopes incomplète

Les gardes de création, lecture, rejeu et SSE sont présents : tenant injecté depuis la session, Origin/CSRF sur mutation, permission serveur, `version`, idempotence, audit avant SSE, et revalidation SSE. Les tests S7-B ne démontrent toutefois pas la révocation après création pour site/Projet/ressource/personne ni l'absence d'événement après retrait de `finance.read`.

Recommandation : conserver des scénarios HTTP/SSE retirant successivement scope Projet, site, entité et permission avant lecture et rejeu.

## Contrôles satisfaisants

- Les mutations Finance passent par session, `finance.cost.manage`, Origin, CSRF, contrôle de version et clé idempotente bornée.
- `companyId` est issu de la session; les champs tenant sont refusés.
- Les montants acceptent uniquement des chaînes entières positives bornées et la devise société.
- Ressources, catégories, personnes, unités, Projets, sites, prestations et réservations sont revalidés côté serveur.
- Les réponses Finance sont échappées dans l'UI; aucune injection HTML non échappée n'a été trouvée dans les nouvelles tables/formulaires.
- Les événements `costRate`/`projectCost` sont compacts, exigent `finance.read`, sont filtrés société/site/Projet/entité et émis après commit.
- La migration est additive, ordonnée, sauvegarde en `0600`, vérifie marqueur/digest/source; le rollback exige un export privé distinct et restaure les octets source.
- Aucun secret, actif distant, dépendance ou télémétrie n'est ajouté.

## Limites

- Aucun fuzzing externe ni test dynamique de navigateur n'a été exécuté.
- Une tentative de sonde HTTP locale indépendante a été bloquée par le sandbox (`listen EPERM`); le constat P1 résulte néanmoins du chemin de code déterministe et des permissions seed explicites.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

## Verdict

La confidentialité Finance n'est pas respectée sur les DTO de réalisé. Cette exposition d'un coût interne à un rôle Planning est bloquante. **SECURITY REJECTED** sur `59ad25a339112dc4faa7df556e43aace6c1cb1ae`.
