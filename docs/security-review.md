# Gate SECURITY indépendant S7-B — scopes Finance, cache et confidentialité

Date : 2026-08-23

Candidat de gate exact : `6bbc224c55415f5753ecd363fcfb1ae1693e018a`

Code applicatif exact : `0aec6303c9b9f5672be4c512277cfca6a6e99988`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 3 P2 ouverts.**

Les deux mutations Finance hors périmètre du rapport précédent sont fermées : CostRate `person` résout désormais l'adhésion autorisée, et ProjectCost contrôle le site du Projet ainsi que son Client même si `siteId` est omis. Les falsifications séquentielles invalident également le cache lié à la signature du fichier actif, et le rollback relit puis valide directement la source. Le gate reste cependant bloqué par une fuite transversale : `/api/v1/audit` restitue les snapshots et montants Finance à tout rôle possédant `audit.read`, même sans `finance.read`.

## P1 bloquant

### SEC-S7B-07 — `audit.read` contourne la confidentialité `finance.read`

`audit()` conserve les objets `before` et `after` sans projection dépendante des permissions (`server.js:1207-1212`). Les confirmations/corrections Actual y placent la révision complète, donc son `costSnapshot` (`server.js:1366-1379`). Les créations/corrections CostRate et ProjectCost y placent également les montants internes. La route `GET /api/v1/audit` exige uniquement `audit.read`, filtre la société, puis retourne les événements bruts (`server.js:3115`).

Un rôle personnalisé `audit.read` sans `finance.read` peut donc lire les coûts unitaires, totaux et snapshots que `actualRecordDto()` masque correctement sur les routes Actual. Cela contredit le critère S7 : un rôle sans `finance.read` ne doit recevoir aucun coût ou total permettant de le déduire.

Correction requise : projeter/redacter les événements d'audit selon les permissions du lecteur, ou séparer une permission d'audit financier explicitement couplée à `finance.read`. Ajouter un test HTTP avec rôle `audit.read` sans Finance couvrant Actual, CostRate et ProjectCost, puis le même acteur avec `finance.read`.

## P2 importants

1. **Cohérence arithmétique du snapshot.** `financeCostSnapshotValid()` contrôle références, devise, entiers, unicité et somme des entrées, mais ne recalcule pas `amountMinor = quantityMilli × allocationQuantity × costUnitMinor / 1000`. Une altération cohérente de tous ces champs, suivie d'un digest Actual recalculé, reste structurellement admissible.
2. **Révocation dynamique Finance incomplètement testée.** Les nouveaux négatifs couvrent POST/PATCH hors site et hors Client, mais pas retrait de scope après création puis GET/PATCH/replay/SSE, ni le comptage explicite de zéro marqueur/audit/SSE sur refus.
3. **Fenêtre de concurrence du cache.** La signature `dev:ino:size:mtimeNs:ctimeNs` couvre les altérations séquentielles et remplacements atomiques. Elle est toutefois reprise après validation sans vérifier qu'elle est identique à la signature initiale, et n'inclut pas les sauvegardes de migration. Un remplacement concurrent entre lecture et mise en cache pourrait associer un DB validé à la signature d'un autre fichier jusqu'à l'invalidation suivante.

## Contrôles conformes

- **Mutations et replays :** `costRateInput()` exige `membershipAllowed()` pour une personne ; `projectCostInput()` exige Projet, site et Client autorisés ; l'état final du PATCH est revalidé ; les replays repassent par `financeEntityAllowed()`/`projectCostAllowed()`.
- **RBAC et tenant :** permissions serveur, CSRF/Origin, société de session, version optimiste et clé idempotente restent obligatoires.
- **Snapshots privés :** la collection `plannedCostSnapshots` n'est jamais incluse dans les DTO Réservation ; `actualRecordDto()` retire `costSnapshot` sans `finance.read`.
- **Cache et falsification nominale :** un hit retourne un clone ; la clé suit inode/taille/temps nanoseconde ; le cache n'est publié qu'après rename atomique. Les tests falsifient révision, snapshot planifié, référence de taux, marqueur et chaîne après lecture et obtiennent `MIGRATION_MARKER_CONFLICT`.
- **Atomicité/rollback :** marqueur et audit sont écrits dans la mutation, SSE après succès ; le rollback exige export `0600`, valide marqueur/sauvegarde et restaure byte-exactement par rename.
- **Runtime :** aucune dépendance, télémétrie, ressource distante ou secret ajouté.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `6bbc224c55415f5753ecd363fcfb1ae1693e018a` |
| `node --check server.js && node --check app.js` | **PASS** |
| `node --test tests/sprint7-finance.test.js tests/sprint7-actuals.test.js tests/migration-sprint7.test.js` | **PASS, 24/24**, 0 échec/skip/todo, `731,84 ms` |
| Inspection POST/PATCH/replay/SSE/audit/cache/migration/rollback | mutations hors scope fermées ; fuite audit P1 confirmée |

Empreintes SHA-256 :

```text
server.js                           a65c81f95c013fa66ac61306d285b50abdbe461f901fe3da4b957e4c779a220e
app.js                              67b80cac99763abd2d5dbfe57fadefe5612504978a156b29343d30ce03a6277d
tests/sprint7-finance.test.js       07dac1c226372cb1c39db56c123e0c11720dd795803659015e4ca5d5658d290f
tests/sprint7-actuals.test.js       d83667ecd893ed88046f95474dd33bf1f5b508cbd83676db774e349f0742a7c9
docs/api/openapi-v1.yaml            b3d48360e946ac3d854c22a6915dc398a2fc6951e2f880b6122a882c88a5cb8e
```

## Handoff

- Gate SECURITY S7-B : **REJECTED** sur `6bbc224c…`, code `0aec6303…`; retour DEV requis pour SEC-S7B-07.
- Fichier modifié par ce gate : `docs/security-review.md` uniquement pour l'axe Sécurité.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

---

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
