# Revalidation SECURITY indépendante — S7-B

Date : 2026-08-23

Candidat Git : `b42ea165ed32eeebae0b3f9f2080520bf946d4d8`

Verdict : **REJECTED — 0 P0, 1 P1, 2 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `30099196c834172b88870b568b79f8af1b667a9994974c1669a9494e2783d004` |
| `app.js` | `67b80cac99763abd2d5dbfe57fadefe5612504978a156b29343d30ce03a6277d` |
| `tests/sprint7-finance.test.js` | `1c20ef42048df5420fc522155c861f1b3d664e15a188163ac6b744c84545a85d` |
| `tests/sprint7-actuals.test.js` | `d83667ecd893ed88046f95474dd33bf1f5b508cbd83676db774e349f0742a7c9` |
| `scripts/benchmark-finance.js` | `1d0b4726837026923736bdb27210ea9a5262b429afa9771b665ecc3aee715e11` |
| `docs/api/openapi-v1.yaml` | `b3d48360e946ac3d854c22a6915dc398a2fc6951e2f880b6122a882c88a5cb8e` |

Revalidation du diff `59ad25a…b42ea165`, des routes HTTP, DTO Actual/Finance, replays, SSE, migration/rollback et tests de scopes/tamper. Axes : RBAC, société, site, Client, Projet, Devis, Ressource, personne/catégorie, Prestation, confidentialité des snapshots, intégrité et XSS.

## Correctif initial confirmé

`actualRecordDto()` clone maintenant chaque révision et retire `costSnapshot` lorsque l'acteur ne possède pas `finance.read`. Le filtrage couvre révision courante, historique, listes, détail, lecture par réservation, confirmation/correction et replays, car tous passent par le même DTO contextualisé.

Le test HTTP avec `viewer` confirme : détail `200`, aucun `costSnapshot` dans `currentRevision` ni dans l'historique. Les marges et listes de coûts restent `403` sans `finance.read`. **SEC-S7B-01 est fermé.**

## P1 bloquant

### SEC-S7B-04 — mutation de coûts hors site encore possible

Les contrôles de lecture ajoutés pour les quatre scopes de `CostRate` sont corrects, mais les gardes de mutation ne sont pas symétriques :

- pour `scopeType=person`, `costRateInput()` vérifie seulement société + `entityAllowed(person)`; il ne vérifie pas l'adhésion et son site via `membershipAllowed()`, contrairement à `financeEntityAllowed()` utilisé après coup en lecture/rejeu ;
- `projectCostInput()` accepte un Projet sur la seule base de `projectAllowed()`. Or, pour une adhésion limitée à des sites sans liste `projectIds`, `projectAllowed()` est ouvert. Le site réel du Projet et le Client ne sont pas vérifiés ; `siteId` est facultatif et peut rester `null` ;
- `projectCostAllowed()` vérifie le Client mais pas `siteAllowed(auth, project.siteId)`. Une dépense sans `siteId` peut ainsi être relue hors site si le scope Client est ouvert.

Un rôle `finance.cost.manage` limité à Paris peut donc créer un taux pour une personne de Boulogne ou une dépense sur un Projet de Boulogne en omettant `siteId`, dès lors qu'il connaît l'identifiant. La création renvoie immédiatement l'objet et écrit audit/SSE : ce n'est pas un simple défaut d'affichage, mais une mutation hors périmètre.

Correction requise : utiliser les mêmes résolveurs source/scope en entrée, lecture, PATCH et replay ; exiger `membershipAllowed()` pour une personne et `siteAllowed(project.siteId) + clientAllowed()` pour tout ProjectCost, même si son `siteId` propre est absent. Ajouter un test négatif avec un gestionnaire Finance limité à Paris tentant les créations/PATCH/replays Boulogne.

## P2 importants

### SEC-S7B-05 — cohérence arithmétique du snapshot encore partielle

`financeCostSnapshotValid()` valide désormais devise, références, entiers, unicité des ressources, somme des entrées et états `resolved|partial|unavailable`. Il ne vérifie toutefois pas `amountMinor = quantityMilli × allocationQuantity × costUnitMinor / 1000`. Une modification cohérente de `costUnitMinor`, `amountMinor`, `totalMinor` suivie d'un digest recalculé peut donc passer les invariants.

Recommandation : recalculer chaque montant selon la politique et vérifier également que `costRateVersion`/devise/source correspondent à une version historiquement démontrable.

### SEC-S7B-06 — révocation dynamique Finance non couverte

Les tests prouvent le masquage inter-site en lecture et les scopes Client/Devis/Ressource/Prestation dans `financeMargins()`. Ils ne retirent pas dynamiquement permission/site/Projet/entité après une création pour vérifier GET, PATCH, replay et SSE.

Recommandation : ajouter une matrice HTTP/SSE de révocation équivalente à celle des Actuals.

## Contrôles satisfaisants

- Session, Origin, CSRF, permission serveur, clé idempotente, version optimiste, audit et SSE après commit sont présents.
- `companyId` vient de la session et les champs tenant sont refusés.
- Montants mineurs bornés, dates/unités/devise société et périodes sans chevauchement sont validés.
- `financeMargins()` filtre désormais Projet, site, Client, Devis puis chaque ligne Ressource/Prestation/Stock avant agrégation.
- Les quatre sources CostRate sont résolues avant lecture et les lignes hors site sont masquées.
- Les snapshots planifiés sont dans une collection privée, jamais ajoutés aux DTO Réservation ; les snapshots Actual sont masqués hors Finance.
- Les révisions de dépense sont chaînées et append-only ; les snapshots Actual V3 et planifiés reçoivent des invariants renforcés.
- Migration additive ordonnée, sauvegarde privée `0600`, marqueur/digest et rollback avec export privé byte-exact restent conformes.
- L'UI échappe les valeurs Finance ; aucune dépendance, actif distant, secret ou télémétrie n'est ajouté.

## Preuves fraîches

- `node --test tests/sprint7-finance.test.js tests/sprint7-actuals.test.js`, Node `v26.6.0` : **22/22 PASS**, 0 échec, `673,91 ms`.
- Les tests couvrent masquage du snapshot, scopes de lecture, Client/Devis/Ressource/Prestation, tamper avec digest recalculé, chaînes de révisions et rollback.
- Inspection indépendante des chemins `costRateInput`, `financeEntityAllowed`, `projectCostInput`, `projectCostAllowed`, DTO/replay/SSE.

## Limites

- Aucun fuzzing externe.
- Le test de scope CostRate inter-site utilise un lecteur Finance ; il ne teste pas un gestionnaire restreint en mutation, origine du P1.
- `docs/project-status.md` reste sous ownership intégrateur.

## Verdict

La fuite de snapshot est fermée, mais les mutations Finance ne sont pas encore fail-closed sur tous les sites sources. **SECURITY REJECTED** sur `b42ea165ed32eeebae0b3f9f2080520bf946d4d8`.
