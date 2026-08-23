# Re-QA indépendante finale S7-B — fermeture des bloqueurs coûts et marges

Date : 2026-08-23
Commit contrôlé : `b42ea165ed32eeebae0b3f9f2080520bf946d4d8` (`fix(finance): close S7-B gate blockers`)
Verdict : **APPROVED — 0 P0 / 0 P1**

Ce verdict couvre uniquement S7-B (`US-085` à `US-088`) après correction des constats des gates initiaux. Il ne vaut ni approbation du Sprint 7 complet ni approbation G7.

## État exact et empreintes

Le dépôt était propre au démarrage et `HEAD` correspondait exactement au commit demandé. Environnement : Node `v26.6.0`, macOS/Darwin arm64.

```text
server.js                              30099196c834172b88870b568b79f8af1b667a9994974c1669a9494e2783d004
app.js                                 67b80cac99763abd2d5dbfe57fadefe5612504978a156b29343d30ce03a6277d
index.html                             63713e30a59e7192c60b023b9f78d7e85bfef5904788f816e2cec190bd573590
planning.css                           a3bf8f5cea927f00c722c905f85fff1290ef4717ec42836e9acc17cd236c68ad
docs/api/openapi-v1.yaml               b3d48360e946ac3d854c22a6915dc398a2fc6951e2f880b6122a882c88a5cb8e
package.json                           c892784bd2db25355bb2aeacdbf5bfb63544472f0598eee25cd35e2048296813
scripts/benchmark-finance.js           1d0b4726837026923736bdb27210ea9a5262b429afa9771b665ecc3aee715e11
tests/sprint7-actuals.test.js           d83667ecd893ed88046f95474dd33bf1f5b508cbd83676db774e349f0742a7c9
tests/sprint7-finance.test.js           1c20ef42048df5420fc522155c861f1b3d664e15a188163ac6b744c84545a85d
```

## Commandes et résultats frais

- `node --test tests/sprint7-finance.test.js tests/sprint7-actuals.test.js tests/quotes.test.js` : **71/71 réussis**, 0 échec, 0 ignoré, code 0, durée 5,082 s.
- `npm test` : **293/293 réussis**, 0 échec, 0 ignoré, code 0, durée 9,229 s.
- `npm run lint` : **PASS**, incluant `scripts/benchmark-finance.js`, code 0.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés, code 0.
- `git diff --check` : **PASS**, code 0.
- validation sémantique indépendante de `docs/api/openapi-v1.yaml` : **PASS** — OpenAPI 3.1.0, 57 chemins, 75 schémas, 298 références locales (80 distinctes) toutes résolues et 70 `operationId` uniques.
- sonde déterministe locale, isolée via `PLANIFY_DATA_FILE=/private/tmp/planify-s7b-qa-scope.json`, appel direct de `financeMargins` : **PASS** pour la visibilité autorisée et le masquage successif des dimensions Client, Devis et Prestation ; aucun fichier du dépôt modifié.

## Fermeture des risques vérifiée

- **Historique planifié** : un snapshot `plannedCostSnapshots` est créé hors DTO Réservation et indexé par version source. Le coût planifié reste identique après modification du tarif interne et lorsque la Réservation passe à `completed`.
- **Confidentialité du réalisé** : `costSnapshot` est présent pour Finance mais supprimé de la révision courante et de tout l'historique renvoyé à un acteur sans `finance.read`; les routes marges et dépenses lui répondent `403`.
- **Quatre scopes de tarif** : `resource`, `resourceCategory`, `person` et `personCategory` sont créés et la lecture d'un financier limité à Paris masque les quatre sources Boulogne. La résolution directe avant catégorie et le refus de chevauchement restent verts.
- **Marges filtrées avant agrégation** : le test ciblé couvre Client, Devis et Ressource ; la sonde indépendante complète la Prestation via son unité organisationnelle. Retirer chacun des périmètres concernés ramène le CA signé visible à zéro, sans total résiduel permettant une inférence.
- **Marges réconciliées** : la réponse expose `FINANCE_MARGIN@1`, fraîcheur, sources et drill-down ; devis, planifié et réel utilisent leurs coûts figés respectifs. Une dépense annulée reste terminale et ne peut être rouverte.
- **Intégrité et reprise** : la migration est additive, privée et rejouable. Les falsifications de révision de dépense, snapshot réel même re-digéré, snapshot planifié, référence de tarif, marqueur idempotent et chaîne append-only rendent la base indisponible avec `MIGRATION_MARKER_CONFLICT`. Le rollback exige l'export `0600` et restaure exactement les octets sauvegardés.
- **Commercial** : les 51 tests Devis rejoués avec Finance/Réalisations restent verts ; aucune régression du calcul monétaire, des snapshots fiscaux, des versions ou des imports Planning n'est observée.

## Limites non bloquantes

- La sonde Prestation utilise volontairement une prestation rattachée à une unité sans site afin d'isoler le contrôle d'unité organisationnelle. Pour une prestation rattachée à un site, le périmètre site est l'autorité prévue par `offeringAllowed`.
- Cette passe ne revendique pas de smoke visuel navigateur. Les assertions UI statiques Finance sont vertes ; le parcours visuel et la persistance après rechargement restent au gate E2E.
- Les latences et le jeu volumétrique relèvent du gate Performance indépendant ; la présence et la validité syntaxique du benchmark Finance ne constituent pas son verdict.
- S7-C et S7-D restent hors périmètre.

Conclusion : les bloqueurs S7-B sur l'historique planifié, la confidentialité, les quatre sources de coût, les dimensions de marge et l'intégrité de migration sont fermés sur le candidat exact `b42ea16…`. La re-QA indépendante finale S7-B est **APPROVED — 0 P0 / 0 P1**.

# QA indépendante S7-B — coûts internes, dépenses Projet et marges

Date : 2026-08-23
Commit contrôlé : `59ad25a339112dc4faa7df556e43aace6c1cb1ae` (`feat: add Sprint 7 finance costs and margins`)
Verdict : **APPROVED — 0 P0 / 0 P1**

Ce verdict couvre uniquement S7-B (`US-085` à `US-088`). Il ne vaut pas approbation du Sprint 7 complet ni du Gate G7, qui restent dépendants de S7-C, S7-D et des gates aval sur un candidat unique.

## État exact et empreintes

Le dépôt était propre au démarrage et `HEAD` correspondait exactement au commit demandé. Environnement : Node `v26.6.0`, macOS/Darwin arm64.

```text
server.js                              3e4921e359e7b3455460443230e7b607b9711b93cae66c45367f32712fed35ee
app.js                                 39da92b68af5f4faf9c08b783d4d493cfe7c1965e70568e741f5e8a2d7c7ec04
index.html                             63713e30a59e7192c60b023b9f78d7e85bfef5904788f816e2cec190bd573590
planning.css                           fc6168de5e0e3d4295592680cdc0a70b1155feb51bca18cdfa7e29d4a186e009
docs/api/openapi-v1.yaml               eaa86411c7bea417ecf8e28494122dfb9cc8fbae42f06e285db95b5a3f3ba1cc
tests/sprint7-actuals.test.js           d83667ecd893ed88046f95474dd33bf1f5b508cbd83676db774e349f0742a7c9
tests/sprint7-finance.test.js           677569280b52e399242855b9f4576cff8fc328fa5e8761f43811f7641fb475e6
```

## Commandes et résultats frais

- `node --test tests/sprint7-finance.test.js tests/sprint7-actuals.test.js` : **20/20 réussis**, 0 échec, 0 ignoré, code 0, durée 0,710 s.
- `npm test` : **291/291 réussis**, 0 échec, 0 ignoré, code 0, durée 10,199 s.
- `npm run lint` : **PASS**, code 0.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés, code 0.
- `git diff --check` : **PASS**, code 0.
- validation sémantique indépendante de `docs/api/openapi-v1.yaml` : **PASS** — OpenAPI 3.1.0, 57 chemins, 75 schémas, 298 références locales (80 distinctes) toutes résolues et 70 `operationId` uniques.

## Critères et négatifs validés

- La migration Finance est additive et rejouable, produit une sauvegarde privée `0600` et refuse une base dont l'intégrité Finance ou les snapshots historiques ont été falsifiés.
- Les coûts datés sont idempotents, refusent les périodes qui se chevauchent et appliquent la priorité ressource avant catégorie.
- Une dépense Projet est rattachée à un Projet autorisé, versionnée et corrigée par révision append-only avec motif ; une dépense annulée est terminale et ne peut pas être rouverte.
- La confirmation du réalisé fige le coût interne dans `costSnapshot`. Une modification ultérieure du coût de référence ne réécrit ni le snapshot ni l'historique du réalisé.
- Les marges et dépenses sont refusées à un acteur sans `finance.read`; les mutations sont séparées par `finance.cost.manage` et les contrôles UI statiques masquent les formulaires de gestion sans cette permission.
- Les replays idempotents, versions obsolètes, chevauchements, permissions insuffisantes, scopes invalides, falsifications, export obligatoire et rollback byte-exact sont couverts par les tests ciblés sans écriture partielle observée.
- La page Finance expose des KPI, les coûts internes et dépenses dans des régions tabulaires nommées, avec états de chargement/erreur et focus visible vérifiés statiquement.

## Limites non bloquantes

- Le démarrage du smoke navigateur isolé sur `127.0.0.1:8214` a d'abord été refusé par le bac à sable (`listen EPERM`). La demande d'autorisation locale a ensuite été interrompue ; aucun smoke visuel n'est donc revendiqué dans cette passe. Les contrôles UI ciblés sont automatisés et verts, mais l'E2E navigateur reste à exécuter au gate dédié.
- Les seuils volumétriques et latences relèvent du gate Performance indépendant. Cette QA ne transforme pas les tests fonctionnels en preuve de performance.
- S7-C (backlog/forecast) et S7-D (occupation/rentabilité/tarifs) restent hors périmètre.

Conclusion : aucun échec fonctionnel, défaut P0/P1 ou régression de suite n'a été observé sur le candidat exact `59ad25a…`. Le gate QA indépendant S7-B est **APPROVED — 0 P0 / 0 P1**.

# Re-QA finale S7-A — isolation des Devis complémentaires

Date : 2026-08-23
Commit contrôlé : `27ad4965dc6c4c4fc3336e58b1dff70ea59e3d91` (`fix: scope actuals complementary quotes`)
Verdict : **APPROVED — 0 P0 / 0 P1**

Ce verdict couvre uniquement S7-A (`US-077` à `US-080`) et ne vaut pas approbation du Sprint 7 complet ni du Gate G7.

## État exact et empreintes

Le dépôt était propre au démarrage et `HEAD` correspondait exactement au commit demandé. Environnement : Node `v26.6.0`, macOS/Darwin arm64.

```text
server.js                              857243146a3aa2b5b136f0a4f57f50186c18c0df211d756a1dad3e118ccc8d98
app.js                                 eb2c927f161dfbb45e05942bcda929bb37c8217c133a0913c6a0f0cd58263afa
docs/api/openapi-v1.yaml               59df65fca73f2f80d49c0dca46a6f288a674174bedb1b24b4d581855f75c2352
packages/quote-consumption/index.js    58bba2239793950530f93392794b0e71ac388c9be7670bd2ee70a176afa1f63b
tests/sprint7-actuals.test.js           30c03d2fd46c277833913527c64920398d6226864eab21f79361ecd8fae8ebb9
tests/migration-sprint7.test.js         129f32023259f7eb98d2f845c5cfcd11f28199ba378bcb5b8eff6fbb88e72a94
```

## Commandes et résultats frais

- `node --test tests/migration-sprint7.test.js tests/sprint7-actuals.test.js` : **14/14 réussis**, 0 échec, 0 ignoré, code 0, durée 0,597 s.
- `npm test` : **284/284 réussis**, 0 échec, 0 ignoré, code 0, durée 9,796 s.
- `npm run lint` : **PASS**, code 0.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés, code 0.
- `git diff --check` : **PASS**, code 0.

## Correctif complémentaire validé

- La réconciliation regroupe désormais chaque quantité complémentaire avec l'identifiant de son Devis source.
- Un Devis complémentaire accepté mais hors du scope `quote` de l'acteur est entièrement ignoré dans `soldQuantityMilli` : le scénario calcule `1500` avec le Devis principal et le seul complément visible, sans intégrer les `9000` milli-unités cachées.
- Lorsque ce complément caché est ajouté au scope autorisé, la même réconciliation retourne `10500`, démontrant que l'écart provient exclusivement de l'autorité courante et non d'un filtre global appliqué après agrégation.
- Le DTO normalise explicitement les anciennes révisions sans champ `digestVersion` vers la version historique `1`, sans modifier les données persistées.

Les négatifs antérieurs restent verts : unité immuable, version Réservation courante, permission et scope du Devis principal, digest v2 et falsification, RBAC, isolation site, idempotence, versions obsolètes, scope retiré, correction append-only, absence de valeur Finance inventée, migration rejouable et rollback byte-exact privé `0600`.

## Limites non bloquantes

Ce correctif n'affecte pas la structure visuelle de l'interface ; aucun nouveau smoke navigateur n'a été exécuté. Les contrôles UI statiques S7-A restent verts dans les tests ciblés. La performance et la sécurité ont leurs gates indépendants ; S7-B, S7-C et S7-D restent hors périmètre.

Conclusion : le complément accepté hors scope ne contribue plus aux quantités vendues ni aux écarts dérivés. Aucun P0/P1 n'est ouvert sur le candidat exact `27ad4965…`. La re-QA finale S7-A est **APPROVED**.

# Re-QA indépendante S7-A — durcissement du registre du réalisé

Date : 2026-08-23
Commit contrôlé : `e4af056e5203bace13ce09821c80a7dc768cef32` (`fix: harden Sprint 7 actuals ledger`)
Verdict : **APPROVED — 0 P0 / 0 P1**

Ce verdict est limité à S7-A (`US-077` à `US-080`). Il ne vaut pas approbation du Sprint 7 complet ni du Gate G7.

## État exact et environnement

`HEAD` correspondait exactement au commit demandé et le dépôt était propre avant le démarrage des gates concurrents. Environnement : Node `v26.6.0`, macOS/Darwin arm64.

```text
server.js                              c63e5f0465ad7621bed356933e14d8679c8e1a2518ee43ae204ef08a72bf0906
app.js                                 eb2c927f161dfbb45e05942bcda929bb37c8217c133a0913c6a0f0cd58263afa
docs/api/openapi-v1.yaml               59df65fca73f2f80d49c0dca46a6f288a674174bedb1b24b4d581855f75c2352
packages/quote-consumption/index.js    58bba2239793950530f93392794b0e71ac388c9be7670bd2ee70a176afa1f63b
tests/sprint7-actuals.test.js           e9d755f5b58db0df15adc6614492b819aa5aa24452ea3b0c11e6ad47f05f8b75
tests/migration-sprint7.test.js         129f32023259f7eb98d2f845c5cfcd11f28199ba378bcb5b8eff6fbb88e72a94
scripts/benchmark-actuals.js            2f0847a809ac93dbdf018a8ad8ed50a0370301e55b13ba2b5b8a2e0c95916456
package.json                            e4abd8439367918d160015fe87a40006b0b6447a889f209da21f306f1ef41410
```

## Commandes et résultats frais

- `node --test tests/migration-sprint7.test.js tests/sprint7-actuals.test.js` : **13/13 réussis**, 0 échec, 0 ignoré, code 0, durée 0,643 s.
- `npm test` : **283/283 réussis**, 0 échec, 0 ignoré, code 0, durée 9,861 s.
- `npm run lint` : **PASS**, y compris le nouveau benchmark Actuals, code 0.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés, code 0.
- `git diff --check` : **PASS**, code 0.

## Fermeture des risques ciblés

- **Unité** : confirmation et correction refusent désormais toute unité différente de l'instantané planifié avec `422 ACTUAL_UNIT_CONVERSION_REQUIRED`. L'interface rend le champ unité en lecture seule et le contrat OpenAPI explicite l'exigence d'un contrat de conversion versionné.
- **Version courante** : après modification de la Réservation, `GET /reservations/{id}/actual` ne renvoie plus le réalisé de l'ancienne version ; il retourne un état `pending` portant la nouvelle `reservationVersion`.
- **Provenance Devis** : une réalisation liée à un Devis exige `quote.read` et le scope du Devis source, tant pour la file et le détail que pour la confirmation, la correction et les replays. Le négatif couvre permission absente, scope absent et accès autorisé complet.
- **Digest** : les nouvelles révisions utilisent `digestVersion: 2`; le digest protège aussi société, auteurs et horodatages immuables. Une altération de `confirmedAt`, comme une altération de quantité, invalide l'état avec `MIGRATION_MARKER_CONFLICT`. Les révisions v1 historiques restent vérifiables pour compatibilité.

Les preuves antérieures restent également vertes : file dérivée sans écriture, isolation site, exactitude milli-unité, append-only, motif obligatoire, RBAC, valeurs Finance masquées, idempotence, versions obsolètes, scope retiré, audit/événement/métriques, migration rejouable et rollback byte-exact privé `0600`.

## Smoke UI et limites

Un serveur isolé a démarré correctement sur `127.0.0.1:8213`, puis a été arrêté proprement. Le navigateur intégré n'était toutefois plus disponible pour cette re-QA ; aucun résultat visuel n'est revendiqué sur `e4af056e`. Le test ciblé vérifie statiquement la page, le dialogue nommé par `aria-labelledby`, les actions de confirmation/correction et l'unité en lecture seule. Le smoke visuel nominal du candidat précédent reste informatif, pas une preuve sur ce commit.

La mesure de performance du nouveau benchmark et les axes Sécurité/REVIEW appartiennent à leurs gates indépendants. S7-B, S7-C et S7-D restent hors périmètre.

Conclusion : les quatre risques bloquants unité, version courante, provenance Devis et digest sont fermés, sans régression détectée. La re-QA indépendante S7-A est **APPROVED — 0 P0 / 0 P1** sur `e4af056e…`.

# QA indépendante S7-A — registre du réalisé fiable

Date : 2026-08-23
Commit contrôlé : `5c613d3f683b73fd14830ad76e165dfa641f5749` (`feat: add Sprint 7 actuals ledger`)
Verdict : **APPROVED — 0 P0 / 0 P1**

Ce verdict couvre uniquement l'incrément S7-A (`US-077` à `US-080`). Il ne vaut ni approbation du Sprint 7 complet ni approbation G7, qui restent dépendants de S7-B, S7-C, S7-D et des gates aval sur un candidat unique.

## État exact et environnement

Le dépôt était propre au démarrage de la passe et `HEAD` correspondait exactement au commit demandé. Environnement : Node `v26.6.0`, macOS/Darwin arm64.

```text
server.js                              f81919705c8d5522580cc3a279ea56ca18756f399b34ee8e054cd8058e2e929f
app.js                                 9387d6913f1cbe934b61e548908f7015aecd59a175201a39f19e4fa1939a9d6e
index.html                             4ac45df1a1890cb9fe563915a811831dc7ef744a043adceaa4bf6cec1a2b7070
planning.css                           ca36b29e44c81e2befddfa14da335df6cbc50a2410d373b5127d80fbdeaf831f
packages/auth/rbac.js                  068cb8cffb79be89a9c09d0aed81e98e5f971e8d45d4d3f5dfd2d70fdf5ee55b
packages/quote-consumption/index.js    58bba2239793950530f93392794b0e71ac388c9be7670bd2ee70a176afa1f63b
docs/api/openapi-v1.yaml               3a84d89420a734fb663483537abf39a1e4e3229feffdabfb40aa72ad5c607e44
tests/sprint7-actuals.test.js           c94f884fc1f0f7a12ba6797e36f9507a1505d522d5e755509f01e6f3077e22f1
tests/migration-sprint7.test.js         129f32023259f7eb98d2f845c5cfcd11f28199ba378bcb5b8eff6fbb88e72a94
```

## Commandes et résultats frais

- `node --test tests/migration-sprint7.test.js tests/sprint7-actuals.test.js` : **11/11 réussis**, 0 échec, 0 ignoré, code 0, durée 0,572 s.
- `npm test` : **281/281 réussis**, 0 échec, 0 ignoré, code 0, durée 9,035 s.
- `npm run lint` : **PASS**, code 0.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés, code 0.
- `git diff --check` : **PASS**, code 0.

## Critères S7-A validés

- La file des sessions terminées est dérivée sans créer de réalisé, de révision ou d'audit pendant la lecture ; son filtrage par site masque la réservation Boulogne au lecteur Paris.
- La confirmation conserve l'instantané planifié et crée un registre versionné avec une première révision `confirmed`, un digest de source et une chaîne de révisions explicite.
- La correction ajoute une révision `corrected`, conserve la précédente et exige un motif lorsque quantité ou période diffère.
- Le moteur réconcilie vendu, planifié, réalisé, écarts et facturable avec des chaînes d'entiers en milli-unités ; une quantité négative est refusée. Un réalisé non mappé reste opérationnel sans valeur financière inventée.
- Le rejeu idempotent identique ne produit ni nouvelle révision, ni nouvel audit, ni nouvel événement ; un corps divergent retourne `409 IDEMPOTENCY_CONFLICT`.
- Une version Réservation ou Actual obsolète retourne respectivement `409 ACTUAL_SOURCE_STALE` ou `409 VERSION_CONFLICT`, sans écriture partielle.
- Après retrait du scope site, le rejeu d'une confirmation précédemment autorisée retourne `404 NOT_FOUND` et ne duplique pas le registre.
- Un lecteur doté de `actual.read` consulte les quantités mais ne peut ni confirmer ni corriger ; les valeurs Finance restent masquées sans `finance.read`.
- Audit, événement `ActualConfirmed`, invalidation SSE et compteurs techniques sont émis une seule fois après succès.
- La migration additive est rejouable, crée une sauvegarde privée `0600`, refuse un marqueur ou un digest de révision falsifié et restaure les octets sources exactement après export de reprise privé `0600`.
- Le contrat frontend expose la navigation Réalisations, la confirmation et la correction avec libellés explicites.

## Smoke UI déterministe

Serveur isolé lancé sur `127.0.0.1:8213` avec `PLANIFY_DATA_FILE=/private/tmp/planify-s7-a-smoke.json`, puis arrêté proprement.

- Connexion administrateur de démonstration réussie ; page « Réalisations à confirmer » visible avec 3 éléments et aucun historique initial.
- Dialogue natif accessible : début, fin, quantité, unité, motif et actions sont correctement nommés ; le focus initial arrive sur « Début réel ».
- Une confirmation inchangée fait passer la file de 3 à 2 et l'historique de 0 à 1 ; la ligne affiche `Révision 1`, quantité `1 unite`, écart `0 unite`, statut textuel `Conforme` et action `Corriger`.
- Après rechargement puis reconnexion, la révision reste présente : la persistance applicative est démontrée.
- Aucun avertissement ni erreur console n'a été relevé.

## Limites non bloquantes

- Le rechargement du navigateur de smoke a demandé une reconnexion avant de relire la donnée persistée ; la persistance du réalisé est confirmée, mais cette passe S7-A ne qualifie pas la conservation de session navigateur.
- Le smoke couvre le parcours nominal de confirmation. Les erreurs version, RBAC, scope, idempotence et intégrité sont couvertes au niveau API/migration par les tests ciblés, pas répétées visuellement.
- Les seuils volumétriques relèvent du gate Performance indépendant. Les coûts, marges, backlog, forecast, occupation et rentabilité relèvent des incréments S7-B à S7-D.

Conclusion : aucun P0/P1 fonctionnel ou de non-régression n'est ouvert sur S7-A au commit exact `5c613d3…`. Le gate QA indépendant S7-A est **APPROVED**.

# Re-QA ultime indépendante G6 — revalidation multisite

Date : 2026-08-23

Commit contrôlé : `1eab12023a44d65bb9d63dc3bfeba6e04399826f` (`fix: revalidate PlanyBot source sites`)

Verdict : **APPROVED — 0 P0 / 0 P1**

Environnement : Node `v26.6.0`, macOS/Darwin arm64

## État exact et empreintes

Le dépôt était propre au démarrage de la passe et `HEAD` correspondait exactement au commit demandé.

```text
server.js                    d24ef8b32d18ee6b68a9c995d6cbefe6949b26ae3cd24a431e55c5ad2a4e0c84
app.js                       d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54
docs/api/openapi-v1.yaml     0632ef9e0c18adf793e662e883398701146c9a55a7a5fd73801ffe6ecd6a61fb
tests/plany.test.js          c4359eacd062967523a1b0197f8470f40719514bc2239123c3d9c82093c4cc5d
tests/quotes.test.js         16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a
tests/clients.test.js        03ca7a1531a49792dcb1af54147dba2b8dd8b402a02661add6c9c58ac86fb7fe
```

## Commandes et résultats frais

- `node --test tests/plany.test.js` : **14/14 réussis**, 0 échec, 0 ignoré, code 0, durée 0,772 s.
- `node --test tests/plany.test.js tests/quotes.test.js tests/clients.test.js` : **74/74 réussis**, 0 échec, 0 ignoré, code 0, durée 4,832 s.
- `npm test` : **270/270 réussis**, 0 échec, 0 ignoré, code 0, durée 9,071 s.
- `npm run lint` : **PASS**, code 0.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés, code 0.
- `git diff --check` : **PASS**, code 0.
- validation sémantique indépendante de `docs/api/openapi-v1.yaml` : **PASS** — OpenAPI 3.1.0, 46 chemins, 62 schémas, 110 références locales (58 distinctes) toutes résolues, 57 `operationId` uniques et tous les paramètres de chemin valides.

## Correctif multisite validé

- Le résumé d'un Projet contenant des réservations sur Paris et Boulogne est accessible tant que le lecteur conserve les deux sites ; la réponse persiste une garde compacte `scopeGuards.site` en plus des gardes Réservation et Ressource.
- Après réduction du périmètre à Paris uniquement, sans retirer le Projet, le rejeu idempotent du résumé multisite répond `404` et l'historique de sa conversation répond également `404`.
- La réduction de site ne réexpose aucune donnée de Boulogne et ne nécessite pas d'énumérer tous les objets sources dans la provenance.
- Les négatifs antérieurs restent verts : révocation de `quote.read`, réduction des scopes Réservation/Ressource, import ambigu bloqué jusqu'à révision humaine, application exacte sans réservation et provenance bornée à moins de 2 000 caractères dans le scénario représentatif.
- Le contrat OpenAPI est inchangé et non régressé : toutes ses références locales restent résolubles et tous les paramètres de chemin sont requis.

## Limites non bloquantes

Un premier rejeu isolé dans le bac à sable a rencontré `listen EPERM` sur `127.0.0.1`. La même commande, autorisée uniquement à ouvrir un port local éphémère, a ensuite réussi à 14/14 ; le ciblé combiné et la suite complète avaient également réussi. Aucun accès réseau externe n'a été utilisé. Cette passe ne remplace ni l'E2E navigateur ni le gate Performance.

Conclusion : le dernier défaut de revalidation des sites sources est fermé sur le candidat exact `1eab120…`. Le gate QA G6 reste **APPROVED**.

# Re-QA terminale indépendante G6 — provenance compacte et contrat complet

Date : 2026-08-23

Commit contrôlé : `b25c61d085644525c18ce18a7b25d5b9f81c222c` (`fix: bound G6 provenance revalidation`)

Verdict : **APPROVED — 0 P0 / 0 P1**

Environnement : Node `v26.6.0`, macOS/Darwin arm64

## État exact et empreintes

Le dépôt était propre au démarrage de la passe et `HEAD` correspondait exactement au commit demandé.

```text
server.js                    5025a767d5d05bc08a46aab00d8a2302d86838ce4f3f0d5e8cc817cec91a5a7d
app.js                       d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54
docs/api/openapi-v1.yaml     0632ef9e0c18adf793e662e883398701146c9a55a7a5fd73801ffe6ecd6a61fb
tests/plany.test.js          cfd8e782b2a78e00533a3f111337dcb266adcb7dfe91acb67e969e16c79acc58
tests/quotes.test.js         16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a
tests/clients.test.js        03ca7a1531a49792dcb1af54147dba2b8dd8b402a02661add6c9c58ac86fb7fe
```

## Commandes et résultats frais

- `node --test tests/plany.test.js tests/quotes.test.js tests/clients.test.js` : **74/74 réussis**, 0 échec, 0 ignoré, code 0, durée 4,782 s.
- `npm test` : **270/270 réussis**, 0 échec, 0 ignoré, code 0, durée 8,668 s.
- `npm run lint` : **PASS**, code 0.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés, code 0.
- `git diff --check` : **PASS**, code 0.
- validation sémantique indépendante de `docs/api/openapi-v1.yaml` : **PASS** — OpenAPI 3.1.0, 46 chemins, 62 schémas, 110 références locales (58 distinctes) toutes résolues, 57 `operationId` uniques, tous les paramètres de chemin déclarés et requis, 10 chemins G6 présents.

## Scénarios G6 validés

- Une réponse PlanyBot commerciale ou issue d'un planning client conserve `quote.read` dans sa provenance ; son rejeu et son historique répondent `404` après révocation de cette permission.
- Les recommandations qui utilisent une préférence client exigent elles aussi `quote.read` au rejeu et à la lecture.
- Les résumés et recommandations agrégés enregistrent des gardes compactes des scopes Réservation et Ressource. Une réduction de l'un de ces scopes, même si le Projet reste autorisé, rend le rejeu et l'historique inaccessibles.
- La provenance `schemaVersion: 3` est bornée : le scénario représentatif de résumé Projet impose une taille sérialisée strictement inférieure à 2 000 caractères, sans liste proportionnelle aux milliers de ressources ou réservations.
- L'import direct ambigu est refusé avant clarification. La révision humaine est versionnée, une dérive ultérieure est rejetée, puis l'application exacte et idempotente crée uniquement les lignes commerciales attendues, sans réservation Planning.
- Les limites structurelles XLSX refusent l'entrée avec `422 CLIENT_PLANNING_LIMIT_EXCEEDED` sans persister d'import. Les parcours CSV et PDF couverts refusent également les contenus non exploitables et ne créent aucune réservation silencieuse.
- Le contrat OpenAPI couvre Conversation PlanyBot, proposition/confirmation/refus, analyse de planning client, révisions, application contrôlée, prévisualisation et conversion. L'alias `ReservationAllocation` est désormais défini et toutes les références locales sont résolubles.

## Limites non bloquantes

- Cette passe QA ne remplace ni le contrôle navigateur E2E ni les mesures du gate Performance.
- Les tests automatisés exercent explicitement la borne structurelle XLSX. Les chemins CSV/PDF et leur absence de persistance/réservation sont couverts, mais les plafonds volumétriques maximaux propres à chacun ne disposent pas encore d'un cas de dépassement dédié. Cette amélioration de couverture est classée P2 et ne remet pas en cause les invariants G6 démontrés ici.

Conclusion : les anciens P1 de revalidation de provenance, de croissance non bornée et de résolution OpenAPI sont fermés sur le candidat exact `b25c61d…`. Le gate QA G6 est **APPROVED**.

# Re-QA finale indépendante G6 — provenance PlanyBot

Date : 2026-08-23  
Commit contrôlé : `14c1268cfcdcbefdcee8bf7a6be10419ef307f14` (`fix: complete G6 provenance enforcement`)  
Verdict : **NOT APPROVED — OpenAPI sémantiquement incomplet**  
Constats : **0 P0, 1 P1**

## État exact et empreintes

Le dépôt était propre au démarrage de la passe et `HEAD` correspondait au commit demandé.

```text
server.js                    3903abe5d6bf1503dd0102e0fa798f27c8da1a9bae67609ff74eaa85828c1f0c
app.js                       d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54
docs/api/openapi-v1.yaml     5c5da7dfd2ea2911a49432112adaad301eeab5ae63b9d6a9c175cce67a2aba84
tests/plany.test.js          f3f292017f74163b6e30bb1653604d02c51d44860a87f84bf60b55e80b5a3294
tests/quotes.test.js         16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a
tests/clients.test.js        03ca7a1531a49792dcb1af54147dba2b8dd8b402a02661add6c9c58ac86fb7fe
Environnement                Node v26.6.0, macOS/Darwin arm64
```

## Commandes et résultats frais

- `node --test tests/plany.test.js tests/quotes.test.js tests/clients.test.js` : **74/74 réussis**, 0 échec, 0 ignoré, code 0, durée 4,793 s.
- `npm test` : **270/270 réussis**, 0 échec, 0 ignoré, code 0, durée 8,814 s.
- `npm run lint` : **PASS**, code 0.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés, code 0.
- `git diff --check` : **PASS**, code 0.
- parsing YAML OpenAPI 3.1 + vérification des routes G6 + résolution des références locales : **FAIL**, référence locale non résolue `#/components/schemas/ReservationAllocation`.

## Scénarios G6 validés

- Le replay et l’historique d’un résumé de Projet deviennent inaccessibles après réduction du scope Projet.
- Une réponse Commercial/Planning porte `quote.read`; sa relecture est refusée après retrait de cette permission.
- Les identifiants de réservations et ressources utilisés dans les agrégats sont conservés comme provenance ; le replay et l’historique sont refusés après réduction des scopes d’entités correspondants.
- L’import direct ambigu est bloqué avant clarification ; une révision humaine confirmée est historisée, une dérive de libellé est refusée, puis l’application exacte crée une ligne commerciale non planifiée sans réservation et reste idempotente.
- Le dépassement structurel ZIP XLSX retourne `422 CLIENT_PLANNING_LIMIT_EXCEEDED` sans persister de `clientPlanningImport`.
- Les chemins PDF texte exploitable et PDF sans texte exploitable sont couverts sans réservation automatique. Le CSV ambigu est couvert par le parcours de clarification. Les tests disponibles ne déclenchent pas spécifiquement les plafonds volumétriques CSV/PDF ; cette limite non bloquante doit être conservée pour un renforcement futur.
- Les routes G6 Conversation, Analyse, Application de lignes, Prévisualisation et Conversion existent ; les tests vérifient aussi la déclaration obligatoire du paramètre `quoteId`.

## P1 bloquant

`docs/api/openapi-v1.yaml` référence `#/components/schemas/ReservationAllocation` dans `ReservationBatchCreate.resources`, mais aucun schéma `ReservationAllocation` n’est déclaré dans `components.schemas`. Le YAML est syntaxiquement chargeable, mais le contrat ne peut pas être résolu sémantiquement par un consommateur OpenAPI. Le défaut existait déjà dans des candidats antérieurs, mais la re-QA demandée porte sur l’intégralité du contrat livré : il bloque donc le verdict G6.

Condition de déblocage : déclarer le schéma manquant ou remplacer la référence par le schéma canonique approprié, puis rejouer au minimum la validation sémantique OpenAPI, les tests ciblés G6 et `npm test` sur le nouveau commit. Aucun autre P0/P1 n’a été constaté.

Limites : aucune validation navigateur visuelle et aucune mesure de performance dans cette passe ; elles relèvent des gates E2E et Performance.

# Re-QA indépendante G6 — correctifs PlanyBot et import client

Date : 2026-08-23  
Commit contrôlé : `6381cbeb7020d57ac21e2086a3d5475d9d675325` (`fix: close G6 review and security blockers`)  
Verdict : **NOT APPROVED — preuves ciblées vertes, gate QA complète non terminée**  
Constats ouverts : **0 P0, 1 P1 de preuve QA**

## État et empreintes

Le dépôt était propre avant les contrôles et `HEAD` correspondait exactement au commit demandé.

```text
server.js                    458a9c08cb26cc45ecb3613f7d743d996a70100bd4ccbf38416c221bcce29062
app.js                       d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54
docs/api/openapi-v1.yaml     ea5a084ce6ce88fdf252108dac3d865c73506cecd331984fb9dbd5df46c4b83a
tests/plany.test.js          34cbab3d8ffbc55cf961c801eb48ed6a11babace731939848136b9a4db3a7030
tests/quotes.test.js         16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a
Environnement                Node v26.6.0, macOS/Darwin, arm64
```

## Commandes réellement exécutées

- `node --test tests/plany.test.js tests/clients.test.js` : **24/24 réussis**, 0 échec, 0 ignoré, code 0, durée 0,748 s.
- `node --test tests/quotes.test.js` : **49/49 réussis**, 0 échec, 0 ignoré, code 0, durée 4,847 s.
- lecture/parsing du contrat OpenAPI par les tests ciblés : les routes Conversation, Analyse, Application contrôlée, Prévisualisation et Conversion sont présentes.

La re-QA confirme fonctionnellement et négativement :

- un replay idempotent et l’historique d’une conversation deviennent tous deux inaccessibles (`404 NOT_FOUND`) après retrait du Projet inféré du scope du lecteur ;
- l’import direct ambigu est bloqué par `CLIENT_PLANNING_CLARIFICATION_REQUIRED`, la correction humaine produit une révision confirmée, toute dérive est refusée par `CLIENT_PLANNING_REVISION_REQUIRED`, puis l’application exacte ajoute une seule ligne non planifiée, sans réservation et sans doublon au rejeu ;
- une archive XLSX déclarant 257 entrées dépasse la borne, retourne `422 CLIENT_PLANNING_LIMIT_EXCEEDED` et ne crée aucun `clientPlanningImport` ;
- les PDF texte restent analysables sans réservation automatique et un PDF sans texte exploitable est refusé sans réservation ;
- les contrats G6 attendus sont présents dans `docs/api/openapi-v1.yaml` et vérifiés par les assertions de contrat frontend/API.

## P1 de preuve QA restant

La tentative d’ajouter un smoke API indépendant pour les dépassements structurels CSV et PDF a été interrompue par l’environnement avant exécution. Conformément à l’instruction d’arrêt, elle n’a pas été relancée. De plus, la suite complète `npm test`, `npm run lint`, `npm run build` et `git diff --check` n’a pas été rejouée par cet agent après les ciblés. Les résultats DEV antérieurs ne sont pas revendiqués comme preuves QA indépendantes.

Le code expose bien des bornes dédiées pour CSV et PDF, mais leur dépassement sans persistance n’est pas démontré par une preuve indépendante fraîche dans cette passe. Le Gate QA G6 reste donc **NOT APPROVED** jusqu’à l’exécution, sur ce même commit, des deux cas négatifs CSV/PDF et des commandes contractuelles complètes. Aucun défaut fonctionnel P0/P1 n’a été observé dans les 73 scénarios effectivement exécutés.

Limites : aucune validation navigateur visuelle, aucune mesure de performance, aucun test de charge ; ces sujets appartiennent aux gates E2E et Performance.

# Rapport QA indépendant — Organisation 01/01b fiscal, Stock 07a et régression MVP

Date : 2026-08-14  
Verdict : **APPROVED — Organisation 01/01b ciblé et suite complète verts**  
Périmètre candidat : backend Organisation 01 et extension fiscale 01b, régression MVP 0.1 et socle Stock 07a, sans modification applicative par l'agent QA

## Exécution

```text
Commande finale : npm test
Environnement : Node v26.6.0, Darwin 25.5.0 arm64
Source app (SHA-256) : bc7cff11e527652846a162d6fc048cde184b17f3db54f079c1f222f0d58ad1f9
Source serveur (SHA-256) : a5807cf8a3a64d1b28959f78dde741cad453fca79b076746a4ec59b9d00e7d7c
Shell HTML (SHA-256) : 12e47ebf352face70fda1cc83307df1eb40ca62474d0715a7c86448fd6cf46fd
Styles Organisation/Planning (SHA-256) : ed3613392c652c185a69f584235509dbaf167127e06d2ba8094476354e06aeff
Tests domaine (SHA-256) : 33e8ffa09e284a8b55c0c2fd8df8c0a9831b801fef378496f59e59d0fbf01cca
Tests API (SHA-256) : 2e29f3e9a82bfe81c4673bc0c69a374b48425e43bd6a390c861150330189e7e3
Tests Organisation 01/01b (SHA-256) : c6b3a53e8c3d59246dd24909daed9dd17b2b4d5dd5866c3c6af48279a045ba6f
Tests Stock 07a (SHA-256) : 9e2e5997ceb82fc67fb04e2d3497eb2a05c430a077b43cb7ca5509f838599742
Package (SHA-256) : 3f10d6f20f5faf3c70698d7e9edba1393e3c71c52304edd8ad572cf0fd9597cb
Résultat final indépendant communiqué par le gate Security : 82 réussis, 0 échec, 0 ignoré
Code de sortie : 0
```

Commande complète : `npm test` — **82 réussis, 0 échec, 0 ignoré**, résultat indépendant communiqué par le gate Security sur les empreintes ci-dessus. La tentative ciblée locale `node --test tests/organization.test.js` a été empêchée par `listen EPERM`, puis son autorisation hors sandbox a été interrompue ; elle n'est donc pas présentée comme une seconde preuve réussie. `node --check tests/organization.test.js` et `git diff --check` ont réussi sur les fichiers contrôlés.

Node affiche un avertissement expérimental sur l'absence de `--localstorage-file`. Cet avertissement n'affecte pas l'exécution et n'est pas compté comme anomalie fonctionnelle.

Le premier lancement dans la sandbox a été empêché par `listen EPERM`. La validation finale a été exécutée avec l'autorisation d'ouvrir uniquement un serveur HTTP local sur `127.0.0.1` et un port éphémère. Le fichier de données est une fixture temporaire propre au processus ; aucun réseau externe ni fichier de développement n'est utilisé.

## Gate Organisation 01 et extension fiscale 01b

Trente et un scénarios Organisation sont inclus dans la suite complète verte. Ils couvrent notamment :

- migration Organisation v2 → v3 avec sauvegarde exacte, rejeu idempotent et préservation des collections Stock, Ressources, Clients, Projets et Planning ;
- marker additif `foundation-01b-organization-fiscal-v3` unique sans incrément de `schemaVersion`, profils versionnés, collection `vatRates` et absence de duplication d'audit au rejeu ;
- séparation migration/seed : aucun tenant de démonstration injecté dans une base legacy et aucun viewer promu administrateur ;
- seed fiscal déterministe : trois profils français complets, taux `STANDARD` à `rateBps=2000`, taux alternatif modifiable et profil non français sans défaut français injecté ;
- création multi-organisations, complétude O1 calculée serveur, exigences `activityRequirements` et rejet des champs de tenant/alias interdits ;
- blocage `PREREQUISITE_NOT_MET` des ressources, clients, projets et réservations tant que l'organisation reste en brouillon ;
- permissions dérivées des `membershipRoles`/`roles.permissions`, révocation effective, filtrage et mutations par scopes site/unité ;
- transitions suspension/archivage, CRUD rôles et refus de désactivation d'un site référencé sans remplacement ;
- idempotence : rejeu identique, conflit sur payload différent et absence de duplication ;
- profil fiscal avec permissions dédiées, isolation non révélatrice, `version`/`fiscalProfileVersion` et refus de concurrence obsolète ;
- taux TVA en points de base entiers, période/taux futur, refus d'une autorité décimale et protection du taux par défaut ;
- audit attribué au bon tenant avec `requestId` et SSE post-commit sans identifiants légaux/fiscaux ni contacts.
- sauvegarde progressive du territoire/statut fiscal d'une organisation fraîche sans exiger prématurément identifiants ou taux ;
- invalidation des identifiants, du taux par défaut et de la validation lors d'un changement de policy fiscale ;
- maintien de `fiscalValidatedAt=null` après un PATCH de brouillon, puis confirmation exclusive par `validate-stage` et audit dédié ;
- régénération des `activityRequirements` du consommateur actif lors d'un changement d'activités ;
- refus `MIGRATION_MARKER_CONFLICT` lorsque l'`outputDigest` 01b est falsifié tout en restant syntaxiquement un SHA-256 valide.
- confidentialité des DTO : `GET /companies` et `GET /companies/:id` masquent identifiants et métadonnées fiscales même pour un viewer doté de `fiscalProfile.read`, tandis que la route dédiée restitue le profil autorisé.

La régression Organisation 01/01b est **APPROVED** sur l'empreinte ci-dessus : la suite complète indépendante est verte à 82/82. La re-review indépendante du même candidat, consignée dans `docs/code-review.md`, ferme aussi le P1 de confidentialité fiscale.

Limites : l'API et les consommateurs critiques du parcours sont couverts, mais cette passe ne remplace pas un E2E navigateur visuel complet ni la validation d'expérience par le PO. Restent également hors portée : performance volumétrique, rollback après écritures utilisateur et futurs calculs/snapshots immuables du module Devis/Commercial 08. Les tests Devis sur exposants ISO 4217, arrondis, int64 et overflow restent à faire lorsque leurs helpers/contrats exécutables seront publiés.

## Couverture réalisée

- conversion minutes/heures ;
- chevauchement semi-ouvert : adjacent, partiel, inclus, englobant, identique ;
- séparation par date et ressource ;
- exclusion des réservations annulées ;
- validation de l'ordre début/fin ;
- capacité individuelle et pic agrégé ;
- heures actives et période vide ;
- cohérence, relations, valeurs et cas de démonstration du seed v3.

Résultats conformes importants : deux créneaux adjacents ne se chevauchent pas ; les statuts annulés ne consomment pas la capacité ; le dépassement cumulé est détecté ; le seed contient 2 sites, 3 clients, 5 projets, 10 ressources, 5 réservations, les trois statuts attendus, un cas adjacent et un cas annulé.

## Couverture API, intégration et sécurité

Treize scénarios HTTP indépendants valident :

- refus `401 AUTH_REQUIRED` sans session et enveloppe d'erreur avec `requestId` ;
- login administrateur/viewer, cookie `HttpOnly` et `SameSite=Lax`, CSRF et `/auth/me` ;
- refus `CSRF_INVALID` d'une mutation sans jeton ;
- refus serveur `403 FORBIDDEN` d'une mutation viewer malgré une session et un CSRF valides ;
- isolation de site sur les listes et réponse `404` pour un identifiant Boulogne deviné par un viewer limité à Paris ;
- création et lecture canonique d'une réservation ;
- conflit de capacité `409 PLANNING_CONFLICT` avec détails ;
- acceptation d'une réservation exactement adjacente ;
- override motivé et présence du motif/conflit dans l'audit ;
- mise à jour optimiste, refus `409 VERSION_CONFLICT` d'une version obsolète et absence d'écrasement ;
- annulation logique, incrément de version et refus de modification ultérieure ;
- refus `404` de `server.js`, `package.json`, `data/planify.json`, `.env` et d'un chemin encodé ;
- dashboard : fenêtre bornée, 3 heures-capacité réservées sur 4 disponibles, soit 75 %.

Tous ces scénarios réussissent. Les trois échecs observés lors de la première passe HTTP provenaient de fixtures QA qui partageaient un créneau et d'une cible d'isolation incorrecte ; les données de test ont été isolées sans changement des attentes ni du code applicatif. La passe finale ne révèle aucune anomalie API sur ce périmètre.

## Gate Stock 07a

Dix-neuf scénarios nouveaux, exécutés via helpers purs et serveur HTTP/SSE réel sur port local éphémère, valident :

- seed Stock préservé après la chaîne de migration jusqu'à `schemaVersion: 3`, huit articles, douze exemplaires et trois emplacements ;
- grand livre reconstructible, séquences uniques, positions physiques sérialisées et solde XLR déterministe de 20 ;
- obligation d'un emplacement autorisé pour les articles en quantité et les exemplaires ;
- séparation Paris/Boulogne pour un viewer limité à Paris, avec `404 NOT_FOUND` sur une référence hors site ;
- disponibilité d'une demande valide et refus des sources/périodes de réservation forgées ;
- allocation puis libération sans stock réservé négatif ; seconde libération refusée ;
- idempotence HTTP : replay identique sans nouveau mouvement, payload différent avec même clé en `409 IDEMPOTENCY_CONFLICT` ;
- absence de route publique d'ajustement sur le lot 07a (`404`) ;
- maintenance depuis `available` et `quarantine`, contrôles de versions, clôture vers `available` ou `quarantine` et transitions terminales refusées ;
- migration additive v1 → v2 : backup byte-à-byte, collections RC1 conservées, collections Stock initialisées, rejeu sans second backup ni migration dupliquée ;
- RBAC viewer : lecture autorisée, mutations Stock et Maintenance refusées `403` ;
- audit `stockItem.created` attribué à l'administrateur et invalidation SSE `stockItem.updated.v1` effectivement reçue après succès.

### Régressions sécurité Stock

- une origine `https://evil.example` reçoit `403 ORIGIN_INVALID` au login, sans cookie, et sur une mutation authentifiée, sans création ;
- l'origine exacte du serveur loopback est acceptée pour login et mutation ;
- un replay idempotent réussi est revalidé contre le périmètre courant : après perte du site Paris il reçoit `404 NOT_FOUND`, sans identifiant du mouvement antérieur ;
- après restauration du site, le replay autorisé renvoie la réponse idempotente, puis la désactivation de l'acteur produit `401 AUTH_REQUIRED` sans divulguer le résultat antérieur ;
- le stockage idempotent est lié à l'acteur, à la société, à la commande, à la cible, à la clé et au hash du payload ;
- le flux SSE de la session est terminé immédiatement après logout ;
- la désactivation persistée d'un utilisateur termine son SSE par revalidation périodique, sans attendre un événement métier.

La première passe contenait cinq échecs consécutifs à une erreur de fixture QA : le test de rejeu comptait tous les fichiers `*.backup.json` de `/tmp`, puis s'arrêtait avant de restaurer le seed HTTP. Le filtre a été borné au préfixe temporaire propre au processus. Les attentes fonctionnelles n'ont pas changé et la passe complète suivante est verte.

Limites du gate : aucun workflow Rental checkout/return ou inventaire avancé n'est déclaré couvert ; l'ajustement public est au contraire vérifié absent. La performance volumétrique, l'UI Stock et les axes de sécurité non listés ci-dessus conservent leurs gates indépendants.

## Vérification des anomalies précédentes

### QA-001 — Ressource absente ou inconnue

Statut : **CORRIGÉ — test réussi**  
Test : `bookingIssues refuse une ressource absente ou inconnue`

Les ressources vides et inconnues sont désormais refusées.

### QA-002 — Date invalide

Statut : **CORRIGÉ — test réussi**  
Test : `bookingIssues refuse une date invalide`

Les dates vides, mal formées et calendriquement impossibles sont désormais refusées.

### QA-003 — Statut hors catalogue

Statut : **CORRIGÉ — test réussi**  
Test : `bookingIssues refuse les statuts hors catalogue fermé`

Le catalogue fermé `option`, `confirmed`, `cancelled` est désormais validé strictement.

### QA-004 — Quantité invalide

Statut : **CORRIGÉ — test réussi**  
Test : `bookingIssues refuse une quantité non positive, non entière ou non numérique`

Les quantités nulles, négatives, fractionnaires et non numériques sont désormais refusées.

### QA-005 — Taux d'occupation pondéré par quantité/capacité

Statut : **CORRIGÉ — test réussi**  
Test : `occupancy pondère le taux par la quantité réservée et la capacité`

Le taux varie désormais avec la quantité réservée et la capacité disponible.

## Conclusion

Les anomalies domaine antérieures restent corrigées et les régressions MVP/Stock sont vertes. La suite finale indépendante retourne un code 0, avec **82 tests réussis sur 82** et aucun échec communiqué. Le gate QA Organisation 01/01b est **APPROVED** sur les hashes publiés ci-dessus. Aucun verdict global n'est donné pour Performance, Integration, E2E ou Release ; le verdict Security reste porté par son rapport indépendant.

---

# Gate QA indépendant — Commercial 08 · Projet, Budget, Devis et Planning

Date : 2026-08-16  
Verdict : **APPROVED — 32/32 ciblés, 129/129 complets, 0 P0, 0 P1 QA**  
Références : prompt maître Commercial 08 §1–58, `docs/spec-quotes-postproduction.md`, re-REVIEW finale de `docs/code-review.md`  
Indépendance : aucun code applicatif ni test n'a été modifié pendant ce gate ; seul le présent rapport QA est actualisé

## Candidat vérifié

```text
server.js               b948492386cb4eb835bde53877d2346136996893fe58d5bbc4724a8e702559e4
app.js                  77696c3bdc2e4e9fc40d71152b6685d7c96bda77f86cd08efb536385e5d07ce2
planning.css            3f1dc03e58e83dfbbea00a47c57a188e96428fd12ab0fa31f9b9d771831f81be
tests/quotes.test.js    1b950f3cc1b2ff3abdb55d4705acae817ced8e5a57ea775ef8e683de095aa1ef
package.json            3f10d6f20f5faf3c70698d7e9edba1393e3c71c52304edd8ad572cf0fd9597cb
```

Ces empreintes correspondent exactement au candidat `APPROVED` par la re-REVIEW Commercial 08. Aucun fichier de ce candidat n'a changé entre le contrôle des empreintes et les exécutions.

## Commandes et résultats frais

Environnement : Node v26.6.0, Darwin 25.5.0 arm64.

```text
node --check server.js                    succès
node --check app.js                       succès
node --check tests/quotes.test.js         succès
git diff --check                          succès
node --test tests/quotes.test.js          32 réussis, 0 échec, 0 ignoré — 805,93 ms
npm test                                  129 réussis, 0 échec, 0 ignoré — 6 393,59 ms
```

Les tests d'intégration ouvrent uniquement un serveur HTTP loopback sur un port éphémère et utilisent une fixture JSON temporaire. Aucun accès réseau externe n'est requis. L'avertissement Node expérimental relatif à l'absence de `--localstorage-file` ne provoque aucun échec et ne modifie pas le résultat.

## Vérification des 21 priorités MVP

| # | Priorité | Preuve QA |
|---:|---|---|
| 1 | Création Projet | création enrichie et onze statuts bornés via API ; références étrangères refusées |
| 2 | Page Projet | dashboard sans planning testé ; huit onglets et actions inspectés dans le consommateur frontend |
| 3 | Budget sans planning | création dans `budgets`, sans réservation, puis conversion non destructive |
| 4 | Devis sans planning | devis direct et ligne `unplanned` avec `bookingIds=[]` |
| 5 | Catalogue prestations | salles, matériel, prestations et forfaits locaux, avec filtre/recherche côté API/UI |
| 6 | Lignes manuelles | ajout, modification et suppression d'une ligne libre sans Booking |
| 7 | Coût / vente / marge | calculs entiers coût, vente, marge et seuil informatif non bloquant |
| 8 | Rate cards simples | collections et catalogue tarifé ; priorité projet → client → catalogue et manuel tracé |
| 9 | Booking → Project | réservations créées et filtrées par projet ; références tenant/site vérifiées |
| 10 | Projet actif Planning | état et barre Projet actif inspectés ; intention Planning préremplie sans écriture |
| 11 | Sélection multiple Planning | sélection booking/ressource/jour présente ; sélection jour bornée au DOM visible |
| 12 | Clic droit | commandes Commercial du menu et alternative clavier présentes dans le frontend |
| 13 | Planning → nouveau devis | prévisualisation puis création/import sans modification du Planning |
| 14 | Planning → devis existant | import dans un brouillon, refus des documents figés et successeurs disponibles |
| 15 | Regroupement Bookings | prévisualisations `detailed`, `grouped` et `commercial` sans écriture |
| 16 | `QuoteLine → 0..n Booking` | ligne autonome, liaison, déliaison et pluralité conservées |
| 17 | Non/partiel/total | `unplanned`, `partiallyPlanned`, `fullyPlanned` recalculés par le serveur |
| 18 | HT / TVA / TTC | `BigInt`, chaînes décimales, half-up, remises et overflow int64 testés |
| 19 | PDF | PDF local valide, multipage, toutes les lignes, snapshot figé, sans coûts/marges |
| 20 | Versions | snapshots V1/V2 immuables, détail consultable, nouvelle version et avenant distincts |
| 21 | Écarts Planning/devis | sur/sous-planification et actions conditionnées au statut, sans synchronisation silencieuse |

Les trois scénarios de réussite sont couverts au niveau domaine/API : commercial d'abord sans date de réservation, planning d'abord par sélection/import, puis workflow mixte avec complément, double-rattachement contrôlé et écarts. Les contrôles frontend cités sont statiques ; ils ne remplacent pas le parcours navigateur indiqué dans les limites.

## Fermeture QA des neuf P1 de REVIEW

1. La liaison directe refuse le double rattachement inter-document sans confirmation, conserve sa trace d'import/audit et se délie sans toucher au Booking.
2. La sélection tarifaire démontre projet, client, catalogue, taux inactif ignoré, référence étrangère refusée et prix manuel attribué à l'acteur.
3. La conversion Budget → Devis crée un document distinct, conserve le Budget et rejoue la même clé sans doublon.
4. Les remises ligne/document sont calculées en entiers, arrondies half-up et intégrées aux totaux/marges.
5. Les versions ont une séquence croissante et leur route de détail restitue le snapshot attendu sans l'inclure dans la liste.
6. Le PDF multipage reste fondé sur les snapshots fiscal/commercial après modification du Projet vivant ; il inclut remises, conditions et signature et exclut coûts/marges.
7. Un rôle limité à `planning.read` reçoit `403` sur tarifs, rentabilité et liens commerciaux ; les autres cas vérifient isolation société/site non révélatrice.
8. La sélection d'une journée utilise uniquement les bookings réellement visibles dans la grille filtrée.
9. L'acceptation liée exige la liste explicite des bookings ; panneau, déliaison, permissions UI et actions de successeur restent cohérents avec l'autorité serveur.

## Contrats transverses et non-régression

- Migrations additives `commercial-08-quotes-v1`, `commercial-08-project-rates-v2` et `commercial-08-review-p1-v3` présentes une seule fois ; deux lectures successives ne dupliquent ni marqueur ni document.
- RBAC, CSRF, isolation tenant/site, refus non révélateurs, version optimiste, idempotence de création/conversion, audit et SSE restent exercés directement ou par la suite complète.
- Le snapshot fiscal ne change pas après modification du taux Organisation ; aucun taux fiscal libre n'est accepté sur une ligne.
- Import détaillé/regroupé/commercial, corrections contrôlées, liens bidirectionnels et confirmation de double facturation n'altèrent jamais silencieusement le Planning.
- La suite complète confirme l'absence de régression Planning, Organisation, Stock, Matériel, SSE et exposition statique sur ce candidat.

## Limites et observations non bloquantes

- Aucun navigateur n'était requis ou piloté dans cette passe : drag-and-drop réel, clic droit, focus, reflow, rendu du PDF dans un lecteur et parcours bout en bout avec rechargement restent au gate E2E.
- Les deux P2 de la re-REVIEW restent visibles : surbrillance historique possible de la première ligne en plus de `.is-selected`, et focus/restauration du déclencheur du menu contextuel incomplets. Ils ne deviennent pas implicitement corrigés par ce verdict QA.
- Favoris/récents du catalogue et persistance de l'action « ignorer l'écart » sont les reliquats explicitement déclarés hors critères de cette tranche dans la SPEC ; l'ignorance actuelle ne vaut que pour la revue affichée.
- Aucun test de charge, aucune validation visuelle PO, aucun envoi réel de PDF et aucune fonction ERP exclue au §56 ne sont couverts ici.

## Conclusion contrôlante

Le gate QA indépendant Commercial 08 est **APPROVED** sur les empreintes publiées : **32/32 ciblés et 129/129 complets**, sans échec, test ignoré, P0 ou P1 QA ouvert. Ce verdict n'approuve pas les gates Security, Performance, Integration, E2E ou Release, qui doivent porter sur le même candidat. `docs/project-status.md` reste à actualiser par l'intégrateur conformément à la limite de fichiers du mandat.

---

# Gate QA indépendant — Sprint 0 V1 / G0

Date : 2026-08-19  
Verdict : **APPROVED — 14/14 fondations, 188/188 complets, 0 P0, 0 P1 QA**  
Périmètre : fondations G0 décrites dans `docs/specifications/sprint-0-foundations.md`, stratégie `docs/qa/sprint-0-test-strategy.md`, contrat OpenAPI V1 et non-régression RC1.  
Indépendance : aucun code applicatif, test ou contrat n'a été modifié pendant ce gate ; seul le présent rapport QA a été actualisé.

## Candidat vérifié

Environnement : Node.js `v26.6.0`, Darwin `25.5.0` arm64. Exécution UTC : `2026-08-19T14:07Z`.

```text
server.js                                      cc3e6953aecc9b318639222c7277884bb1cb4c0c03a12c6930909f654d945d7d
app.js                                         6223528dbe4ce60dab7790ac7930155d49fb20acded9012a56dd652b2393b440
package.json                                   dd104788950cc0efba05da3964a6703fefe131d37980e76a389fba43d32cde55
docs/api/openapi-v1.yaml                       8ae9568cd8d88b211bf25877d8b8f5a0b0bb3a3267af8b79be3c981c7ff25370
docs/specifications/sprint-0-foundations.md   a3a6d3a1fead3c0a27df5d2003d35fdf0959273bcc00530dc2a71a51088901f4
docs/qa/sprint-0-test-strategy.md              ac19bd298b6841fce636353b28ca44ccebb164fa738e482fa47b7c8a97139e43
tests/foundations.test.js                      de16792a190526b85f5417aa5facdbd5301d5392b389c4c7128e7bc5e44813c5
tests/api.test.js                              6be06af4d451aadb1c5966ea785ee2c5bed99a6c734ef444869d55bb5d8c0f66
tests/domain.test.js                           51e27ac5409756da445e046b91bcacb54767f3a4304b543046d29593bba93076
scripts/generate-performance-dataset.js        a6d498b40e600a067ecabe21dc774319206d66fbdda0984c4d8dd94243b5091a
scripts/benchmark-foundations.js               16894d7ae0996cb3c65b5754877b84e9aa6dba11f609c6df8359f129b5908ceb
```

Les empreintes ont été recalculées après les exécutions et sont restées identiques.

## Commandes et résultats frais

| Commande | Résultat |
|---|---|
| `npm run lint` | PASS, code de sortie 0 |
| `npm run test:foundations` | PASS, 14 réussis, 0 échec, 0 ignoré, 288,62 ms |
| `npm run build` | PASS, 5 actifs runtime vérifiés |
| `npm test` | PASS, 188 réussis, 0 échec, 0 ignoré, 7 148,45 ms |
| `npm run generate:performance-data -- --output /private/tmp/planify-g0-qa-dataset.json` | PASS, fichier déterministe généré |
| Validation YAML via `YAML.safe_load(File.read(...), aliases: true)` | PASS, OpenAPI 3.1.0, 16 chemins, 5 schémas |
| Smoke `PLANIFY_DATA_FILE=/private/tmp/planify-g0-qa-smoke.json PORT=8197 npm start` | Non comptabilisé : ouverture du port refusée par la sandbox (`listen EPERM`) puis demande d'autorisation interrompue ; aucun processus n'est resté actif |

Dataset QA : 250 ressources, 10 000 réservations, 5 sites, 40 projets, six mois civils (`2026-01-01` à `2026-06-30`), 10 000 identifiants uniques, toutes les réservations liées à une société, un site, un projet et au moins une allocation. SHA-256 : `8bbce6126ce004a72f4ae1207e38f64c36f0e72cfe88e2bf629213a24e5d7b3f`.

## Couverture G0 observée

- démarrage et intégration HTTP couverts par la suite complète sur serveurs loopback éphémères ; frontend et cinq actifs runtime vérifiés par le build ; persistance temporaire isolée par test ;
- migration additive du catalogue RBAC : sauvegarde, rejeu idempotent, refus d'altération et sept rôles V1 fermés ;
- authentification, cookie défensif, CSRF, Origin, permissions, révocation, périmètres société/site et masquage `404` hors scope ;
- erreurs stables et corrélées par `error_id`/`requestId`, réponses 401/403/404/409/422 et absence d'exposition des fichiers serveur/données ;
- version optimiste et absence d'écrasement sur version obsolète ; création de réservation exigeant une clé d'idempotence, rejeu identique sans doublon et conflit sur payload différent ;
- audit après mutation, motif d'override, journal d'événements persisté, séquencé, tenant-scopé et rejouable ; SSE fermé après logout ou révocation ;
- intervalles semi-ouverts, capacité, jours ouvrés/week-ends/jours fériés et passages heure d'été/hiver ;
- métriques techniques protégées exposant requêtes, latence, erreurs, SSE et événements ; logs JSON corrélés observés pendant la suite ;
- moteurs Scheduling, Pricing et QuoteConsumption : capacité, priorité projet > client > catalogue, vendu immuable et dépassement séparé ;
- migrations, seed et non-régression des modules existants exercés par les 188 scénarios.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test n'est en échec, annulé, ignoré ou marqué TODO.
- **P2-QA-G0-01 — smoke manuel non reproduit dans cette passe.** La sandbox a refusé l'ouverture directe du port 8197 et l'autorisation élargie a été interrompue. Le risque fonctionnel est réduit par les nombreux tests HTTP réels sur ports loopback éphémères et par le build vert, mais le smoke manuel frontend/login/persistance doit être rejoué au gate INTEGRATION sur le même candidat.
- **P2-QA-G0-02 — état Git non figé.** `git status --short` présente l'ensemble du dépôt comme non suivi. Les empreintes ci-dessus identifient précisément le candidat QA, mais l'intégrateur doit le figer avant INTEGRATION/RELEASE afin de démontrer qu'aucun fichier étranger n'a été ajouté entre les gates.
- Cette passe ne constitue ni une validation visuelle navigateur, ni une mesure de performance API/UI, ni une revue de sécurité indépendante. Ces responsabilités restent aux gates correspondants.

## Conclusion contrôlante

Le gate QA indépendant Sprint 0 / G0 est **APPROVED** sur le candidat identifié par les empreintes publiées : **14/14 tests de fondation et 188/188 tests complets réussis**, avec zéro P0/P1 QA. Le Sprint 1 reste soumis aux verdicts REVIEW, SECURITY/PERFORMANCE et à l'intégration du même candidat. `docs/project-status.md` reste à actualiser par l'intégrateur conformément au mandat limité à `docs/qa-report.md`.

---

# Re-QA indépendante — Sprint 0 V1 / G0 corrigé

Date : 2026-08-19  
Verdict : **APPROVED — 14/14 fondations, 25/25 API ciblés, 10/10 Planning ciblés, 192/192 complets, 0 P0, 0 P1 QA**  
Effet : ce verdict remplace, pour G0, la passe QA précédente à 188 tests. Il porte sur le candidat corrigé après REVIEW.  
Indépendance : aucun code applicatif, contrat ou test n'a été modifié pendant cette re-QA ; seul `docs/qa-report.md` a été actualisé.

## Candidat corrigé vérifié

Environnement : Node.js `v26.6.0`, Darwin `25.5.0` arm64. Début de contrôle UTC : `2026-08-19T15:08:58Z`.

```text
server.js                                  bac0e36fd49d5b2e1e42fd1616e2a8b2f782f27bb2dc32fa99017ce65fcbbff5
app.js                                     a2ce1f6adda4e73f538fc7ce37f414454b33cb0c484ebc96f21a6fdf11c6649c
package.json                               888e8da5acbfd708bab24a59dc38e4c7f48d4fa6fc07e77428b0411d2c663a28
docs/api/openapi-v1.yaml                   fb8dcb1660a81531dc7426ab2f059617fee25794daed222dc7c533d5398fb2fc
tests/foundations.test.js                  60bb30ee26ad208b3fe2bd8aecd58364f44342eedd6f3beede1a50cbf95c029a
tests/api.test.js                          f197ebbdf1febae200a8375a98b303af5b63f39db4e9164fd16cedf9ff4a8ef2
tests/planning-postproduction.test.js      471e2b606139f55bcb1cc0c6c18a7a936e4ce005495147f006c3ffd75d76795b
```

Les empreintes ont été recalculées après toutes les exécutions et sont restées identiques.

## Commandes et preuves fraîches

| Commande | Résultat |
|---|---|
| `npm run lint` | PASS, code de sortie 0 ; inclut runtime, packages et scripts de benchmark/preview |
| `npm run test:foundations` | PASS, 14 réussis, 0 échec/skip/todo, 289,35 ms |
| `node --test tests/api.test.js` | PASS, 25 réussis, 0 échec/skip/todo, 604,80 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, 10 réussis, 0 échec/skip/todo, 79,04 ms |
| `npm run build` | PASS, 5 actifs runtime vérifiés |
| `npm test` | PASS, 192 réussis, 0 échec/skip/todo, 7 265,10 ms |
| `YAML.safe_load(File.read('docs/api/openapi-v1.yaml'), aliases: true)` | PASS syntaxique : OpenAPI 3.1.0, 21 chemins, 8 schémas |
| Contrôle ciblé OpenAPI | PASS : conflits Planning, occupation, rates, `ReservationPatch`, ressources et exemples présents |

L'avertissement expérimental Node relatif à l'absence de `--localstorage-file` pendant le test Planning n'affecte ni les assertions ni le code de sortie.

## Fermeture QA des corrections G0

- **OpenAPI vers runtime** : les exemples de création et de mise à jour de réservation sont exécutés contre l'API réelle ; création `201`, mise à jour `200`. Le contrat parse correctement et couvre les routes G0 ajoutées.
- **Idempotence mutation** : la création exige une clé, rejoue sans doublon et refuse un payload divergent ; le `PATCH` réservation rejoue exactement une seule mutation/audit et renvoie `409` pour un contenu différent.
- **Scopes projet et entité** : après réduction du scope d'un viewer, listes projets/ressources filtrées et accès direct au dashboard/réservation hors scope masqués en `404`.
- **Audit canonique** : réservation, projet, ressource et client exposent acteur, société, cible, avant/après, versions et identifiant corrélé ; les données sensibles sont nettoyées récursivement.
- **Temps et fenêtre Planning** : intervalles semi-ouverts, capacité, quantité, week-ends et DST restent verts ; la fenêtre visible est rechargée lors de la synchronisation et la vue projet reste distincte du projet de création.
- **RBAC et observabilité** : sept rôles fermés, refus 403, isolation non révélatrice, journal d'événements tenant-scopé, métriques protégées et SSE révoqué sont confirmés.
- **Non-régression** : les 192 scénarios complets couvrent aussi Organisation, Ressources, Clients, Stock, Commercial, Planning et PlanyBot sans échec.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun scénario exécuté n'est en échec, annulé, ignoré ou TODO.
- **P2-QA-G0-02 maintenu — candidat Git non commité.** Le dépôt initialisé ne possède toujours pas de baseline suivie (`git status` présente les sources comme non suivies). Les empreintes ci-dessus figent sans ambiguïté le candidat re-QA, mais l'intégrateur doit créer le point de référence avant INTEGRATION/RELEASE afin de garantir que tous les gates aval portent sur ces mêmes octets.
- Cette re-QA ne remplace pas le contrôle visuel navigateur ni les mesures Performance/Security indépendantes. Le test Planning ciblé vérifie la fenêtre visible au niveau logique/frontend, pas le rendu pixel ou l'interaction humaine.

## Conclusion contrôlante

Le candidat corrigé Sprint 0 / G0 est **APPROVED au gate QA indépendant** : **14/14 fondations, 25/25 API ciblés, 10/10 Planning ciblés et 192/192 complets**, zéro P0/P1 QA. La correction des écarts OpenAPI/runtime, idempotence `PATCH`, scopes projet/entité, audit canonique et fenêtre Planning est démontrée par des scénarios négatifs et positifs réels. `docs/project-status.md` reste à actualiser par l'intégrateur conformément au mandat limité à ce rapport.

---

# Re-QA finale — candidat G0 figé

Date : 2026-08-19  
Verdict : **APPROVED — 14/14 fondations, 26/26 API ciblés, 10/10 Planning ciblés, 193/193 complets, 0 P0, 0 P1 QA**  
Effet : ce verdict final remplace les deux passes QA G0 précédentes et porte exclusivement sur le dernier candidat corrigé.  
Indépendance : aucun code, contrat ni test n'a été modifié ; seul le rapport QA a été complété.

## Empreintes du candidat

Environnement : Node.js `v26.6.0`, Darwin `25.5.0` arm64. Début UTC : `2026-08-19T15:43:32Z`.

```text
server.js                                  da1e4ec8d01279e52043cf846c4f3b94daeb4289c823a112b0a1839190a0ec69
app.js                                     a2ce1f6adda4e73f538fc7ce37f414454b33cb0c484ebc96f21a6fdf11c6649c
package.json                               888e8da5acbfd708bab24a59dc38e4c7f48d4fa6fc07e77428b0411d2c663a28
docs/api/openapi-v1.yaml                   bd171012cc0018384d3c3a35ffc5ff639fd1edb27697bd6d14feda36d7aeeae8
tests/foundations.test.js                  c8e35fa6e621e815cc2ef7c417037a23fc6848386d5ac864a302745acbbec426
tests/api.test.js                          23f32d7c96849c2e7b63c3c8722ae90e1b075f66140b298f9044a2fb0205d4ef
tests/planning-postproduction.test.js      471e2b606139f55bcb1cc0c6c18a7a936e4ce005495147f006c3ffd75d76795b
```

Les empreintes ont été recalculées après la suite complète et sont restées identiques.

## Preuves fraîches finales

| Commande | Résultat |
|---|---|
| `npm run lint` | PASS, code 0 |
| `npm run test:foundations` | PASS, 14/14, 0 échec/skip/todo, 290,53 ms |
| `node --test tests/api.test.js` | PASS, 26/26, 0 échec/skip/todo, 615,47 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, 10/10, 0 échec/skip/todo, 82,18 ms |
| `npm run build` | PASS, 5 actifs runtime |
| `npm test` | PASS, 193/193, 0 échec/skip/todo, 7 183,21 ms |
| Chargement YAML strict | PASS : OpenAPI 3.1.0, 21 chemins, 9 schémas |

## Vérifications contrôlantes

- Les exemples OpenAPI réservation sont exécutables contre le runtime : création et mise à jour réussissent avec les formats documentés.
- Création, modification et archivage de réservation/ressource rejouent une opération identique sans doublon ; une réutilisation divergente retourne `409`.
- Création et modification de rôle sont idempotentes, versionnées et auditées avec état avant/après.
- La mise à jour des scopes d'une adhésion est rejouable ; les scopes projet et entité filtrent listes, dashboard, réservation, liens commerciaux, catalogue devis, contacts et tarifs, avec masquage `404`.
- Quatre mutations critiques — réservation, projet, ressource et client — exposent un audit canonique reconstructible ; les secrets sont supprimés récursivement.
- Les intervalles semi-ouverts, capacité, week-ends, changements d'heure et fenêtre Planning visible restent verts ; le déplacement d'une cellule n'altère pas sa série.
- La suite complète confirme auth, CSRF/Origin, RBAC, isolation société/site, version optimiste, événements rejouables, SSE, observabilité, migrations et non-régression des modules existants.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test en échec, annulé, ignoré ou TODO.
- Le contrôle visuel navigateur et la validation produit ne sont pas inclus dans cette re-QA technique.
- L'état Git initial sans commit de référence demeure une responsabilité d'intégration : les hashes ci-dessus figent le candidat QA, mais l'intégrateur doit créer/garantir le point de référence commun aux gates aval.

## Verdict terminal QA

Le gate QA indépendant du candidat G0 final est **APPROVED** : **14/14 fondations, 26/26 API ciblés, 10/10 Planning ciblés et 193/193 tests complets**, sans P0/P1. Les scénarios positifs et négatifs démontrent OpenAPI/runtime, idempotence et replay divergent, scopes projet/entité, audits canoniques et non-régression. `docs/project-status.md` reste à mettre à jour par l'intégrateur.

---

# Re-QA ultime — G0 avec SSE fail-closed et occupation scopée

Date : 2026-08-19  
Verdict : **APPROVED — 14/14 fondations, 27/27 API ciblés, 10/10 Planning ciblés, 194/194 complets, 0 P0, 0 P1 QA**  
Effet : ce verdict remplace le verdict QA G0 à 193 tests et porte sur le candidat intégrant les deux dernières corrections de sécurité fonctionnelle.  
Indépendance : aucun code, contrat ou test n'a été modifié ; seul `docs/qa-report.md` a été complété.

## Empreintes contrôlées

Environnement : Node.js `v26.6.0`, Darwin `25.5.0` arm64. Début UTC : `2026-08-19T15:54:04Z`.

```text
server.js                                  ae82955eb0b3862adec16396b9e6e3377c6db861e526f4fdc4ef0fd66bf0383f
app.js                                     a2ce1f6adda4e73f538fc7ce37f414454b33cb0c484ebc96f21a6fdf11c6649c
package.json                               888e8da5acbfd708bab24a59dc38e4c7f48d4fa6fc07e77428b0411d2c663a28
docs/api/openapi-v1.yaml                   bd171012cc0018384d3c3a35ffc5ff639fd1edb27697bd6d14feda36d7aeeae8
tests/foundations.test.js                  c8e35fa6e621e815cc2ef7c417037a23fc6848386d5ac864a302745acbbec426
tests/api.test.js                          189c4872bab0e7f9ea4b607d5293654583cbef0c504471a5daa465df5c58d6f3
tests/planning-postproduction.test.js      471e2b606139f55bcb1cc0c6c18a7a936e4ce005495147f006c3ffd75d76795b
```

Toutes les empreintes sont restées identiques après la suite complète.

## Résultats frais

| Commande | Résultat |
|---|---|
| `npm run lint` | PASS, code 0 |
| `npm run test:foundations` | PASS, 14/14, 0 échec/skip/todo, 288,95 ms |
| `node --test tests/api.test.js` | PASS, 27/27, 0 échec/skip/todo, 626,23 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, 10/10, 0 échec/skip/todo, 80,52 ms |
| `npm run build` | PASS, 5 actifs runtime |
| `npm test` | PASS, 194/194, 0 échec/skip/todo, 7 501,07 ms |
| Chargement YAML strict | PASS : OpenAPI 3.1.0, 21 chemins, 9 schémas |

## Contrôles négatifs des dernières corrections

- **SSE fail-closed** : une famille d'événement inconnue est refusée par défaut ; seules les familles reconnues sont diffusées après réévaluation des permissions et scopes. Le scénario ciblé réussit sans publication permissive de repli.
- **Dashboard occupation scopé** : après réduction des scopes projet/entité d'un viewer, le dashboard d'occupation répond sans exposer de ressource interdite ; les accès directs hors projet/entité restent masqués en `404`.
- Les régressions idempotence restent vertes pour réservation, archivage de ressource, rôles et scopes : replay identique sans duplication, divergence en `409`.
- Les audits projet, ressource, client, réservation et rôles conservent avant/après, acteur, tenant et corrélation ; l'état hors scope n'est pas révélé.
- OpenAPI/runtime, fenêtre Planning, temporalité, RBAC, Origin/CSRF, journal d'événements, révocation SSE et fichiers statiques sensibles restent verts.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test en échec, annulé, ignoré ou TODO.
- L'avertissement expérimental Node sur `localStorage` dans le test Planning n'altère pas les assertions.
- Le contrôle visuel navigateur et la création du point de référence Git commun restent au gate INTEGRATION/E2E.

## Verdict terminal

Le gate QA indépendant du dernier candidat G0 est **APPROVED** : **14/14 fondations, 27/27 API ciblés, 10/10 Planning ciblés et 194/194 tests complets**, zéro P0/P1. Les corrections SSE fail-closed et dashboard occupation borné aux scopes sont confirmées par des scénarios négatifs dédiés. `docs/project-status.md` reste à mettre à jour par l'intégrateur.

---

# Re-QA finale — diff E2E frontend G0

Date : 2026-08-19  
Verdict : **APPROVED — 15/15 fondations, 27/27 API ciblés, 10/10 Planning ciblés, 195/195 complets, 0 P0, 0 P1 QA**  
Effet : ce verdict remplace la passe QA G0 à 194 tests et couvre le candidat incluant le nouveau parcours frontend de création de ressource.  
Indépendance : aucun code applicatif, contrat ou test n'a été modifié ; seul `docs/qa-report.md` a été complété.

## Candidat contrôlé

Environnement : Node.js `v26.6.0`, npm `11.18.0`, Darwin arm64. Contrôle exécuté le 2026-08-19 à partir de 20:06 UTC.

```text
server.js                                  ae82955eb0b3862adec16396b9e6e3377c6db861e526f4fdc4ef0fd66bf0383f
app.js                                     ad22b4fa21665fd7e58cf24e7244d73a6adeb06dd794521b93c7e8da9d5395fe
planning.css                               7aadb6a01b7bbf33edc8ac449ac184b44a37ff54e6b5c77ee57aad7ed4e1c060
package.json                               888e8da5acbfd708bab24a59dc38e4c7f48d4fa6fc07e77428b0411d2c663a28
docs/api/openapi-v1.yaml                   bd171012cc0018384d3c3a35ffc5ff639fd1edb27697bd6d14feda36d7aeeae8
tests/foundations.test.js                  39ff84e17e382533d27b94129841ae644ba335b7f5b0cb5616a49413a3f3e632
tests/api.test.js                          189c4872bab0e7f9ea4b607d5293654583cbef0c504471a5daa465df5c58d6f3
tests/planning-postproduction.test.js      471e2b606139f55bcb1cc0c6c18a7a936e4ce005495147f006c3ffd75d76795b
```

Les empreintes ont été recalculées après les exécutions et correspondent au candidat annoncé par l'intégration.

## Preuves fraîches

| Commande | Résultat |
|---|---|
| `npm run lint` | PASS, code 0 ; syntaxe backend, frontend, packages et scripts vérifiée |
| `npm run test:foundations` | PASS, 15/15, 0 échec/skip/todo, 286,66 ms |
| `node --test tests/api.test.js` | PASS, 27/27, 0 échec/skip/todo, 624,15 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, 10/10, 0 échec/skip/todo, 78,08 ms |
| `npm run build` | PASS, 5 actifs runtime vérifiés |
| `npm test` | PASS, 195/195, 0 échec/skip/todo, 7 349,39 ms |
| `YAML.safe_load(File.read('docs/api/openapi-v1.yaml'), aliases: true)` | PASS : OpenAPI 3.1.0, 21 chemins, 9 schémas |

Le premier lancement ciblé API dans la sandbox a produit 27 erreurs d'infrastructure identiques `listen EPERM` avant les assertions. La commande a été immédiatement rejouée avec l'autorisation loopback prévue et a réussi 27/27 ; ces erreurs de sandbox ne sont donc pas comptabilisées comme défauts produit.

## Vérification du diff E2E frontend

- Le nouveau test de fondation « le bouton de création de ressource reste branché après composition des modules frontend » est présent et vert. Il vérifie le branchement `[data-add="resources"]`, l'ouverture du tiroir dédié et la transmission d'une `Idempotency-Key`.
- La lecture ciblée du frontend confirme un formulaire structuré — nom, type, site, capacité et couleur — qui remplace l'ancien dialogue ponctuel, recharge les ressources après création et n'affiche le succès qu'après réponse API réussie.
- Le tiroir est défilable sur toute sa hauteur, ses en-tête et actions restent positionnés, et la barre latérale utilise un défilement vertical borné ; ces contrats sont cohérents avec la correction documentée pour une hauteur d'écran de portable.
- Le parcours documenté dans `docs/project-status.md` est cohérent avec les contrats contrôlés : Client puis Projet et Ressource, réservation exigeant un projet, filtres Projet/Ressource, cellule Planning visible et persistance après rechargement. Les tests API démontrent la création/lecture canonique de réservation et le refus sans projet ; les tests Planning démontrent fenêtre visible, vue projet, cellules quotidiennes et déplacement unitaire ; la suite complète couvre les mutations Client/Projet/Ressource et la persistance atomique.
- Non-régression confirmée sur auth, CSRF/Origin, RBAC et scopes, idempotence/replay divergent, audit, SSE fail-closed, occupation scopée, temporalité Planning et modules historiques.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test réellement exécuté n'est en échec, annulé, ignoré ou TODO.
- Le parcours navigateur déterministe est une preuve du gate INTEGRATION/E2E consignée dans `docs/project-status.md`. Cette re-QA en vérifie la cohérence avec le code et les tests, mais ne constitue pas une seconde exécution visuelle indépendante du navigateur.
- Le dépôt demeure sans baseline Git suivie (`git status --short` liste les sources comme non suivies). Les empreintes ci-dessus figent le candidat QA ; l'intégrateur doit garantir le même état pour la clôture G0.
- L'avertissement expérimental Node relatif à `localStorage` pendant le test Planning n'affecte ni les assertions ni le code de sortie.

## Verdict terminal QA

Le gate QA indépendant du candidat G0 avec diff E2E frontend est **APPROVED** : **15/15 fondations, 27/27 API ciblés, 10/10 Planning ciblés et 195/195 tests complets**, zéro P0/P1. Le branchement de création de ressource, son idempotence et la non-régression Client/Projet/Ressource/Réservation sont démontrés ; la cohérence du parcours navigateur et de sa persistance est confirmée par les contrats et les preuves d'intégration documentées. `docs/project-status.md` reste à actualiser par l'intégrateur conformément au mandat limité à ce rapport.

---

# Gate QA indépendant G1 — Données métier et fondation analytique

Date : 2026-08-20  
Verdict : **APPROVED — 8/8 Sprint 1 ciblés, 15/15 fondations et 203/203 complets ; 0 P0, 0 P1 QA**  
Périmètre : S1-A Référentiels, S1-B Tarification, S1-C Recherche et S1-D Analytics du candidat G1  
Indépendance : aucun code, test ou contrat applicatif modifié pendant ce gate ; seul `docs/qa-report.md` est actualisé

## Candidat vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0 arm64`. Le dépôt ne possède pas de commit `HEAD` et tous les fichiers sont encore non suivis ; le candidat est donc figé par les empreintes SHA-256 suivantes :

```text
server.js                         0d4403f2b8dfd4974db1683f72d45dcf99ece4e8577603cce2255e3a0f2936c9
app.js                            e7eabad40b1bb1c1cc574097652488cc7fcf56d7cfb1e25ad0dc5fc097a1013f
index.html                        ce2e0071d088532ff0fe4189ad49f96d9b58a175986f405f5196807f097fbe05
styles.css                        96cc14de05ba6d6c4aa8569829619c5029d898a3057a10f85c52e7f619a72b37
packages/pricing/index.js         6e458205e7c3bc8753e6aceb1ff24734c941fab0e364161ad0ad93f997b3a64a
docs/api/openapi-v1.yaml          ae7306d63e6c44b6c162d95e6bbc5272a0e8038ccf776f6efad3cdac02a4850a
tests/sprint1-data.test.js        5253e5d1727bdb29e3b707f180adca3ab616bae22254591fc256399592bee33d
tests/foundations.test.js         6f22b1d604a9679c222300313b29a7c81d47379411be1d2ecddad59fe6ba74a1
package.json                      abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

## Commandes et résultats frais

| Commande | Résultat observé |
|---|---|
| `node --test tests/sprint1-data.test.js` | PASS, **8/8**, 0 échec/annulé/ignoré/TODO, 614,29 ms |
| contrôle de rejeu `readDb()` sur fixture `/private/tmp` | PASS : `sprint-1-referentials-v1`, `sprint-1-pricing-v1` et `sprint-1-analytics-v1` restent chacun à **1 marqueur** après deux lectures |
| `npm run lint` | PASS, code 0 ; syntaxe du runtime, des packages et des scripts vérifiée |
| `npm run build` | PASS, code 0 ; 5 actifs runtime vérifiés |
| `node --test tests/foundations.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 320,51 ms |
| contrôle statique ciblé `docs/api/openapi-v1.yaml` | PASS : routes Rate cards, Rates, Search, Analytics Dimensions et Revenue Chain, schéma `RevenueChainResponse` et version `revenue-chain-g1-v1` présents |
| `git diff --check` | PASS, code 0 |
| `npm test` | PASS, **203/203**, 0 échec/annulé/ignoré/TODO, 8 006,48 ms |

Les tests HTTP utilisent seulement un serveur loopback éphémère et des fixtures temporaires. Aucun accès réseau externe ni donnée de travail n'est requis. Le contrôle de rejeu supprime sa fixture et ses sauvegardes temporaires à la fin.

## Couverture fonctionnelle G1

### S1-A — Référentiels

- migration additive présente, intègre et rejouable sans duplication ; statut historique conservé et `lifecycleStatus` canonique ajouté ;
- création de prestation structurée et refus `422` d'une prestation planifiable dépourvue de compatibilité ;
- création Projet avec responsabilités/références validées, transition canonique historisée et transition aléatoire refusée en `409` ;
- non-régression Client, contacts, sites, ressources et isolation société/site incluse dans la suite complète.

### S1-B — Tarification

- tarifs versionnés avec périodes semi-ouvertes et refus des chevauchements actifs ;
- résolution déterministe `projet > client > catalogue`, vérifiée aussi par le moteur de fondation ;
- remise et majorations nuit/week-end calculées sans flottant d'autorité ;
- snapshot tarifaire figé sur la ligne commerciale ;
- ligne sans tarif admise en brouillon puis envoi/acceptation finale bloqué par `COMMERCIAL_MISSING_RATES` ;
- la suite complète couvre en complément imports tarifaires Client, saisie manuelle autorisée et motivée, concurrence, int64 et immutabilité des documents historiques.

### S1-C — Recherche universelle

- validation des bornes de requête, des types et de la limite ;
- six familles recherchées : Client, Projet, Devis, Ressource, Personne et Prestation ;
- permissions et scopes appliqués avant restitution ; les coordonnées email/téléphone des contacts ne sont pas exposées ;
- la mesure de latence volumétrique relève du gate Performance séparé et n'est pas déduite de cette QA fonctionnelle.

### S1-D — Analytics et chiffre d'affaires

- routes Dimensions et Revenue Chain protégées par `finance.read` ; le viewer sans permission reçoit `403` ;
- Budget, Devis et Signé sont réconciliés depuis leurs versions/snapshots actifs ; seul le Devis accepté alimente `signed` ;
- les neuf dimensions `date`, `clientId`, `projectId`, `serviceOfferingId`, `resourceId`, `siteId`, `legalEntityId`, `salesOwnerId` et `userId` sont filtrées et groupées ;
- `planned`, `actual`, `billable`, `invoiced` et `collected` restent explicitement indisponibles, sans zéro inventé ;
- une nouvelle version remplaçante retire la reconnaissance signée de la version remplacée et évite le double comptage ;
- une ligne hors scope ne reporte jamais son montant sur une ligne analytique visible ;
- les agrégats restent groupés par devise et utilisent le HT sans conversion implicite.

## Contrat OpenAPI et non-régression

Le contrat OpenAPI publie les routes et schémas G1 attendus. La suite complète verte conserve les garanties historiques d'authentification, CSRF/Origin, RBAC et scopes, idempotence, audit, SSE, Client/Projet/Devis, Planning, Stock, Maintenance et persistance atomique. Aucun test n'a été désactivé ou assoupli pendant le gate.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun résultat exécuté n'est rouge, annulé, ignoré ou TODO.
- Cette QA valide les contrats fonctionnels et la non-régression, mais ne remplace pas les gates indépendants REVIEW, SECURITY, PERFORMANCE, INTEGRATION ou E2E navigateur.
- Les contrôles visuels de la recherche et des futurs écrans analytiques restent à porter par l'E2E/validation produit ; le Sprint 1 expose principalement les fondations API.
- L'absence de baseline Git suivie empêche d'attacher le verdict à un commit immuable. Les empreintes ci-dessus sont l'autorité du présent rapport ; toute modification exige une nouvelle QA.
- Conformément au mandat limité, `docs/project-status.md` reste à actualiser par l'intégrateur.

## Verdict terminal QA G1

Le gate QA indépendant G1 est **APPROVED** sur le candidat empreinté ci-dessus : **8/8 tests Sprint 1 ciblés, 15/15 fondations et 203/203 tests complets**, lint/build/OpenAPI/rejeu des migrations verts, zéro P0/P1 QA. Ce verdict ne vaut que pour cet état exact et ne préjuge pas des verdicts REVIEW, SECURITY, PERFORMANCE, INTEGRATION, E2E ou RELEASE.

---

# Re-QA indépendante G1 — candidat corrigé après SEC-G1-02

Date : 2026-08-20  
Verdict : **CHANGES REQUIRED — 0 P0, 2 P1 QA malgré 12/12 ciblés et 207/207 complets**  
Périmètre : fermeture des six P1 initiaux G1 et du constat sécurité SEC-G1-02  
Indépendance : aucun code, test ou contrat modifié ; seul `docs/qa-report.md` est actualisé

## Candidat vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0 arm64`. Le dépôt ne possède toujours pas de commit `HEAD` ; le candidat est figé par empreintes :

```text
server.js                         fe7e034b83cae5c78589f2c880f772877244a7b112c81cd56314107de8585923
app.js                            10d2bae71697f94bd7e9c0373957e4f5e41e0f96a2c06099a93add5fa38acc82
docs/api/openapi-v1.yaml          b89516da6101806c96e9f4a2655b56e0d7ed2a3d9e55fa06b455f73c1d40966a
tests/sprint1-data.test.js        a9ac012e9e07e502ea2406b7a9f694aff102bceed27b3bd07725e3c65ed680e1
tests/foundations.test.js         6f22b1d604a9679c222300313b29a7c81d47379411be1d2ecddad59fe6ba74a1
package.json                      abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

Le candidat intermédiaire `server.js c89640b4…` n'a reçu aucun verdict : il a été remplacé avant la fin de sa QA par la correction SEC-G1-02.

## Preuves fraîches

| Commande | Résultat |
|---|---|
| `node --test tests/sprint1-data.test.js` | PASS, **12/12**, 0 échec/annulé/ignoré/TODO, 713,31 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, 5 actifs runtime vérifiés |
| `node --test tests/foundations.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 326,39 ms |
| contrôle statique OpenAPI G1 | PASS de présence : catégories, contrats Client/Projet, tarifs, recherche et analytics publiés |
| `git diff --check` | PASS, code 0 |
| `npm test` | PASS, **207/207**, 0 échec/annulé/ignoré/TODO, 8 291,14 ms |

Les scénarios ciblés démontrent également : mutation légitime de `billingTerms`, `paymentTermsDays` et `billingAddress` suivie d'un `readDb()` sans blocage ; falsification de `outputDigest` détectée par `MIGRATION_MARKER_CONFLICT` ; rollback refusé sans export, export de récupération vérifié en mode `0600`, puis restauration exacte de la source antérieure.

## Statut des six P1 initiaux

1. **Contrat Client canonique : fermé sur la persistance, avec une divergence OpenAPI/runtime non bloquante isolément.** Les champs canoniques existent, sont migrés et validés. Le runtime conserve cependant les défauts de compatibilité alors que `ClientCreateCommand` les déclare tous obligatoires ; ce décalage doit être documenté ou aligné.
2. **Responsabilités Projet obligatoires : P1 encore ouvert.** Voir constat QA-G1-01 ci-dessous.
3. **Hiérarchie Site → Catégorie → Ressource : P1 encore ouvert.** Voir constat QA-G1-02 ci-dessous.
4. **Résolution tarifaire et cohérence de scope : fermé.** Le runtime filtre l'unité avant la priorité et retourne `422 RATE_SCOPE_MISMATCH` pour une grille incohérente.
5. **RBAC Recherche Client : fermé.** `client.read` ou `client.manage` est exigé avant scoring ; le test avec `effectivePermissions: []` retourne zéro Client.
6. **Rollback Sprint 1 : fermé sur les scénarios exécutés.** Backup vérifié, export de récupération obligatoire, écriture exclusive et restauration atomique sont démontrés.

SEC-G1-02 est fermé sur ce candidat : une mutation Client légitime ne falsifie plus l'état attendu du marqueur, tandis qu'une modification du marqueur lui-même est refusée.

## P1 ouverts

### QA-G1-01 — Les responsables Projet ne sont pas réellement obligatoires à la création

Le contrat Sprint 1 et `ProjectCreateCommand` déclarent `salesOwnerId`, `projectManagerId` et `planningOwnerId` obligatoires. Pourtant `createProjectCommand` substitue chacun des champs absent par `auth.user.id`. Le scénario ciblé « S1-A historise le cycle Projet » omet les trois champs et attend encore `201`.

Impact : une intégration incomplète est acceptée silencieusement et attribue trois responsabilités métier à l'opérateur sans décision explicite ; le runtime contredit son OpenAPI et le critère d'accountability US-008.

Correction attendue : refuser les champs absents avec `422 VALIDATION_ERROR`, conserver la validation membre actif/même société et ajouter les cas création complète, absence de chaque champ, membre inactif et membre étranger.

### QA-G1-02 — Les compatibilités de catégorie d'une Prestation ne sont pas validées

`organizationIssues` contrôle les types de ressources, mais accepte toute chaîne non vide dans `compatibleResourceCategoryIds`. Il ne vérifie pas que chaque catégorie existe, est active, appartient à la même société et respecte le périmètre attendu. Le test actuel refuse seulement une prestation sans aucune compatibilité et ne couvre aucune référence inexistante/archivée/étrangère. De plus, le référentiel Catégorie n'expose que liste et création ; aucune modification ni désactivation/archivage n'est publiée côté API/OpenAPI.

Impact : une prestation planifiable peut référencer une catégorie pendante ou inter-tenant et la règle Site → Catégorie → Ressource n'est pas garantie de bout en bout. Le cycle administratif attendu lors de la correction du P1-3 initial reste incomplet.

Correction attendue : résoudre chaque `compatibleResourceCategoryId` côté serveur contre une catégorie active du tenant/site autorisé, ajouter les cas négatifs correspondants et fournir le cycle versionné de modification/archivage prévu pour ce référentiel.

## Observations non bloquantes additionnelles

- L'OpenAPI `RateSurcharge.adjustmentBps` documente encore `0..10000`, alors que le runtime accepte aussi les ajustements négatifs et une borne haute supérieure.
- L'OpenAPI `RateCreate.sourceType` publie `manual` et `freeLine`, absents du catalogue serveur, et omet `stockItem`, accepté par le runtime.
- La présence syntaxique des routes OpenAPI est validée, mais ces divergences de valeur doivent être corrigées avant de considérer le contrat exécutable comme autorité complète.
- L'absence de baseline Git suivie oblige à rattacher le verdict aux seules empreintes ci-dessus.

## Verdict terminal

La re-QA G1 est **CHANGES REQUIRED — 0 P0, 2 P1 QA**. Les exécutions sont intégralement vertes (**12/12 ciblés, 15/15 fondations, 207/207 complets**), et la correction SEC-G1-02 est démontrée, mais les responsabilités Projet obligatoires et l'intégrité/cycle des catégories de compatibilité ne satisfont pas encore le contrat G1. Le candidat doit retourner en DEV, puis repasser les gates impactés sur de nouvelles empreintes. `docs/project-status.md` reste à actualiser par l'intégrateur.

---

# Re-QA ultime G1 — candidat final corrigé

Date : 2026-08-20  
Verdict : **APPROVED — 14/14 Sprint 1 ciblés, 27/27 API, 15/15 fondations et 209/209 complets ; 0 P0, 0 P1 QA**  
Périmètre : fermeture de QA-G1-01 et QA-G1-02, contrats Client/Projet, catégories Ressource, remplacement sûr de Site, migrations/rollback et non-régression G1  
Indépendance : aucun code, test ou contrat applicatif modifié ; seul `docs/qa-report.md` est actualisé

## Candidat vérifié

Environnement : Node `v26.6.0`, Darwin `arm64`. Le candidat est figé par les empreintes SHA-256 suivantes :

```text
server.js                         6fcda88face8c5c8f724d9deee1ae6d8541fbe93c18e61eb2c26e291c6e575c2
app.js                            ebd7ab4252c6aeea9463cfdb2da9525a1a1633be0bd2b843cf0840b95ba1d964
docs/api/openapi-v1.yaml          8a36107f150ebceafd6e17c3354f068916800dd2f6e5a3506c4399605b19f243
tests/sprint1-data.test.js        19e27f8db6b5d2115216cbff775aaa8e0dac6ccc75d5b1d76a1aa46e638ad3ca
tests/api.test.js                 5265b7a3857fb201a46fab2527f5431e47330c67b6dc6bdf43c360e45eb87871
tests/foundations.test.js         6f22b1d604a9679c222300313b29a7c81d47379411be1d2ecddad59fe6ba74a1
package.json                      abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

## Commandes et résultats frais

| Commande | Résultat observé |
|---|---|
| `node --test tests/sprint1-data.test.js` | PASS, **14/14**, 0 échec/annulé/ignoré/TODO, 988,66 ms |
| `node --test tests/api.test.js` | PASS, **27/27**, 0 échec/annulé/ignoré/TODO, 806,17 ms |
| `node --test tests/foundations.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 334,46 ms |
| `npm run lint` | PASS, code 0 ; syntaxe du runtime, des packages et scripts vérifiée |
| `npm run build` | PASS, code 0 ; 5 actifs runtime vérifiés |
| contrôle statique `docs/api/openapi-v1.yaml` | PASS : Client, Projet, Prestations, catégories Ressource, tarifs, recherche et analytics publiés ; `adjustmentBps` borné à `0..10000` et `sourceType` aligné sur `resource`, `serviceOffering`, `manual`, `freeLine` |
| `git diff --check` | PASS, code 0 |
| `npm test` | PASS, **209/209**, 0 échec/annulé/ignoré/TODO, 8 221,40 ms |

Les tests utilisent des fixtures temporaires et des serveurs loopback éphémères. Aucun accès réseau externe ni donnée de travail n'est requis.

## Résultats des corrections et critères G1

### Client et Projet

- Client : les valeurs invalides et l'absence d'adresse de facturation sont refusées en `422` ; une création complète avec héritage explicite de la devise société est acceptée en `201` ; les champs Client légitimement modifiables survivent à un nouveau `readDb()` sans conflit de migration ;
- Projet : Client et Site sont requis, les trois responsables `salesOwnerId`, `projectManagerId` et `planningOwnerId` sont réellement obligatoires et validés ; leur absence ou une identité inexistante reçoit `422` ; l'alias historique `status` est refusé (`400`) au profit de `lifecycleStatus` ;
- le cycle canonique Projet reste historisé et une transition aléatoire demeure refusée en `409`.

### Prestations, catégories et remplacement de Site

- une Prestation planifiable sans compatibilité est refusée et une catégorie inexistante dans `compatibleResourceCategoryIds` reçoit `422` ;
- le référentiel Catégorie couvre création, modification versionnée et archivage ; une catégorie encore référencée est protégée par `409` ; une Ressource ne peut pas référencer une catégorie invalide (`422`) ;
- le remplacement sûr d'un Site remappe de manière cohérente la catégorie, la Ressource, l'unité d'organisation et la Prestation compatibles vers le Site de remplacement ;
- les routes `/resource-categories` et `/resource-categories/{categoryId}` ainsi que les contrats Prestation/Ressource associés sont publiés dans OpenAPI.

### Tarifs, recherche, analytics et non-régression

- la résolution tarifaire conserve la priorité déterministe après sélection de l'unité et refuse une grille hors scope en `422` ; snapshots, absence de tarif et chevauchements datés restent couverts ;
- la recherche applique permissions et scopes avant restitution, couvre les six familles attendues et n'expose pas les coordonnées des contacts ; un contexte sans permission ne reçoit aucun Client ;
- la chaîne Budget/Devis/CA signé demeure réconciliée sur les neuf dimensions ; seule une version acceptée active alimente le signé, une version remplaçante retire l'ancienne reconnaissance et les lignes hors scope ne contaminent pas les agrégats visibles ;
- la suite complète conserve les garanties d'authentification, CSRF/Origin, RBAC/scopes, idempotence, audit, SSE, Planning, Stock, Maintenance et persistance atomique.

### Migration, marqueurs et rollback

- les migrations Sprint 1 sont additives et rejouables ; une mutation Client légitime ne modifie pas illicitement la preuve de migration ; une falsification du marqueur est détectée par `MIGRATION_MARKER_CONFLICT` ;
- le rollback refuse toute exécution sans export vérifié, y compris avec l'ancien indicateur `allowDataLoss` ; l'absence d'un marqueur requis bloque également le rollback ;
- l'export de récupération est créé avec les marqueurs attendus et des permissions `0600`, puis la source antérieure est restaurée à l'identique.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test exécuté n'est en échec, annulé, ignoré ou TODO.
- Cette QA valide les critères fonctionnels, contrats et régressions automatisés. Elle ne remplace pas les gates indépendants REVIEW, SECURITY, PERFORMANCE, INTEGRATION ou E2E navigateur.
- En l'absence de baseline Git immuable, ce verdict vaut uniquement pour les empreintes ci-dessus ; toute modification ultérieure impose une nouvelle QA.
- Conformément à l'ownership exclusif de ce gate, `docs/project-status.md` reste à actualiser par l'intégrateur.

## Verdict terminal QA G1

Le gate QA indépendant G1 est **APPROVED** sur ce candidat exact : **14/14 ciblés Sprint 1, 27/27 API, 15/15 fondations et 209/209 tests complets**, lint/build/OpenAPI verts, zéro P0/P1 QA. Les deux P1 QA précédents sont fermés par des preuves positives et négatives fraîches ; migrations, rejeu, protection des marqueurs, export et rollback sont démontrés.

---

# Re-QA finale G1 — correction SEC-G1-03

Date : 2026-08-20  
Verdict : **APPROVED — 15/15 Sprint 1 ciblés, 27/27 API, 15/15 fondations et 210/210 complets ; 0 P0, 0 P1 QA**  
Périmètre : correction de l'intégrité au rejeu des références Client et responsables Projet, plus non-régression du candidat G1  
Indépendance : aucun code, test ou contrat applicatif modifié ; seul `docs/qa-report.md` est actualisé

## Candidat vérifié

Environnement : Node `v26.6.0`, Darwin `arm64`. Le précédent verdict est remplacé pour tout état candidat ultérieur par les empreintes suivantes :

```text
server.js                         7a5b484d7bf160090f11fd3b518de9a91a2026718a583cc6253f092947543741
app.js                            ebd7ab4252c6aeea9463cfdb2da9525a1a1633be0bd2b843cf0840b95ba1d964
docs/api/openapi-v1.yaml          8a36107f150ebceafd6e17c3354f068916800dd2f6e5a3506c4399605b19f243
tests/sprint1-data.test.js        f1c471e14ae7842e88bf830acf1036a0f577009a2cb28b53bd58c11f14dbfcfa
tests/api.test.js                 5265b7a3857fb201a46fab2527f5431e47330c67b6dc6bdf43c360e45eb87871
tests/foundations.test.js         6f22b1d604a9679c222300313b29a7c81d47379411be1d2ecddad59fe6ba74a1
package.json                      abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

## Commandes et résultats frais

| Commande | Résultat observé |
|---|---|
| `node --test tests/sprint1-data.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 823,72 ms |
| `node --test tests/api.test.js` | PASS, **27/27**, 0 échec/annulé/ignoré/TODO, 802,97 ms |
| `node --test tests/foundations.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 308,92 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; 5 actifs runtime vérifiés |
| contrôle statique `docs/api/openapi-v1.yaml` | PASS : Client, Projet, Prestations et catégories publiés ; bornes tarifaires et types de source précédemment alignés inchangés |
| `git diff --check` | PASS, code 0 |
| `npm test` | PASS, **210/210**, 0 échec/annulé/ignoré/TODO, 8 395,04 ms |

## Vérification SEC-G1-03

- une modification légitime de `billingTerms`, `paymentTermsDays` et `billingAddress` reste acceptée au `readDb()` et ne fige pas les données Client modifiables ;
- une falsification du `outputDigest` du marqueur `sprint-1-contracts-v2` reste détectée par `MIGRATION_MARKER_CONFLICT` ;
- une altération persistée d'un Projet vers un `clientId` inexistant est désormais refusée au rejeu avec `MIGRATION_MARKER_CONFLICT` ;
- une altération persistée de `salesOwnerId` vers un utilisateur inexistant est également refusée au rejeu avec `MIGRATION_MARKER_CONFLICT` ;
- les contrats HTTP continuent à refuser Client invalide/adresse absente, Projet sans Site ou responsables, responsable inconnu et alias historique ;
- catégories, remplacement de Site, tarification, recherche, analytics, rollback/export et l'ensemble des modules historiques restent verts dans la suite complète.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test exécuté n'est en échec, annulé, ignoré ou TODO.
- Cette QA atteste les scénarios automatisés et ne remplace pas les verdicts indépendants REVIEW, SECURITY, PERFORMANCE, INTEGRATION ou E2E.
- En l'absence de baseline Git immuable, le verdict vaut uniquement pour les empreintes ci-dessus ; tout changement impose une nouvelle QA.
- `docs/project-status.md` reste à actualiser par l'intégrateur, conformément à l'ownership exclusif du rapport QA.

## Verdict terminal QA G1 après SEC-G1-03

Le gate QA indépendant G1 est **APPROVED** sur ce candidat exact : **15/15 ciblés Sprint 1, 27/27 API, 15/15 fondations et 210/210 tests complets**, lint/build/OpenAPI/diff verts, zéro P0/P1 QA. La falsification des références Client et responsable Projet est maintenant détectée au rejeu sans empêcher les mutations Client légitimes.

---

# Ultime re-QA G1 — correction SEC-G1-04

Date : 2026-08-20  
Verdict : **APPROVED — 15/15 Sprint 1 ciblés, 27/27 API, 15/15 fondations et 210/210 complets ; 0 P0, 0 P1 QA**  
Périmètre : protections transactionnelles lors de la désactivation d'un Client référencé et de la suspension d'un responsable Projet, plus non-régression G1  
Indépendance : aucun code, test ou contrat applicatif modifié ; seul `docs/qa-report.md` est actualisé

## Candidat vérifié

Environnement : Node `v26.6.0`, Darwin `arm64`. Le verdict porte exclusivement sur les empreintes SHA-256 suivantes :

```text
server.js                         326815740c7e698cf7279ffa73339232869bf05ba851cd9798ba6227e92a973e
app.js                            ebd7ab4252c6aeea9463cfdb2da9525a1a1633be0bd2b843cf0840b95ba1d964
docs/api/openapi-v1.yaml          8a36107f150ebceafd6e17c3354f068916800dd2f6e5a3506c4399605b19f243
tests/sprint1-data.test.js        f5df2d985db9b34baa8a8a2a416ae9e0fac142c9e561755b2904e96c2671ba23
tests/api.test.js                 5265b7a3857fb201a46fab2527f5431e47330c67b6dc6bdf43c360e45eb87871
tests/foundations.test.js         6f22b1d604a9679c222300313b29a7c81d47379411be1d2ecddad59fe6ba74a1
package.json                      abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

## Commandes et résultats frais

| Commande | Résultat observé |
|---|---|
| `node --test tests/sprint1-data.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 875,06 ms |
| `node --test tests/api.test.js` | PASS, **27/27**, 0 échec/annulé/ignoré/TODO, 855,30 ms |
| `node --test tests/foundations.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 362,03 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; 5 actifs runtime vérifiés |
| contrôle statique `docs/api/openapi-v1.yaml` | PASS : routes et schémas G1 attendus présents, bornes tarifaires et sources alignées inchangées |
| `git diff --check` | PASS, code 0 |
| `npm test` | PASS, **210/210**, 0 échec/annulé/ignoré/TODO, 8 170,34 ms |

## Vérification SEC-G1-04

- la tentative de passer `client_1` à `active: false` alors qu'il porte un Projet retourne `409 CLIENT_HAS_PROJECTS` ;
- le garde Client est évalué avant `Object.assign` dans la transaction atomique : l'exception précède toute modification de l'entité, tout incrément de version, tout audit et tout événement ;
- après affectation explicite de `user_planner` comme responsable commercial d'un Projet, la tentative de suspendre son membership retourne `409 PROJECT_OWNER_REASSIGNMENT_REQUIRED` ;
- le scénario relit la persistance après le refus et confirme que le membership reste `active`, avec la même version : aucune mutation partielle ;
- les contrôles antérieurs demeurent verts : Client/Projet canoniques, falsifications au rejeu, catégories et remplacement de Site, tarifs, recherche, analytics, marqueurs, export et rollback.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test contractuel exécuté n'est en échec, annulé, ignoré ou TODO.
- Un smoke HTTP ad hoc additionnel a été refusé par le sandbox local avec `listen EPERM` et n'est pas utilisé comme preuve ; les suites contractuelles `node --test`, exécutées avec leur serveur loopback éphémère, sont toutes vertes.
- La non-mutation Client est établie par l'ordre transactionnel du garde et l'absence de chemin d'écriture avant l'exception ; le test automatisé affirme explicitement le `409` et son code métier. La non-mutation du membership est en plus relue et affirmée sur disque.
- Cette QA ne remplace pas les verdicts indépendants REVIEW, SECURITY, PERFORMANCE, INTEGRATION ou E2E. En l'absence de baseline Git immuable, toute modification des empreintes impose une nouvelle QA.
- `docs/project-status.md` reste à actualiser par l'intégrateur.

## Verdict terminal QA G1 après SEC-G1-04

Le gate QA indépendant G1 est **APPROVED** sur ce candidat exact : **15/15 ciblés Sprint 1, 27/27 API, 15/15 fondations et 210/210 tests complets**, lint/build/OpenAPI/diff verts, zéro P0/P1 QA. Les deux opérations désormais interdites retournent `409` avant toute écriture autorisée ; la suspension du responsable est explicitement relue sans mutation persistée.

---

# Gate QA indépendant — Sprint 2 V1 / G2

Date : 2026-08-20  
Exécution UTC : `2026-08-20T15:45:12Z`  
Verdict : **APPROVED — 13/13 Planning, 47/47 Devis, 81/81 socle ciblé et 216/216 complets ; 0 P0, 0 P1 QA**  
Périmètre : `docs/specifications/sprint-2-commercial-planning-kernel.md`, stories US-017 à US-024, US-033/034, US-065 à US-067 et premier incrément US-069.  
Indépendance : aucun code, test, contrat ni autre rapport n'a été modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64. Le dépôt ne possède pas encore de `HEAD` Git ; le verdict vaut donc exclusivement pour les empreintes SHA-256 suivantes, contrôlées avant et après les exécutions :

```text
server.js                                              408e2ca2372c9f149c29a3dd18ac9940209357764b589a5041ed25ab5add507f
app.js                                                 76901020ac3e62d9013c8de48d84e37b7f8fd525ce3453aa767ef219c7ea5ae9
planning.css                                           1b6923060c248d728d6e69aed3fa64a12d0d58d88dd52a8b3151e57d74142606
docs/api/openapi-v1.yaml                               d40f50e1550051f9eaf2b3e52a0f1d2ce2bc65dc971a2e5053ad5ae020ae577e
docs/specifications/sprint-2-commercial-planning-kernel.md
                                                       57b47d9f96335395bc6078ca8ceb17a44620f6e512a3d2644979a8277e250e89
tests/planning-postproduction.test.js                   1248165d5d8d153fc801f90226c9898c97f59a6279f25fe16d0f9f8b2a77687e
tests/quotes.test.js                                    784adb8e917650fe47f772eb9344dc9abc4d12978e3b4df8e2574e5b501b0e05
tests/api.test.js                                       445666eeb944abb833c9fbc555e34ad19e487f054f1a4dc9c6ce41fad0675dc7
tests/domain.test.js                                    4fc062d534da69e27d2b30106f8d6c805d520179a92d171d250824f70e22896f
tests/foundations.test.js                               6f22b1d604a9679c222300313b29a7c81d47379411be1d2ecddad59fe6ba74a1
tests/sprint1-data.test.js                              f5df2d985db9b34baa8a8a2a416ae9e0fac142c9e561755b2904e96c2671ba23
package.json                                            abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/planning-postproduction.test.js` | PASS, **13/13**, 0 échec/annulé/ignoré/TODO, 80,14 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 186,78 ms |
| `node --test tests/api.test.js tests/domain.test.js tests/foundations.test.js tests/sprint1-data.test.js` | PASS, **81/81**, 0 échec/annulé/ignoré/TODO, 968,54 ms |
| `npm test` | PASS, **216/216**, 0 échec/annulé/ignoré/TODO, 8 296,36 ms |
| `npm run lint` | PASS, code 0 ; syntaxe du runtime, packages et scripts vérifiée |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |

Les suites HTTP utilisent des fixtures JSON temporaires et des serveurs loopback éphémères. Aucun service ni actif réseau externe n'est requis. L'avertissement Node expérimental relatif à l'absence de `--localstorage-file`, observé sur la suite Planning pure, ne provoque ni échec ni mutation.

## Résultats fonctionnels G2

### Planning virtualisé et UX de statut

- le découpage virtuel borne lignes et dates tout en conservant les dimensions logiques avant/après le viewport ; la restauration des deux axes de défilement est couverte ;
- la matrice conserve cellules journalières, périodes multi-jours, exceptions unitaires, classement métier, vue Projet et parc ELIOTE additif/idempotent ;
- les sept états `draft`, `option`, `confirmed`, `completed`, `cancelled`, `unavailable` et `maintenance` sont acceptés/filtrables et textuellement distingués ; les états terminaux ou de maintenance ne reposent pas sur la couleur seule ;
- `option`, `confirmed`, `unavailable` et `maintenance` consomment la capacité, tandis que `draft`, `completed` et `cancelled` n'en consomment pas pour un nouveau conflit ;
- les transitions autorisées sont auditées ; une transition illégale reçoit `409 RESERVATION_STATUS_TRANSITION_INVALID` sans mutation ; une réservation terminale reste en lecture seule ;
- capacité individuelle et agrégée, créneaux adjacents, conflit, override motivé, annulation logique, version optimiste, idempotence et déplacement d'une cellule unique restent verts.

### Budget → Devis accepté → CA → Planning

- Budget et Devis peuvent être créés sans réservation ; la conversion Budget → Devis conserve la source et se rejoue sans doublon ;
- tarifs projet → client → catalogue, remises, calculs monétaires entiers, snapshots fiscaux HT/TVA/TTC et versions commerciales restent déterministes ;
- les documents envoyés/acceptés sont non modifiables ; toute évolution produit un brouillon de nouvelle version ou d'avenant distinct ;
- seul un Devis accepté alimente le chiffre d'affaires avec son instantané, tandis qu'un Budget ou un Devis non accepté n'y contribue pas ;
- un Devis accepté expose son contrôle Planning et prépare/crée ses éléments de manière atomique et idempotente sans altérer ses montants ; les imports Planning/planning client ne créent aucune réservation automatique avant action humaine explicite ;
- PlanyBot recalcule vendu/planifié/reste/dépassement, invalide un contrôle obsolète et prépare l'avenant de dépassement ; copie d'une cellule, exclusion des week-ends, rattachement commercial et isolation société/site restent couverts.

### Non-régression du socle

- Auth, cookie/CSRF/Origin, RBAC, scopes société/site/projet, identifiants devinés, erreurs stables, audit, SSE et exposition statique sont exercés par les suites API et complètes ;
- Client, Projet, catégories Ressource, Prestations, tarifs, recherche, analytics, migrations additives, marqueurs, export/rollback Sprint 1 et fondations G0 restent verts ;
- Stock, Maintenance, Organisation, Ressources, PDF local multipage et autres suites historiques participent aux **216/216** tests complets.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test exécuté n'est en échec, annulé, ignoré ou TODO.
- **P2-QA-G2-01 — documentation opérationnelle :** `docs/project-status.md` annonce encore `Domaine/Fondations/API 66/66`, alors que la commande ciblée réellement prescrite et exécutée sur API + Domaine + Fondations + Sprint 1 retourne **81/81**. Cette incohérence de comptage ne masque aucun échec mais doit être rectifiée par l'intégrateur.
- La virtualisation est couverte par tests unitaires/structurels et par la suite de régression. La mesure de l'interactivité réelle `< 2 s` sur 250 ressources / 10 000 réservations appartient au gate PERFORMANCE indépendant ; elle n'est pas fabriquée dans ce rapport.
- Cette passe ne remplace pas le smoke INTEGRATION ni l'E2E navigateur avec persistance/rechargement. La validation visuelle et métier finale demeure du ressort du PO.
- L'absence de baseline Git immuable reste un risque de traçabilité : tout changement d'une empreinte publiée invalide ce verdict et impose une nouvelle QA.
- Conformément à l'ownership exclusif, `docs/project-status.md` reste à actualiser par l'intégrateur.

## Verdict terminal QA G2

Le gate QA indépendant G2 est **APPROVED** sur le candidat exact ci-dessus : **13/13 Planning, 47/47 Devis, 81/81 socle ciblé et 216/216 tests complets**, lint et build verts, zéro P0/P1 QA. Les critères automatisables du viewport virtualisé, des statuts/capacités/maintenances et du parcours Budget → Devis accepté → CA → Planning idempotent sont démontrés. Les gates REVIEW, SECURITY, PERFORMANCE, INTEGRATION et E2E conservent leurs verdicts indépendants.

---

# Re-QA terminale G2 — terminalité et scopes

Date : 2026-08-20  
Exécution UTC : `2026-08-20T16:11:18Z`  
Verdict : **APPROVED — 29/29 API, 13/13 Planning, 47/47 Devis, 52/52 Domaine/Fondations/Sprint 1 et 216/216 complets ; 0 P0, 0 P1 QA**  
Périmètre : corrections issues de REVIEW sur les états terminaux des réservations et les scopes projet/entité, puis non-régression complète G2.  
Indépendance : aucun code, test, contrat ou rapport tiers modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat corrigé vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64. En l'absence de `HEAD` Git, ce verdict remplace le verdict QA G2 précédent uniquement pour les empreintes SHA-256 suivantes, identiques avant et après les tests :

```text
server.js                                              7412d587fab0a387739076aa852db8aebf0aadee39cbcdfb45d455253fc2d554
app.js                                                 76901020ac3e62d9013c8de48d84e37b7f8fd525ce3453aa767ef219c7ea5ae9
planning.css                                           1b6923060c248d728d6e69aed3fa64a12d0d58d88dd52a8b3151e57d74142606
docs/api/openapi-v1.yaml                               d40f50e1550051f9eaf2b3e52a0f1d2ce2bc65dc971a2e5053ad5ae020ae577e
docs/specifications/sprint-2-commercial-planning-kernel.md
                                                       57b47d9f96335395bc6078ca8ceb17a44620f6e512a3d2644979a8277e250e89
tests/api.test.js                                       d233502c33a8ed977d7f60fea16635b1eae2f82abb1be9913520858436bbb3c5
tests/planning-postproduction.test.js                   1248165d5d8d153fc801f90226c9898c97f59a6279f25fe16d0f9f8b2a77687e
tests/quotes.test.js                                    784adb8e917650fe47f772eb9344dc9abc4d12978e3b4df8e2574e5b501b0e05
tests/domain.test.js                                    4fc062d534da69e27d2b30106f8d6c805d520179a92d171d250824f70e22896f
tests/foundations.test.js                               6f22b1d604a9679c222300313b29a7c81d47379411be1d2ecddad59fe6ba74a1
tests/sprint1-data.test.js                              f5df2d985db9b34baa8a8a2a416ae9e0fac142c9e561755b2904e96c2671ba23
package.json                                            abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **29/29**, 0 échec/annulé/ignoré/TODO, 1 012,26 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, **13/13**, 0 échec/annulé/ignoré/TODO, 83,04 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 059,20 ms |
| `node --test tests/domain.test.js tests/foundations.test.js tests/sprint1-data.test.js` | PASS, **52/52**, 0 échec/annulé/ignoré/TODO, 825,27 ms |
| `npm test` | PASS, **216/216**, 0 échec/annulé/ignoré/TODO, 7 907,50 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

## Vérification des corrections

### Terminalité sans mutation

- le parcours `draft → option → confirmed → completed` réussit et produit exactement trois audits `reservation.updated` avec états `before/after` attendus ;
- une modification PATCH sur `completed` reçoit `409 RESERVATION_TERMINAL` ;
- une annulation DELETE sur `completed` reçoit `409 RESERVATION_TERMINAL` ; la relecture confirme que le statut reste `completed` et que la version n'a pas changé ;
- une nouvelle annulation DELETE sur une réservation déjà `cancelled` reçoit `409 RESERVATION_CANCELLED` ;
- les refus terminaux n'ajoutent aucun audit de transition : le journal reste limité aux trois transitions autorisées ;
- une transition illégale `option → draft` reçoit `409 RESERVATION_STATUS_TRANSITION_INVALID`, puis la relecture confirme statut et version inchangés ;
- maintenance et indisponibilité continuent à consommer la capacité et bloquent une option concurrente en `409`.

### Scopes projet et entité sans divulgation ni mutation

- après limitation du membership viewer à `project_1`, `resource_3`, `client_1` et aucune réservation explicite, les listes Projet/Ressource/Dashboard ne restituent que le scope permis ;
- Projet dashboard, réservation, liens commerciaux, catalogue de devis, contacts et tarifs hors scope répondent `404`, sans exposer l'identifiant caché ;
- avec un rôle `planning.read/write` restreint, les commandes de duplication de réservation complète, duplication de cellule et déplacement de cellule sur la réservation cachée répondent toutes `404` ;
- le contrôle du journal d'audit ne trouve aucune action `reservation.created`, `reservation.cellMoved` ou autre mutation associée aux clés de commandes refusées ;
- le rejeu de mise à jour des scopes reste idempotent et audité avec état `before/after` canonique.

### Non-régression G2

- le viewport virtualisé, les sept statuts, la capacité cumulée, maintenance, vues Projet, périodes et déplacement unitaire restent couverts par 13/13 Planning ;
- Budget → Devis accepté, snapshots et versions, CA signé, contrôle Planning et idempotence restent couverts par 47/47 Devis ;
- Auth/CSRF/Origin, RBAC, isolation société/site, idempotence, audit/SSE, Stock, Organisation, Ressources et migrations restent verts dans les 216/216 tests complets.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test exécuté n'est en échec, annulé, ignoré ou TODO.
- Le P2 documentaire `P2-QA-G2-01` du rapport précédent est fermé : `docs/project-status.md` ne présente plus l'ancien décompte `66/66` et décrit désormais le candidat corrigé avec API 29/29, Planning 13/13, Devis 47/47 et suite 216/216.
- `git diff --check` est vert, mais le dépôt entier demeure non suivi et sans baseline Git immuable ; les empreintes sont donc l'unique autorité de ce verdict.
- La performance `< 2 s`, le smoke d'intégration et l'E2E navigateur/persistance restent aux gates indépendants correspondants.
- Conformément à l'ownership exclusif, l'intégrateur reste responsable de la mise à jour terminale de `docs/project-status.md`.

## Verdict terminal re-QA G2

La re-QA G2 est **APPROVED** sur le candidat corrigé exact : **29/29 API, 13/13 Planning, 47/47 Devis, 52/52 Domaine/Fondations/Sprint 1 et 216/216 tests complets**, lint/build/diff-check verts, zéro P0/P1 QA. Les refus de mutation terminale et hors scope sont désormais couverts par des négatifs HTTP avec relecture de l'état ou absence d'audit, sans régression fonctionnelle.

---

# Re-QA finale G2 — salle cible et cœur de déplacement

Date : 2026-08-20  
Exécution UTC : `2026-08-20T16:16:13Z`  
Verdict : **APPROVED — 29/29 API, 13/13 Planning, 47/47 Devis, 52/52 Domaine/Fondations/Sprint 1 et 216/216 complets ; 0 P0, 0 P1 QA**  
Périmètre : contrôle d'autorisation de la salle cible dans les commandes et `cellOverrides`, refus de déplacement d'un état `completed` dans le cœur métier, puis non-régression G2.  
Indépendance : aucun code, test, contrat ou rapport tiers modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat final vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64. Ce verdict remplace les verdicts QA G2 antérieurs pour le nouveau candidat et vaut exclusivement pour les empreintes SHA-256 suivantes, restées identiques avant et après les exécutions :

```text
server.js                                              5434fb65167956549fd474f5fa80bc9e3af9d456397e41a998ec110860f190e4
app.js                                                 76901020ac3e62d9013c8de48d84e37b7f8fd525ce3453aa767ef219c7ea5ae9
planning.css                                           1b6923060c248d728d6e69aed3fa64a12d0d58d88dd52a8b3151e57d74142606
docs/api/openapi-v1.yaml                               d40f50e1550051f9eaf2b3e52a0f1d2ce2bc65dc971a2e5053ad5ae020ae577e
docs/specifications/sprint-2-commercial-planning-kernel.md
                                                       57b47d9f96335395bc6078ca8ceb17a44620f6e512a3d2644979a8277e250e89
tests/api.test.js                                       c83494bc655f0ccea4caa3fef41bdc11810b82e737960045f9b2acc6c6f9b32b
tests/planning-postproduction.test.js                   1248165d5d8d153fc801f90226c9898c97f59a6279f25fe16d0f9f8b2a77687e
tests/quotes.test.js                                    784adb8e917650fe47f772eb9344dc9abc4d12978e3b4df8e2574e5b501b0e05
tests/domain.test.js                                    4fc062d534da69e27d2b30106f8d6c805d520179a92d171d250824f70e22896f
tests/foundations.test.js                               6f22b1d604a9679c222300313b29a7c81d47379411be1d2ecddad59fe6ba74a1
tests/sprint1-data.test.js                              f5df2d985db9b34baa8a8a2a416ae9e0fac142c9e561755b2904e96c2671ba23
package.json                                            abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **29/29**, 0 échec/annulé/ignoré/TODO, 1 033,19 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, **13/13**, 0 échec/annulé/ignoré/TODO, 80,43 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 035,52 ms |
| `node --test tests/domain.test.js tests/foundations.test.js tests/sprint1-data.test.js` | PASS, **52/52**, 0 échec/annulé/ignoré/TODO, 846,62 ms |
| `npm test` | PASS, **216/216**, 0 échec/annulé/ignoré/TODO, 7 912,52 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

## Vérification finale des corrections

### Salle cible masquée

- la fixture crée une réservation `allowedReservation` visible au viewer, sur `project_1` et `resource_3`, sans `cellOverrides` ;
- le viewer restreint conserve `planning.read/write` sur la source visible mais pas sur la salle cible `resource_5` ;
- le déplacement de la cellule source visible vers `resource_5` reçoit `404 NOT_FOUND` ;
- la relecture de la réservation visible retourne la version initiale et `cellOverrides: []` : aucune exception journalière cachée n'est écrite ;
- les commandes sur une réservation source cachée restent refusées en `404` pour duplication complète, duplication de cellule et déplacement ;
- le contrôle des listes et lectures hors scopes Projet, Ressource, Client et Réservation demeure non révélateur.

### État `completed` dans le cœur move

- après `draft → option → confirmed → completed`, une commande `PATCH /reservations/:id/cells/:date/:resource` reçoit `409 RESERVATION_TERMINAL` ;
- une modification générique du même `completed` reçoit aussi `409 RESERVATION_TERMINAL` ;
- les annulations d'un état `completed` ou `cancelled` reçoivent `409 RESERVATION_STATUS_TRANSITION_INVALID` ;
- la relecture confirme statut `completed` et version inchangée après toutes les tentatives refusées ;
- l'audit de cette réservation contient uniquement les trois transitions légales, avec états `before/after`, et aucun déplacement de cellule.

### Régression du candidat G2

- les 13 tests Planning maintiennent la virtualisation bornée, les axes de défilement, la vue Projet, les périodes et sept statuts explicites ;
- les 47 tests Devis maintiennent Budget → Devis accepté, snapshots/versionnement, CA signé, contrôle Planning et idempotence ;
- capacité/maintenance, concurrence, scopes, audit/SSE, Auth/CSRF/Origin, Organisation, Ressources, Stock et migrations restent verts dans la suite complète 216/216.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test exécuté n'est en échec, annulé, ignoré ou TODO.
- Le rapport `docs/project-status.md` reflète correctement ce « second retour DEV » et n'est pas déclaré approuvé avant les re-gates.
- Le dépôt reste entièrement non suivi, sans baseline Git immuable ; `git diff --check` est vert mais les empreintes publiées restent l'autorité du verdict.
- Performance, Integration et E2E conservent leurs gates indépendants. La QA ne transforme pas une preuve structurelle de virtualisation en mesure d'interactivité navigateur.
- Conformément à l'ownership exclusif, l'intégrateur demeure responsable du statut terminal G2.

## Verdict terminal de la re-QA finale G2

La re-QA finale G2 est **APPROVED** sur le candidat exact : **29/29 API, 13/13 Planning, 47/47 Devis, 52/52 Domaine/Fondations/Sprint 1 et 216/216 tests complets**, lint/build/diff-check verts, zéro P0/P1 QA. Les deux chemins manquants — salle cible masquée et déplacement d'un `completed` — sont maintenant couverts par des négatifs HTTP démontrant l'absence de mutation.

---

# Re-QA G2 — correctif de défilement du planning

Date : 2026-08-21  
Exécution UTC : `2026-08-21T08:24:51Z`  
Verdict : **APPROVED — 14/14 Planning et 217/217 tests complets ; 0 P0, 0 P1 QA**  
Périmètre : défilement horizontal et vertical du planning virtualisé, synchronisation de la colonne Ressources, conservation de la fenêtre virtuelle et non-régression du candidat G2.  
Indépendance : aucun code, test, contrat ou rapport tiers modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64. Les empreintes SHA-256 sont restées identiques avant et après toute la campagne :

```text
app.js                                                 ccf24edfa0335db68de28bf1ca03d113a487fbb48e4ad06a529044d1237c0780
planning.css                                           2a71e804730932358c1e86cb1b14b6c68b06aafd608408c36935e68862e7bf8a
tests/planning-postproduction.test.js                  a71a4301162ce6fb64631b5cc320327a1270d6d5d500b7ff4fae40ac1a0732cc
server.js                                              5434fb65167956549fd474f5fa80bc9e3af9d456397e41a998ec110860f190e4
tests/api.test.js                                      c83494bc655f0ccea4caa3fef41bdc11810b82e737960045f9b2acc6c6f9b32b
```

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --check app.js` | PASS, code 0 |
| `node --test tests/planning-postproduction.test.js` | PASS, **14/14**, 0 échec/annulé/ignoré/TODO, 81,03 ms |
| `npm test` | PASS, **217/217**, 0 échec/annulé/ignoré/TODO, 8 040,47 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

## Vérification du correctif

- le planning expose toujours une fenêtre virtualisée bornée pour les lignes et les dates, avec espaces avant/après et dimensions totales conservées ;
- la timeline restaure explicitement `scrollLeft` et `scrollTop` depuis l'état virtuel après un nouveau rendu ;
- le défilement vertical est synchronisé dans les deux sens entre la timeline et la colonne Ressources ;
- le détournement de la molette sur la colonne Ressources a été retiré : son ascenseur vertical natif peut piloter la timeline sans bloquer le geste utilisateur ;
- la timeline conserve ses ascenseurs horizontal et vertical explicites, ainsi qu'un `scrollbar-gutter` stable ;
- le tampon de virtualisation est testé afin d'éviter une reconstruction de la grille à chaque cran de molette ;
- les périodes, déplacements unitaires, vues Projet, sept statuts, capacité/maintenance, devis et contrôles API restent verts dans la suite complète.

## Constats et limites

- **P0 : aucun. P1 : aucun.** Aucun test exécuté n'est en échec, annulé, ignoré ou TODO.
- La preuve ciblée est structurelle et fonctionnelle au niveau JavaScript/DOM simulé ; la sensation de défilement sur périphérique réel et les dimensions exactes d'écran restent à confirmer au gate E2E navigateur du même candidat.
- Le dépôt reste sans baseline Git immuable ; `git diff --check` est vert, mais les empreintes publiées constituent l'autorité du verdict.
- L'intégrateur reste responsable de la mise à jour terminale de `docs/project-status.md`.

## Verdict terminal

La re-QA indépendante du correctif de défilement G2 est **APPROVED** pour le candidat exact ci-dessus : **14/14 Planning et 217/217 tests complets**, syntaxe/lint/build/diff-check verts, zéro P0/P1 QA et aucune régression automatisée détectée.

---

# Gate QA indépendant — Sprint 3 V1 / G3 Planning manipulable

Date : 2026-08-21 11:28 CEST  
Verdict : **BLOCKED — 0 P0, 2 P1 fonctionnels ouverts malgré 225/225 tests verts**  
Périmètre : S3-A à S3-D, vues/navigation, création et ghost, déplacement/redimensionnement/rollback, règles de calendrier et granularités, contrats API et non-régression.  
Indépendance : aucun code applicatif, test, contrat ou rapport tiers modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

```text
server.js                                              473a94c9c58b0aece7756766cde55b106dc9b74a6fda281e098a05ee1959dd0b
app.js                                                 c5abdac3cf039662dafeef09bcee04f699126a33ea0cfc896c32d918be444b93
planning.css                                           e9713e1c83dd2c6af3e2420790ad7d9b5e48087be5f836cb487d9d1339705f6b
docs/api/openapi-v1.yaml                               20febead3f834e34ed0375cb395bb7ade3e3085d2272fc621850b279a4a0bfc5
tests/api.test.js                                      a8263bb1edb5eaa1f31d6597f7ed3fb79c4f0015130c5a7ce7d0fe226408fb17
tests/planning-postproduction.test.js                  f89426c7071037a4616217d7837863f7142e0cd0ea9f6710c987a11b7552de3c
```

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **29/29**, 0 échec/annulé/ignoré/TODO, 1 120,74 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, **22/22**, 0 échec/annulé/ignoré/TODO, 90,10 ms |
| `npm test` | PASS, **225/225**, 0 échec/annulé/ignoré/TODO, 8 033,45 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; 5 actifs runtime vérifiés |
| `git diff --check` | PASS, code 0 |

Les négatifs API confirment notamment : granularité ou calendrier inconnu refusés en `422`, pas incompatible refusé, conflit de capacité en `409`, version obsolète sans écrasement, états terminaux non modifiables, source/cible hors scopes en `404` et déplacement unitaire sans altération des autres cellules. Le contrat OpenAPI publie les champs `includeWeekends`, `timeGranularity`, `snapMinutes` et `holidayCalendarId`.

## Contrôle navigateur local

Contrôle réalisé sur `http://127.0.0.1:8206/index.html?v=g3-qa-1#planning`, données isolées de prévisualisation, sans enregistrer de nouvelle réservation.

Résultats conformes :

- connexion locale, cinq boutons de vues et date centrale `2026-08-17` conservée lors des changements ;
- fenêtres logiques observées avec week-ends masqués : Jour 1, Semaine 15, 6 semaines 30, Mois 21 et 3 mois 66 colonnes ouvrées ; la virtualisation borne le nombre de colonnes rendues ;
- bascule week-end : aucune date samedi/dimanche après masquage ; le 15 août 2026 est annoncé « Assomption » dans l'en-tête et dans chaque cellule concernée ;
- plein écran activé puis quitté par `Échap` avec retour du bouton « Plein écran » ;
- création par le bouton accessible `＋` ouvre le formulaire prérempli sur la bonne salle/date, avec demi-journée sélectionnée, calendrier France et aucune écriture après annulation ;
- après rechargement et reconnexion volontaire, les identifiants de réservation visibles avant rechargement sont toujours présents ; aucun message console d'erreur ou warning n'a été relevé.

## Anomalies bloquantes

### QA-G3-01 — P1 — La vue Jour n'offre aucune grille horaire

Attendu par US-025/US-045/US-046 : la vue Jour doit présenter une granularité horaire configurable et permettre de positionner une réservation sur un créneau précis.

Observé : après sélection de `Jour` puis `Heure · 30 min`, la matrice conserve exactement une colonne datée par salle. Le DOM contient 38 cellules salle × date et **0** nœud de créneau (`data-time`, `data-slot-time` ou `.planning-time-slot`). Le sélecteur de granularité ne modifie que le snapping du formulaire ; il ne rend ni axe horaire ni cellules de 30/60 minutes. Une réservation 11:00–13:00 demeure une carte dans la cellule du jour sans position temporelle exploitable.

Impact : le parcours Jour exigé n'est pas manipulable à l'heure depuis le Planning. US-025 et la partie UI de US-045/046 ne sont pas satisfaites ; G3 reste bloqué.

Correction attendue : rendre une échelle horaire dans la vue Jour, avec pas 30/60 minutes, ghost et sélection exacts, dates/instants calculés sans dérive, alternative clavier et tests DOM/comportementaux.

### QA-G3-02 — P1 — Déplacement et redimensionnement sans alternative clavier

Attendu par §6 et les critères G3 : création, déplacement et resize doivent fonctionner par souris **et clavier**.

Observé : les réservations et les boutons de bord sont focalisables, mais leurs opérations reposent uniquement sur `draggable`/`dragstart`/`drop`. Le menu clavier `Maj+F10` propose Copier/Coller et actions commerciales, sans commande Déplacer ou Redimensionner. Sur le bouton « Étirer la fin de Conformation », `ArrowRight` ne change ni la période ni le message d'état. Aucun handler clavier n'appelle `dropAllocation()`, `moveWholePlanningBooking()` ou `resizePlanningBooking()`.

Impact : une personne n'utilisant pas le pointeur ne peut pas accomplir deux interactions centrales du Sprint 3. Le critère explicite du gate et l'accessibilité fonctionnelle ne sont pas satisfaits.

Correction attendue : fournir un mode clavier explicite (par exemple commandes dans le menu contextuel avec choix de date/salle et incréments de début/fin), focus visible, annonce du ghost/résultat, annulation/rollback identiques et tests navigateur clavier.

## Couverture, limites et non-régression

- Les tests Planning valident correctement calculs civils, week-ends, fériés FR, snapping, DTO, exception unitaire, conflits et virtualisation. Plusieurs assertions d'interactions restent toutefois des recherches de chaînes dans `app.js`/`planning.css` ; elles ne démontrent pas les gestes natifs, la mutation optimiste ou le rollback dans un navigateur.
- Le ghost de création est prouvé sans appel API par inspection du branchement et le formulaire accessible fournit une alternative à la création souris. Le déplacement/redimensionnement réel par glisser-déposer, le rollback visuel face à un `409`, la persistance après **redémarrage serveur** et un parcours complet création → move → resize → conflit doivent être rejoués après correction pendant l'E2E.
- Le calendrier exécutable couvre `FR-national` pour les sites Europe/Paris. Aucun calendrier férié personnalisé de site n'est démontré dans ce candidat ; l'OpenAPI et le serveur refusent actuellement tout autre identifiant.
- Le dépôt demeure entièrement non suivi : `git diff --check` est vert, mais les empreintes ci-dessus sont l'autorité de cette campagne.
- Performance, Security, Review, Integration et validation produit gardent leurs verdicts indépendants. Les succès de ces autres gates ne peuvent pas fermer les deux P1 QA.

## Verdict terminal

Le gate QA G3 est **BLOCKED** sur le candidat exact : **225/225 tests automatisés sont verts**, mais deux capacités exigées sont absentes dans l'interface réellement servie — grille horaire en vue Jour et déplacement/redimensionnement au clavier. Conformément à `AGENTS.md`, le candidat doit revenir en DEV, corriger ces P1, puis repasser QA et tous les gates aval impactés. `docs/project-status.md` reste à actualiser par l'intégrateur conformément à l'ownership exclusif du mandat.

---

# Re-QA indépendante G3 — grille Jour/Heure et commandes clavier

Date : 2026-08-21 12:18 CEST  
Verdict : **APPROVED — 30/30 API, 24/24 Planning et 228/228 tests complets ; 0 P0, 0 P1 QA**  
Périmètre : candidat corrigé S3-A à S3-D, avec recontrôle prioritaire des deux P1 précédents, snapping positif/négatif, idempotence des cellules et non-régression des cinq vues/du défilement.  
Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat corrigé vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64. Les empreintes SHA-256 sont identiques avant et après la campagne :

```text
server.js                                              faef9ad5d81f82a3bd967baf7e31fc541aa617c79b25bbb238501a3fbe7bcdd4
app.js                                                 cdf88fc677050128976acbd9aa40f63afc4a4b6b9764118ca64977e2c0460bd8
planning.css                                           1928f4cabc83cfb3d8acb652b64e060ca7fcaefcfa26e5f0fa34d8165083fe19
tests/api.test.js                                      165a12998808c0dfd38041abbdab2fea6ec096c981e30c190d50591535eea71c
tests/planning-postproduction.test.js                  e15c954219cb01dd79312f4a8d4765310ced20126a1875f3f058eceada21d9b7
docs/api/openapi-v1.yaml                               a70a98f727d02f0dc6c132357f11489a60c0878e1929c7cf8a179d58e36160c5
```

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **30/30**, 0 échec/annulé/ignoré/TODO, 1 206,66 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, **24/24**, 0 échec/annulé/ignoré/TODO, 91,96 ms |
| `npm test` | PASS, **228/228**, 0 échec/annulé/ignoré/TODO, 8 230,29 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `node --check server.js` puis `node --check app.js` | PASS, codes 0 |
| `git diff --check` | PASS, code 0 |

## Fermeture des deux P1 précédents

### QA-G3-01 — grille Jour/Heure : fermé

- `planningTimelineSlots('day', 'hour', …)` produit **48 créneaux consécutifs de 30 minutes**, de `00:00–00:30` à `23:30–24:00` ; le mode demi-journée produit `09:00–13:00` et `13:00–18:00` ;
- la matrice rend les attributs `data-time`, `data-slot-end`, `data-slot-index` et `data-planning-time` ; une réservation est placée dans le créneau de son heure de début et son occupation utilise une portée calculée sur sa durée ;
- le test négatif API refuse en `422 VALIDATION_ERROR` un début `08:15` annoncé avec un pas de 30 minutes ; le cas aligné `08:30–09:30` est créé en `201` avec la politique temporelle attendue.

### QA-G3-02 — déplacement/redimensionnement clavier : fermé

- chaque carte modifiable publie `aria-keyshortcuts` et un focus visible ; `ArrowUp/ArrowDown` appelle le déplacement de la seule cellule vers la salle adjacente ;
- en vue Jour/Heure, `ArrowLeft/ArrowRight` déplace la réservation par incréments de 30 minutes et les poignées de début/fin exposent les mêmes touches pour le redimensionnement ; `Shift+ArrowLeft/ArrowRight` conserve le déplacement civil journalier ;
- ces chemins utilisent les mêmes mutations optimistes, validations serveur et restauration du snapshot que les gestes pointeur ; un refus remet l'état local antérieur et affiche l'annulation ;
- le déplacement d'une cellule est rejouable avec la même clé d'idempotence (`200`, même version et mêmes exceptions) ; un contenu divergent avec cette clé reçoit `409 IDEMPOTENCY_CONFLICT`, un seul événement d'audit est produit et une réservation indépendante reste intacte.

## Couverture fonctionnelle et non-régression

- les cinq vues `Jour`, `Semaine`, `6 semaines`, `Mois` et `3 mois` conservent une plage civile déterministe contenant la date de référence ; la vue Jour seule devient temporelle lorsque la précision Heure ou Demi-journée est choisie ;
- le ghost de création normalise le glisser dans les deux sens, ouvre seulement le formulaire prérempli et ne déclenche aucune API avant validation ; les calculs de move/resize refusent une période négative ;
- week-ends inclus/exclus, fériés nationaux FR (dont Lundi de Pâques et 14 juillet), heure/demi-journée/journée, intervalle semi-ouvert, capacité, conflit/override, version obsolète, rollback et statuts terminaux restent verts ;
- source ou cible hors scopes reste non révélée en `404`, tandis qu'un conflit de capacité reçoit `409` et une entrée temporelle invalide `422` ;
- la virtualisation reste bornée, restaure `scrollLeft`/`scrollTop`, synchronise la colonne Ressources dans les deux sens et conserve son tampon afin de ne pas reconstruire la grille à chaque cran de molette ;
- la suite complète confirme les non-régressions Auth/CSRF/Origin, RBAC/isolation, Organisation, Ressources, Projets, Stock, Devis/CA, audit/SSE et migrations.

## Limites explicites

- une tentative de reconnexion au navigateur local pour rejouer les commandes clavier sur l'interface servie a retourné `No browser is available`. Cette re-QA ne revendique donc pas de nouvelle preuve visuelle/périphérique ; les preuves sont les tests frais, l'exécution API réelle sur serveur éphémère et l'inspection des branchements DOM du candidat. Le parcours pointeur/clavier et le focus après chaque rerendu restent à rejouer au gate E2E navigateur sur ce même hash ;
- la suite API utilise un fichier temporaire et prouve écriture/relecture durant le même processus ; elle ne redémarre pas le serveur pour démontrer une persistance disque inter-processus ;
- seul `FR-national` est démontré. Aucun calendrier férié personnalisé par site n'est validé ; cette extension n'entre pas dans ce candidat ;
- le dépôt reste sans baseline Git suivie ; les empreintes publiées constituent donc l'autorité du verdict. Les gates Review, Sécurité, Performance, Integration et E2E gardent leurs verdicts indépendants.

## Verdict terminal de re-QA G3

La re-QA G3 est **APPROVED** sur les empreintes exactes ci-dessus : les deux P1 fonctionnels précédents sont fermés, **30/30 API, 24/24 Planning et 228/228 tests complets** sont verts, lint/build/syntaxe/diff-check passent et aucun nouveau P0/P1 QA n'est ouvert. L'intégrateur reste responsable de la mise à jour de `docs/project-status.md` et du replay E2E navigateur sur ce même candidat.

---

# Re-QA ultime G3 — candidat V2 fuseau, legacy et focus clavier

Date : 2026-08-21 12:28 CEST  
Verdict : **APPROVED — 30/30 API, 26/26 Planning, 47/47 Devis et 230/230 tests complets ; 0 P0, 0 P1 QA**  
Périmètre : candidat V2 corrigé S3-A à S3-D ; fuseau IANA été/hiver, aller-retour local/UTC, compatibilité des réservations historiques sans politique temporelle, focus clavier après rerendu et critères G3 antérieurs.  
Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat V2 vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

```text
server.js                                              faef9ad5d81f82a3bd967baf7e31fc541aa617c79b25bbb238501a3fbe7bcdd4
app.js                                                 ca2471b6ed278c0e11f2740c04b98e1a3ce598d481d6e8838844f2325731feba
planning.css                                           1928f4cabc83cfb3d8acb652b64e060ca7fcaefcfa26e5f0fa34d8165083fe19
tests/api.test.js                                      165a12998808c0dfd38041abbdab2fea6ec096c981e30c190d50591535eea71c
tests/planning-postproduction.test.js                  bb9693680d7c039c023413f0cc2ae370a796f550f49bc8ad806392c2a51e518b
docs/api/openapi-v1.yaml                               a70a98f727d02f0dc6c132357f11489a60c0878e1929c7cf8a179d58e36160c5
```

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **30/30**, 0 échec/annulé/ignoré/TODO, 1 202,50 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, **26/26**, 0 échec/annulé/ignoré/TODO, 108,42 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 219,75 ms |
| `npm test` | PASS, **230/230**, 0 échec/annulé/ignoré/TODO, 8 359,98 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

Une relance API secondaire exécutée simultanément avec un autre processus et canalisée vers `tail` a rencontré `listen EPERM` avant les tests. Il s'agit d'un refus d'ouverture de socket du bac à sable, sans assertion produit exécutée. La commande contractuelle non canalisée a été rejouée seule immédiatement et a passé 30/30 ; le premier passage ciblé non canalisé était également vert. Ce bruit d'infrastructure n'est pas assimilé à une anomalie du candidat.

## Vérifications V2 prioritaires

### Fuseau été/hiver et roundtrip local

- le site fournit son fuseau IANA et le client utilise `Intl.DateTimeFormat` pour convertir les coordonnées locales, sans offset `+02:00` figé ;
- pour `Europe/Paris`, `2026-08-17 09:00` devient `07:00Z` en heure d'été et `2026-12-17 09:00` devient `08:00Z` en heure d'hiver ;
- le retour de `2026-12-17T08:00:00.000Z` restitue exactement `{ date: '2026-12-17', time: '09:00' }` ;
- le DTO complet d'une période locale `09:00–18:00` conserve les jours civils et retrouve les mêmes dates/heures après aller-retour API ; move, resize, undo/redo et modification horaire utilisent tous la même conversion IANA.

### Réservations historiques sans politique implicite

- une réservation existante sans `timePolicyVersion` reste éditable sans ajout silencieux de `timeGranularity` ni `snapMinutes` ;
- le formulaire marque explicitement si la politique a été touchée. Le snapping avant soumission ne s'applique qu'après choix utilisateur ;
- une réservation portant explicitement `sprint3-v1` conserve en revanche sa granularité `hour` et son pas `30`, ce qui distingue migration historique et nouveau contrat.

### Focus clavier et opérations

- les cartes et poignées publient leurs raccourcis, conservent un style `focus-visible` et attendent la fin de la mutation asynchrone ;
- après déplacement vertical, déplacement temporel/civil ou redimensionnement, deux cycles de rendu sont attendus puis le focus revient à la carte ou à la poignée correspondante avec `preventScroll:true` ;
- les opérations continuent à partager validation serveur, mutation optimiste et rollback. La cellule quotidienne, l'idempotence, les conflits, la version obsolète, les scopes et les états terminaux restent couverts par les négatifs API verts.

## Non-régression des critères G3 antérieurs

- vraie grille Jour : 48 créneaux de 30 minutes, deux demi-journées, rendu temporel et portée d'événement selon la durée ;
- cinq vues civiles et date de référence déterministes, week-ends ON/OFF, jours fériés nationaux FR, granularités heure/demi-journée/jour ;
- ghost sans mutation préalable, période positive obligatoire, déplacement d'une seule cellule sans altérer ses voisines, déplacement complet et resize avec restauration sur refus ;
- replay de cellule identique accepté, contenu divergent refusé, audit unique ; capacité, override motivé, isolation société/site, CSRF/RBAC, audit/SSE et Devis/CA restent verts ;
- fenêtres virtualisées bornées, scroll horizontal/vertical restauré et colonne Ressources synchronisée avec tampon de rendu.

## Limites explicites

- la reconnexion au navigateur local a de nouveau retourné `No browser is available`. Le focus est donc prouvé par les tests frais et l'inspection du branchement DOM, pas par un nouveau geste réel sur périphérique. Le gate E2E doit rejouer `ArrowUp/Down/Left/Right`, les poignées, le focus après réussite et après rollback sur ce hash exact ;
- les cas saisonniers représentatifs sont couverts, mais aucun créneau situé exactement dans l'heure locale inexistante ou dupliquée du changement DST n'est validé dans ce lot ;
- la persistance inter-processus après redémarrage serveur reste une preuve d'intégration/E2E ; la suite API prouve écriture et relecture sur fichier temporaire dans le même processus ;
- seul le calendrier `FR-national` est démontré. Le dépôt reste sans baseline Git suivie ; les empreintes ci-dessus constituent l'autorité de cette campagne.

## Verdict terminal de re-QA ultime G3

La re-QA ultime G3 est **APPROVED** sur les empreintes exactes ci-dessus : les corrections fuseau/roundtrip, legacy et focus ferment les risques fonctionnels visés ; **30/30 API, 26/26 Planning, 47/47 Devis et 230/230 tests complets** passent, avec lint/build/diff-check verts et aucun P0/P1 QA ouvert. Le replay navigateur et la persistance après redémarrage restent explicitement délégués aux gates E2E/Integration.

---

# Re-QA terminale G3 — candidat V3 DST exact et focus recentré

Date : 2026-08-21 12:43 CEST  
Verdict : **APPROVED — 30/30 API, 28/28 Planning, 47/47 Devis et 232/232 tests complets ; 0 P0, 0 P1 QA**  
Périmètre : candidat V3 corrigé S3-A à S3-D ; transitions DST exactes Europe/Paris, cellule quotidienne multi-jours, recentrage et fallback du focus clavier, compatibilité legacy et non-régression G3.  
Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat V3 vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

```text
server.js                                              faef9ad5d81f82a3bd967baf7e31fc541aa617c79b25bbb238501a3fbe7bcdd4
app.js                                                 7dada2a00e2e5ee23c0f73ba4fe9b6db2222f502198ff32cc574ae2a454fedf1
planning.css                                           1928f4cabc83cfb3d8acb652b64e060ca7fcaefcfa26e5f0fa34d8165083fe19
tests/api.test.js                                      165a12998808c0dfd38041abbdab2fea6ec096c981e30c190d50591535eea71c
tests/planning-postproduction.test.js                  d450d34c61832fbba6ecf9a5efa4906c21cb41d64a448594737a9c28698cd2f3
docs/api/openapi-v1.yaml                               a70a98f727d02f0dc6c132357f11489a60c0878e1929c7cf8a179d58e36160c5
```

Une vérification finale des empreintes et `git diff --check` après la campagne confirme que l'état candidat n'a pas dérivé.

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/planning-postproduction.test.js` | PASS, **28/28**, 0 échec/annulé/ignoré/TODO, 119,81 ms |
| `node --test tests/api.test.js` | PASS, **30/30**, 0 échec/annulé/ignoré/TODO, 1 166,13 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 233,89 ms |
| `npm test` | PASS, **232/232**, 0 échec/annulé/ignoré/TODO, 10 187,55 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0, avant et après campagne |

## Vérifications V3 prioritaires

### DST exact et intervalles temporels

- en `Europe/Paris`, la journée du passage à l'heure d'été du 29 mars 2026 produit exactement **46** créneaux de 30 minutes et exclut les heures locales inexistantes `02:00`/`02:30` ; une saisie explicite dans cette lacune est refusée ;
- la journée du retour à l'heure d'hiver du 25 octobre 2026 produit exactement **50** créneaux et distingue les deux occurrences de `02:00` ; la désambiguïsation `earlier`/`later` produit deux instants différents ;
- chaque cellule temporelle transporte ses instants exacts `startsAt`/`endsAt` jusqu'au formulaire et au DTO. Une heure dupliquée sélectionnée ne se replie donc pas silencieusement sur l'autre occurrence ;
- une réservation quotidienne couvrant plusieurs jours est découpée par l'intervalle local propre à chaque cellule. Les cellules initiale et intermédiaire conservent chacune leur durée de 9 heures au lieu d'exposer la période multi-jours complète ;
- les intervalles restent semi-ouverts et les chemins heure, demi-journée et journée conservent snapping, overlap et calcul de portée cohérents.

### Focus, recentrage et fallback

- après une mutation clavier réussie ou son rollback, la restauration attend la mutation puis deux cycles de rendu ;
- la cible prioritaire est la même carte ou poignée de redimensionnement, puis la carte de réservation correspondante, puis la région scrollable du planning ;
- si un déplacement temporel sort de la fenêtre Jour affichée, la date d'ancrage est recentrée, la fenêtre virtualisée est recalculée et le focus revient sur la réservation déplacée ;
- la région de fallback est focusable (`tabindex=0`, `role=region`) et les cartes/poignées conservent leurs raccourcis et leur focus visible.

### Legacy, négatifs et non-régression

- une réservation historique sans `timePolicyVersion` reste inchangée si l'utilisateur ne touche pas à la politique : aucun `timeGranularity` ou `snapMinutes` implicite n'est injecté, et les instants stockés restent identiques ;
- une politique explicite conserve sa granularité et son snapping ; une heure locale inexistante, une période négative, une version obsolète, un conflit de capacité, un scope interdit et un état terminal sont refusés par les contrats testés ;
- les cinq vues, week-ends ON/OFF, jours fériés nationaux FR, ghost sans mutation, move/resize/rollback, déplacement d'une cellule unique, idempotence, audit/SSE, RBAC/CSRF/isolation et virtualisation/scroll restent verts ;
- la suite complète couvre également Organisation, Ressources, Projets, Stock, Devis/CA et migrations sans régression observée.

## Limites explicites

- aucun navigateur contrôlable n'était disponible pendant cette campagne. La re-QA ne revendique donc pas de nouveau geste physique ni de preuve visuelle du focus ; le gate E2E doit rejouer recentrage, fallback, succès et rollback clavier sur ces empreintes exactes ;
- la persistance est validée par écriture/relecture sur fichier temporaire dans le même processus, pas par un redémarrage complet du serveur ; cette preuve reste au gate Integration/E2E ;
- seul le calendrier `FR-national` est couvert ; aucun calendrier personnalisé par site n'est inclus dans ce candidat ;
- le dépôt ne fournit pas de baseline Git suivie exploitable pour figer un commit : les empreintes SHA-256 publiées sont l'autorité de cette re-QA.

## Verdict terminal de re-QA G3 V3

La re-QA G3 V3 est **APPROVED** sur les empreintes exactes ci-dessus : les négatifs DST exacts, la cellule multi-jours, le recentrage/fallback du focus et le comportement legacy sont démontrés ; **30/30 API, 28/28 Planning, 47/47 Devis et 232/232 tests complets** passent, lint/build/diff-check sont verts et aucun P0/P1 QA n'est ouvert. Les limites navigateur et redémarrage sont explicitement transférées aux gates E2E et Integration.

---

# Re-QA ultime G3 — candidat V4 gestes DST et resize recentré

Date : 2026-08-21 12:49 CEST  
Verdict : **APPROVED — 30/30 API, 29/29 Planning, 47/47 Devis et 233/233 tests complets ; 0 P0, 0 P1 QA**  
Périmètre : candidat V4 S3-A à S3-D ; gestes clavier de ±30 minutes fondés sur les instants réels aux bascules DST, redimensionnement sortant de la vue Jour avec recentrage/focus, et régression complète des critères G3 précédents.  
Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat V4 vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

```text
server.js                                              faef9ad5d81f82a3bd967baf7e31fc541aa617c79b25bbb238501a3fbe7bcdd4
app.js                                                 9cb7d996fdbd364f0e8d3ff95d7c43bd8173526f5990381233968e592b120e33
planning.css                                           1928f4cabc83cfb3d8acb652b64e060ca7fcaefcfa26e5f0fa34d8165083fe19
tests/api.test.js                                      165a12998808c0dfd38041abbdab2fea6ec096c981e30c190d50591535eea71c
tests/planning-postproduction.test.js                  a9a982239ca476af3336757298223b05c1fc4438aa6da9545bbda3534c7f82ff
docs/api/openapi-v1.yaml                               a70a98f727d02f0dc6c132357f11489a60c0878e1929c7cf8a179d58e36160c5
```

Les empreintes ont été contrôlées avant et après les essais ; `git diff --check` reste vert et le candidat n'a pas dérivé.

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/planning-postproduction.test.js` | PASS, **29/29**, 0 échec/annulé/ignoré/TODO, 110,63 ms |
| `node --test tests/api.test.js` | PASS, **30/30**, 0 échec/annulé/ignoré/TODO, 2 125,68 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 5 092,44 ms |
| `npm test` | PASS, **233/233**, 0 échec/annulé/ignoré/TODO, 9 153,63 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0, avant et après campagne |
| script Node ponctuel appelant `planningShiftedInstants` sur six cas printemps/automne | PASS : déplacement ±30 minutes et resize start/end conservent les instants et durées attendus |

## Vérifications V4 prioritaires

### Gestes de ±30 minutes aux transitions DST

- les flèches de la vue Jour/Heure modifient désormais `startsAt` et `endsAt` par ajout ou retrait de **1 800 000 ms**, puis recalculent seulement leur représentation locale dans le fuseau du site ;
- au printemps, avancer la période locale `01:30–03:30` de 30 minutes produit `03:00–04:00` tout en conservant exactement 60 minutes réelles ; le retour de 30 minutes produit `01:30–03:30`, sans fabriquer d'heure locale inexistante ;
- à l'automne, avancer depuis la première occurrence de `02:30` atteint la seconde occurrence de `02:00` (`01:00Z`). Le retour depuis la seconde occurrence conserve également l'instant `01:00Z` même si le libellé civil reste `02:00` ;
- les cas ponctuels de resize confirment que déplacer le bord de fin au printemps ou le bord de début à l'automne conserve des instants ISO non ambigus et une durée positive ;
- la mutation envoie ces instants ISO exacts au serveur, avec version et granularité, et restaure le snapshot complet en cas de refus.

### Resize hors vue, recentrage et focus

- après un resize clavier, le bord actif détermine la date de focus à partir de la réservation relue : `date` pour le début, `endDate` pour la fin ;
- lorsque cette date sort de la vue Jour, elle devient la nouvelle ancre, la clé de virtualisation est invalidée et le planning est rerendu avant restauration du focus ;
- la restauration attend la mutation asynchrone et deux cycles de rendu, vise d'abord la poignée correspondante, puis la carte de réservation, puis la région scrollable focusable ;
- la même séquence est exécutée après un succès comme après le rollback issu d'un refus API, sans laisser le focus sur un élément DOM détruit.

### Critères précédents et négatifs

- les 46 créneaux du printemps, les 50 créneaux de l'automne, le refus d'une heure inexistante, la désambiguïsation d'une heure répétée et la cellule multi-jours bornée restent verts ;
- cinq vues, granularités heure/demi-journée/jour, week-ends ON/OFF, fériés FR, ghost sans mutation, move/resize/rollback, déplacement d'une seule cellule, idempotence, conflit/version/scopes/statuts terminaux et compatibilité legacy restent couverts ;
- la suite complète ne relève aucune régression Auth/CSRF/RBAC/isolation, audit/SSE, Organisation, Ressources, Projets, Stock, Devis/CA, persistance courante et migrations.

## Limites explicites

- aucun navigateur contrôlable n'était disponible pour cette campagne. Le recentrage/focus est donc prouvé par les tests frais, les branchements DOM et les séquences asynchrones inspectées, pas par un nouveau geste physique ; le gate E2E doit le rejouer sur ces empreintes ;
- la persistance après redémarrage complet du serveur reste une preuve d'Integration/E2E ; la suite valide écriture et relecture sur ses fichiers temporaires ;
- seul le calendrier national français est couvert ; les calendriers personnalisés par site restent hors périmètre ;
- faute de baseline Git suivie exploitable, les SHA-256 publiés constituent l'autorité exacte de cette re-QA.

## Verdict terminal de re-QA G3 V4

La re-QA ultime G3 V4 est **APPROVED** sur les empreintes exactes ci-dessus : les mouvements et resize de 30 minutes traversent correctement les bascules DST par instants réels, le resize hors vue recentre la vue Jour et restaure le focus, et tous les critères antérieurs restent verts. **30/30 API, 29/29 Planning, 47/47 Devis et 233/233 tests complets** passent ; lint, build et diff-check passent ; aucun P0/P1 QA n'est ouvert.

---

# Re-QA d'impact G3 — focus clavier persistant après rerender SSE

Date : 2026-08-21 15:11 CEST  
Verdict : **APPROVED — 30/30 API, 29/29 Planning, 47/47 Devis et 233/233 tests complets ; 0 P0, 0 P1 QA**  
Périmètre : correction frontend de restauration du focus après les rerenders asynchrones/SSE ; intention bornée à 2,5 secondes, non-vol du focus placé hors matrice, resize/recentrage et critères G3 V4.  
Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

```text
server.js                                              faef9ad5d81f82a3bd967baf7e31fc541aa617c79b25bbb238501a3fbe7bcdd4
app.js                                                 35826e969bbd14d66a73b1a5ead67081e7ee648e0a0202b524e2450a6dd8a954
planning.css                                           1928f4cabc83cfb3d8acb652b64e060ca7fcaefcfa26e5f0fa34d8165083fe19
tests/api.test.js                                      165a12998808c0dfd38041abbdab2fea6ec096c981e30c190d50591535eea71c
tests/planning-postproduction.test.js                  833ece1c1f383a7a07f824e5e05b66a56daf4e5c7897c8432970b010dcf43c63
docs/api/openapi-v1.yaml                               a70a98f727d02f0dc6c132357f11489a60c0878e1929c7cf8a179d58e36160c5
```

Les empreintes backend, CSS, API et OpenAPI restent celles du candidat V4 ; seuls le frontend et son test Planning ont changé. `git diff --check` passe avant la campagne.

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/planning-postproduction.test.js` | PASS, **29/29**, 0 échec/annulé/ignoré/TODO, 105,88 ms |
| `node --test tests/api.test.js` | PASS, **30/30**, 0 échec/annulé/ignoré/TODO, 1 682,10 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 751,66 ms |
| `npm test` | PASS, **233/233**, 0 échec/annulé/ignoré/TODO, 8 324,85 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

## Vérification de la correction focus/SSE

- toute opération clavier achevée enregistre une intention `{ bookingId, edge, cellDate, expiresAt }` dont l'expiration est exactement `Date.now() + 2500` ;
- l'intention est réappliquée lors de chaque nouveau binding du Planning, donc après les rerenders déclenchés par les réponses de mutation ou les événements SSE, tant que sa durée n'est pas expirée ;
- chaque tentative attend deux cycles `requestAnimationFrame`, recherche d'abord la poignée/cellule d'origine, puis la carte de réservation, puis la région scrollable ;
- si l'utilisateur a focalisé un élément actif hors de `.planning-matrix-scroll`, la tentative s'arrête sans déplacer son focus. Le mécanisme ne vole donc pas le focus à un contrôle extérieur ;
- à expiration, l'intention est supprimée. Elle ne peut pas restaurer indéfiniment une ancienne cible ;
- la logique conserve le recentrage sur `date` ou `endDate` après resize hors vue, ainsi que la restauration après succès ou rollback.

## Corroboration E2E fournie avec le candidat

Le handoff E2E du même candidat rapporte un resize du 18 au 21 août avec la poignée toujours focalisée 1,2 seconde après l'opération, donc après le rerender différé ; il rapporte aussi la persistance de l'annulation après redémarrage et l'absence de contrôle de création/mutation pour le lecteur. Ces éléments corroborent l'inspection et les tests QA, sans être présentés comme des gestes nouvellement exécutés par cette campagne QA.

## Non-régression

- les gestes ±30 minutes par instants réels, DST printemps/automne, cellule multi-jours, heure inexistante/dupliquée, granularités, cinq vues, week-ends et fériés FR restent verts ;
- ghost sans mutation, move/resize/rollback, déplacement cellulaire, idempotence, conflit/version/scopes/statuts terminaux, legacy et virtualisation/scroll restent verts ;
- API, Auth/CSRF/RBAC/isolation, audit/SSE, Organisation, Ressources, Projets, Stock, Devis/CA et migrations ne présentent aucune régression automatisée.

## Limites explicites

- cette campagne QA n'a pas disposé d'un navigateur contrôlable propre. Elle s'appuie sur les tests frais, l'inspection des branchements et la preuve navigateur E2E transmise sur le même candidat ;
- l'interaction où l'utilisateur focalise successivement un contrôle extérieur, le retire du DOM puis revient dans la matrice pendant les 2,5 secondes n'a pas de scénario navigateur dédié ; le contrôle actuel respecte l'élément actif à chaque rerender ;
- la preuve de persistance après redémarrage et les permissions lecteur sont celles du gate E2E, pas une nouvelle exécution QA ;
- le calendrier personnalisé par site reste hors périmètre. Les empreintes SHA-256 publiées sont l'autorité du candidat.

## Verdict terminal de re-QA d'impact

La re-QA d'impact focus/SSE est **APPROVED** sur les empreintes exactes ci-dessus. L'intention de focus survit aux rerenders pendant une fenêtre bornée, respecte un focus utilisateur extérieur, conserve le fallback et le recentrage, et ne provoque aucune régression détectée. **30/30 API, 29/29 Planning, 47/47 Devis et 233/233 tests complets** passent ; lint, build et diff-check passent ; aucun P0/P1 QA n'est ouvert.

---

# Gate QA indépendant G4 — Planning ↔ Devis

Date : 2026-08-21 16:29 CEST  
Verdict : **APPROVED — 0 P0, 0 P1 QA ; 2 P2 ouverts**  
Périmètre : Sprint 4 S4-A à S4-C, batch atomique, peinture, compensations Undo/Redo, autosave, moteur vendu/planifié/reste/dépassement, Devis complémentaires et garde O1.  
Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat G4 vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

```text
server.js                                              e9511b717c48571107796dfead2ce755d15fd61096b169e4f422f690ee6926b9
app.js                                                 4e4184596936fe90876b71e967ba39db2f8f0938b2b3d33b79f58b9fef3aa718
planning.css                                           e4df59fc44cf624241bf4bd822b5059cbefd1ec4b109f65ca1cb9e8b5fbcf45f
tests/api.test.js                                      c6aaf73f3e95c9e411c9ed5d1ebebaea29a6e06dea1d70507d8cb9b10518d0ff
tests/planning-postproduction.test.js                  684222c039fc23e207607c953aea513635f0747cc1821441c0819b9892b62e5f
tests/quotes.test.js                                   380c3de4a5b431f5981992f949f5a37f0a3444b0433a95e7d94ad866ba60753e
tests/foundations.test.js                              0f4b37f9f6e8cd04d6a10f3b4330b1bd42ef9e12b4a229755deb72784cc93e04
tests/organization.test.js                             aa403f648360866a7e6863f04a755b48239b1e678656b444b2e45ce552f922b4
docs/api/openapi-v1.yaml                               20eef6d443681732d5f04a2d730133beebbdb5aac78cc6d890b3c3fdd201b1a9
```

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/foundations.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 288,91 ms |
| `node --test tests/api.test.js` | PASS, **31/31**, 0 échec/annulé/ignoré/TODO, 1 295,23 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, **35/35**, 0 échec/annulé/ignoré/TODO, 130,18 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 358,56 ms |
| `node --test tests/organization.test.js` | PASS, **33/33**, 0 échec/annulé/ignoré/TODO, 8 000,88 ms |
| `npm test` | PASS, **241/241**, 0 échec/annulé/ignoré/TODO, 8 306,21 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

## Vérifications fonctionnelles G4

### Batch, scopes, idempotence et rollback

- `POST /api/v1/reservations/batch` accepte au plus 200 actions parmi `create`, `duplicate`, `move`, `resize`, `cancel` et `restore`, avec une clé d'idempotence obligatoire ;
- un lot contenant une cellule inexistante, une version obsolète ou un conflit de capacité est rejeté sans création, déplacement, redimensionnement ou annulation partielle ;
- le rejeu identique restitue les mêmes identifiants et versions ; une même clé avec un contenu différent reçoit `409 IDEMPOTENCY_CONFLICT` ;
- les lots `cancel` puis `restore`, `move`, `resize` et peinture sont exercés positivement et négativement ; le premier élément d'un lot invalide reste inchangé après rejet ;
- les réservations existantes sont retrouvées sous société, site et scope d'entité. Les créations et cibles repassent dans la validation site/Projet/Ressource ; les tests de scope généraux confirment le masquage `404` des identifiants existants hors périmètre ;
- audit, événements SSE et synchronisation commerciale ne sont produits qu'après commit, puis le complément est recalculé une seule fois par Devis touché.

### Consommation et Devis complémentaires

- le `QuoteConsumptionEngine` est l'autorité partagée : le vendu accepté n'est jamais muté, les réservations annulées ne consomment rien et une ligne forfaitaire non planifiable reste `nonApplicable` ;
- le parcours automatisé valide `unplanned → partiallyPlanned → compliant → validated → overPlanned`, avec invalidation du digest après nouvelle réservation ;
- un complément accepté entre dans la nouvelle base vendue et n'est jamais réécrit. Un dépassement ultérieur crée un autre complément brouillon ;
- le cycle exact **+5 → +3 → 0** conserve le même identifiant de complément brouillon à +5 et +3, ajuste sa quantité de `5000` à `3000`, puis l'annule logiquement lorsque le dépassement revient à zéro ;
- le Devis principal accepté et le premier complément accepté restent tous deux au statut `accepted`, avec leurs instantanés inchangés ;
- les liens Projet, Devis, version et ligne sont conservés dans les créations/duplications et revérifiés avant chaque mutation.

### Interface, autosave et garde O1

- le Planning expose multi-sélection, peinture non contiguë, batch souris/clavier, compensation serveur, Undo/Redo et pile bornée via le chemin canonique ;
- l'indicateur accessible annonce `Sauvegarde…` avant l'appel, `Synchronisé` seulement après réponse intégrée et `Hors connexion` sur erreur réseau ou événement navigateur hors ligne ; aucun fallback localStorage silencieux n'est utilisé ;
- la garde Organisation confirme qu'une société active dont O1 n'est pas validé conserve l'action `Valider O1 et continuer` ; Organisation passe 33/33.

## Corroboration E2E fournie sur ce candidat

Le handoff navigateur isolé du même candidat rapporte : Devis accepté de 5 jours, peinture de 5 cellules, contrôle `5 / 5` et `100 %`, ajout de 3 cellules créant un unique complément brouillon, Undo ramenant exactement le contrôle à `5 / 5`, puis état conservé après rechargement. Il rapporte aussi la garde O1 active/non validée. Cette campagne QA corrobore ces résultats par les contrats et tests frais sans les présenter comme un nouveau geste navigateur QA.

## Constats P2 non bloquants

### QA-G4-P2-01 — pile Undo/Redo non vidée lors d'un changement de société

La spécification Sprint 4 exige que la pile soit vidée lors du changement de société. Le wrapper de changement de contexte réinitialise le Projet et les filtres Planning, mais ne vide pas `planningUndo`, `planningRedo`, le presse-papiers ni la sélection de peinture. Une action ancienne peut donc rester visible dans le nouveau contexte et échouer ensuite en `404` grâce aux contrôles serveur. Aucune fuite ni mutation inter-société n'est observée, mais l'état UI est incohérent et le contrat n'est pas entièrement respecté.

### QA-G4-P2-02 — deux chemins unitaires contournent la borne de 50 actions

`rememberPlanningUndo` borne correctement la pile à 50, mais les chemins unitaires historiques de déplacement complet et de redimensionnement ajoutent encore directement avec `planningUndo.push`. Une longue session utilisant uniquement ces gestes peut dépasser la borne documentaire. Les opérations restent compensées côté serveur et ce défaut ne compromet pas l'atomicité d'un lot, mais la limite mémoire/session n'est pas universelle.

## Limites explicites

- aucun nouveau navigateur contrôlable n'a été utilisé par cette campagne QA ; les gestes réels et le rechargement proviennent du handoff E2E du candidat exact ;
- la performance batch 100 n'est pas remesurée dans ce gate QA : la preuve annoncée à `p95 219,05 ms` doit être confirmée par le gate Performance indépendant ;
- les cas de scope du batch sont démontrés par les contrôles partagés et l'inspection, tandis que le test HTTP restreint cible explicitement les routes Planning unitaires ; un scénario HTTP batch sous rôle restreint resterait une couverture automatisée utile ;
- les deux P2 doivent être planifiés avant RELEASE ou explicitement acceptés par l'intégrateur. Ils ne créent ni P0 ni P1 et ne falsifient pas les résultats G4 principaux.

## Verdict terminal QA G4

Le gate QA indépendant G4 est **APPROVED** sur les empreintes exactes ci-dessus : tous les tests ciblés et les **241/241** tests complets passent, lint/build/diff-check sont verts, le cycle `5/5 → +3 → Undo → 5/5`, l'atomicité, l'idempotence, les conflits, l'autosave et la garde O1 sont démontrés. Aucun P0/P1 QA n'est ouvert. Deux P2 circonscrits restent documentés sur la purge et la borne de l'historique local Undo/Redo.

---

# Re-QA G4 — candidat corrigé négatifs et historique Planning

Date : 2026-08-21 16:44 CEST  
Verdict : **APPROVED — 0 P0, 0 P1, 0 P2 QA ouvert**  
Périmètre : corrections des deux P2 G4, replay batch après réduction de scope, préservation locale DST pour move/copy, sélection rectangulaire, versions Undo/Redo divergentes et autosave concurrent.  
Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat corrigé vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

```text
server.js                                              1373ea2bffceeb11d492fdddb21fe6869a85ac0d368643b123d056d35eace25e
app.js                                                 16dc6c21c3241fdd9d5391546ccafa7110cc11d63dbecc2b69762cc8543d4c84
planning.css                                           e4df59fc44cf624241bf4bd822b5059cbefd1ec4b109f65ca1cb9e8b5fbcf45f
tests/api.test.js                                      0fbd58d6b61135801d9620dd36a0481ca8d0e511ad58884c7d0440e2899eaa04
tests/planning-postproduction.test.js                  7cb607aa612905690c1356a333eba7d5a5adeeaac1c00e9eedd938d0f09438c3
tests/quotes.test.js                                   380c3de4a5b431f5981992f949f5a37f0a3444b0433a95e7d94ad866ba60753e
tests/foundations.test.js                              0f4b37f9f6e8cd04d6a10f3b4330b1bd42ef9e12b4a229755deb72784cc93e04
tests/organization.test.js                             aa403f648360866a7e6863f04a755b48239b1e678656b444b2e45ce552f922b4
docs/api/openapi-v1.yaml                               20eef6d443681732d5f04a2d730133beebbdb5aac78cc6d890b3c3fdd201b1a9
```

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **32/32**, 0 échec/annulé/ignoré/TODO, 1 439,73 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, **38/38**, 0 échec/annulé/ignoré/TODO, 120,67 ms |
| `node --test tests/foundations.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 309,75 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 476,86 ms |
| `node --test tests/organization.test.js` | PASS, **33/33**, 0 échec/annulé/ignoré/TODO, 7 955,81 ms |
| `npm test` | PASS, **245/245**, 0 échec/annulé/ignoré/TODO, 8 283,56 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

## Négatifs et corrections vérifiés

### Replay idempotent après réduction de scope

- un utilisateur Planning restreint exécute d'abord un batch autorisé ; l'administrateur réduit ensuite ses projets, ressources et réservations accessibles ;
- le rejeu exact avec la clé d'origine revalide chaque réservation du résultat mémorisé dans le scope courant ; il répond désormais `404 NOT_FOUND` au lieu de restituer un résultat devenu inaccessible ;
- la mutation initiale reste intacte, aucun second audit/SSE n'est produit et aucun identifiant hors périmètre n'est révélé.

### Batch et changement DST

- un déplacement batch partant d'une période traversant la bascule printemps utilise la date et l'heure locales du fuseau du site, puis les reconvertit en instants ISO sur la date cible ;
- le move conserve `23:30–03:30` en heure locale après la bascule et la copie ultérieure conserve le même couple local, avec les offsets UTC attendus ;
- move et copy restent atomiques, contrôlés par capacité et liés au même Projet/Devis/ligne.

### Sélection, historique et versions

- Maj+clic et Maj+Entrée étendent la sélection à un rectangle de cellules réellement rendues, borné par dates et ressources ; l'option Ctrl/Cmd conserve le mode additif ;
- toutes les piles passent par `pushPlanningHistory`, qui tronque au-delà de 50 actions, y compris move/resize unitaires, compensations et retours d'erreur ;
- le changement effectif de société vide Undo, Redo, presse-papiers, cible de collage, peinture, sélection commerciale et ancre ; **QA-G4-P2-01 et QA-G4-P2-02 sont fermés** ;
- Undo/Redo transmet la version mémorisée lors de l'opération. Une modification concurrente reçoit donc `VERSION_CONFLICT` au serveur et ne peut plus être compensée avec la version courante substituée silencieusement.

### Autosave concurrent

- un compteur suit toutes les mutations Planning en vol : le statut reste `Sauvegarde…` tant qu'au moins une requête n'est pas terminée ;
- une panne réseau rencontrée par l'une des requêtes reste mémorisée jusqu'à la fin de tout le groupe et mène à `Hors connexion` ;
- `Synchronisé` n'est annoncé que lorsque le compteur revient à zéro, sans panne réseau mémorisée et avec le navigateur en ligne ; les événements `online/offline` respectent le même compteur.

## Non-régression G4

- atomicité, idempotence, conflits, versions, terminalité, scopes, peinture, batch move/resize/cancel/restore et Undo/Redo restent verts ;
- le cycle complément `+5 → +3 → 0`, les documents acceptés immuables, le moteur vendu/planifié/reste/dépassement, les non-planifiables et la garde O1 restent verts ;
- les cinq vues Planning, DST G3, virtualisation/scroll, Auth/CSRF/RBAC/isolation, audit/SSE, Organisation, Ressources, Stock, Projets, Devis/CA et migrations ne présentent aucune régression automatisée.

## Performance et limites

- la mesure DEV isolée transmise pour 100 actions batch sur 250 ressources / 10 000 réservations est `p95 227,01 ms`, sous la cible de 250 ms. Cette re-QA fonctionnelle ne la revendique pas comme une mesure indépendante ; elle doit être reprise par le gate Performance ;
- aucun navigateur contrôlable propre n'a été utilisé dans cette campagne. La sélection rectangulaire et l'autosave concurrent sont couverts par tests/inspection ; le parcours métier réel reste celui du handoff E2E précédent sur le candidat G4 ;
- les nouveaux tests ferment les limites de couverture batch scope et historique signalées lors du premier gate QA.

## Verdict terminal de re-QA G4

La re-QA G4 du candidat corrigé est **APPROVED** : **32/32 API, 38/38 Planning, 15/15 Fondations, 47/47 Devis, 33/33 Organisation et 245/245 tests complets** passent ; lint, build et diff-check passent. Le replay après réduction de scope, le batch DST local, la sélection rectangle, les versions divergentes, la purge de contexte, la borne de l'historique et l'autosave concurrent sont démontrés. Les deux P2 précédents sont fermés et aucun P0/P1/P2 QA n'est ouvert.

---

# Re-QA G4 finale — snapshot historique hors scope et DST inexistante

Date : 2026-08-21 16:51 CEST  
Verdict : **APPROVED — 0 P0, 0 P1, 0 P2 QA ouvert**  
Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.  
Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat exact

```text
server.js                             cc9172f1bd5b85eb2eb39f17344c6726c9478f9caf146a0f179d951c5533f6e9
app.js                                16dc6c21c3241fdd9d5391546ccafa7110cc11d63dbecc2b69762cc8543d4c84
tests/api.test.js                     cac073c71655887d26d8a0cf175feff1354dab445be2128e48ef5564f66a6a41
tests/planning-postproduction.test.js 7cb607aa612905690c1356a333eba7d5a5adeeaac1c00e9eedd938d0f09438c3
```

## Preuves fraîches

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **32/32**, 0 échec/annulé/ignoré/TODO, 1 458,45 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, **38/38**, 0 échec/annulé/ignoré/TODO, 129,76 ms |
| `node --test tests/foundations.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 302,18 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 382,52 ms |
| `node --test tests/organization.test.js` | PASS, **33/33**, 0 échec/annulé/ignoré/TODO, 7 697,61 ms |
| `npm test` | PASS, **245/245**, 0 échec/annulé/ignoré/TODO, 8 227,92 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 avant et après campagne |

## Négatifs ajoutés

### Rejeu d'un snapshot historique devenu hors périmètre

- le lot initial déplace une réservation autorisée sur `resource_3`, puis une mutation administrateur replace la réservation courante sur `resource_5` ;
- le scope du planificateur est ensuite réduit à `resource_5` tout en lui laissant accès à l'identifiant de réservation courant ;
- le rejeu exact de la clé d'idempotence contrôle le **résultat historique mémorisé**, qui référence encore `resource_3`, et répond `404 NOT_FOUND` ;
- la réservation courante reste lisible sur `resource_5`, aucun résultat historique hors scope n'est divulgué et aucune seconde mutation n'est créée.

### Heure locale inexistante pendant la bascule DST

- un move batch vers le `28/03/2027` à `02:30` en `Europe/Paris`, heure inexistante lors du passage à l'heure d'été, répond `422 VALIDATION_ERROR` ;
- la réservation source conserve ses instants et sa version après le refus ;
- une duplication vers la même heure locale inexistante répond également `422 VALIDATION_ERROR` et ne crée aucune copie ;
- les cas valides adjacents continuent de préserver les heures murales locales et les offsets attendus lors des move/copy.

## Non-régression et limites

- scopes, batch atomique, idempotence, conflits, versions, historique borné, Undo/Redo, autosave concurrent, cinq vues, DST valide, Devis complémentaires, O1, Auth/RBAC/CSRF, audit/SSE et persistance restent verts dans la suite complète ;
- cette campagne QA est automatisée et inspecte les contrats ciblés ; elle ne constitue pas une nouvelle campagne navigateur ;
- la mesure de performance batch annoncée précédemment reste hors de cette re-QA fonctionnelle et relève du gate Performance indépendant.

## Verdict terminal

La re-QA finale G4 est **APPROVED** : les deux nouveaux négatifs sont démontrés, toutes les suites ciblées et les **245/245** tests complets passent, lint/build/diff-check sont verts et aucun P0/P1/P2 QA n'est ouvert.

---

# Re-QA ultime G4 — occurrence DST ambiguë `earlier`

Date : 2026-08-21 16:55 CEST  
Verdict : **APPROVED — 0 P0, 0 P1, 0 P2 QA ouvert**  
Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.  
Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat exact

```text
server.js                             31f2e713320acae6833aef5b55a05701e7734cb7365679d896cf5389aa066b3b
app.js                                16dc6c21c3241fdd9d5391546ccafa7110cc11d63dbecc2b69762cc8543d4c84
tests/api.test.js                     05a7d439035f7706d60346267b23cd49b33d9d1b8ce222c6c9bf1021bf073c27
tests/planning-postproduction.test.js 7cb607aa612905690c1356a333eba7d5a5adeeaac1c00e9eedd938d0f09438c3
```

## Preuves fraîches

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **32/32**, 0 échec/annulé/ignoré/TODO, 1 478,71 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, **38/38**, 0 échec/annulé/ignoré/TODO, 125,08 ms |
| `node --test tests/foundations.test.js` | PASS, **15/15**, 0 échec/annulé/ignoré/TODO, 445,24 ms |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 950,19 ms |
| `node --test tests/organization.test.js` | PASS, **33/33**, 0 échec/annulé/ignoré/TODO, 8 830,07 ms |
| `npm test` | PASS, **245/245**, 0 échec/annulé/ignoré/TODO, 7 880,36 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 avant campagne |

## Occurrence DST ambiguë

- lors du retour à l'heure d'hiver à Paris, `31/10/2027 02:30` correspond à deux instants possibles ;
- le move batch applique explicitement la politique déterministe `earlier` et persiste le premier instant, `2027-10-31T00:30:00.000Z` ;
- la duplication batch applique la même politique et produit elle aussi `2027-10-31T00:30:00.000Z` ;
- les deux opérations aboutissent en `201`, restent atomiques et ne divergent pas selon le chemin move/duplicate.

## Négatifs et non-régression

- les heures locales inexistantes au passage à l'heure d'été restent refusées en `422 VALIDATION_ERROR` pour move et duplicate, sans mutation de la source ni copie partielle ;
- le rejeu idempotent d'un snapshot historique dont la ressource n'est plus dans le scope courant reste masqué en `404 NOT_FOUND` ;
- batch, conflits, versions, sélection rectangle, historique/Undo/Redo, autosave, cinq vues, Planning/Devis/O1, Auth/RBAC/CSRF, audit/SSE et persistance restent verts dans les **245/245** tests complets ;
- aucune nouvelle campagne navigateur ni mesure Performance indépendante n'est incluse dans cette re-QA ciblée.

## Verdict terminal

La re-QA ultime G4 est **APPROVED** : la politique DST ambiguë `earlier` est cohérente pour move et duplicate, les négatifs inexistante/replay scopes restent démontrés, les suites ciblées et complètes passent et aucun P0/P1/P2 QA n'est ouvert.

---

# Gate QA indépendant G5 — Ressources avancées et temps réel

Date : 2026-08-21 19:37 CEST  
Verdict : **APPROVED — 0 P0, 0 P1 QA ouvert**  
Périmètre : Sprint 5 (`US-068`, `US-070` à `US-076`) — double option, ressource générique et affectation, compétences et indisponibilités du personnel, présence/verrou court, synchronisation SSE, concurrence de trois sessions, idempotence et rollback Personnel.  
Indépendance : aucun code applicatif, test, contrat ou statut n'a été modifié pendant ce gate ; seul `docs/qa-report.md` est actualisé.

## Candidat exact vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

```text
server.js                                              54ec6fd513df647c578690317b64e5ba532626099c56282589f66519459b76b0
app.js                                                 400d3e045b9ee9caffdea1aa0f81559f21cd61c830267a6e0eb270ae4dcba0fa
planning.css                                           4016e6d89ac521cfc22eb42aad17ef16d54db5720e6e8df0bebf6c4739cc57d1
tests/api.test.js                                      080a40c806eaefac5a06d4aea8ab23dee35b5a25f3db13419338a31c0f1defe7
tests/planning-postproduction.test.js                  f2827562b1bfa54d52e3ed90f1dcb3c0a690945b6d750e082f941be43953b04a
tests/sprint5-realtime.test.js                         c7c7a0ea2f9451c55ead7ceae87170cba322b30df8244fb3e7199578f73f6747
tests/sprint5-migration.test.js                        d32231df043658ec415e3368f9f57763a6b5bcf280e793e8b62237dfadc441b7
docs/api/openapi-v1.yaml                               a588ec9eb527b62034f426369b45fa901324020bf6d4dca945a7068a033b5575
```

Les empreintes ont été recalculées avant et après les commandes ciblées et correspondent au candidat G5 annoncé.

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **37/37**, 0 échec/annulé/ignoré/TODO, 1 939,90 ms |
| `node --test tests/planning-postproduction.test.js` | PASS, **43/43**, 0 échec/annulé/ignoré/TODO, 128,51 ms |
| `node --test tests/sprint5-realtime.test.js` | PASS, **1/1**, 0 échec/annulé/ignoré/TODO, 2 098,40 ms |
| `node --test tests/sprint5-migration.test.js` | PASS, **1/1**, 0 échec/annulé/ignoré/TODO, 243,27 ms |
| `npm test` | PASS, **257/257**, 0 échec/annulé/ignoré/TODO, 8 566,66 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

Les tests HTTP utilisent uniquement le loopback et des fixtures temporaires isolées. Aucun accès réseau externe n'est requis. L'avertissement expérimental Node relatif à l'absence de `--localstorage-file` observé dans la suite Planning est sans effet sur les résultats.

## Vérifications fonctionnelles G5

### Double option et ressource générique

- deux options concurrentes restent visibles ; la priorité déterministe bloque la confirmation perdante avec `409 OPTION_PRIORITY_BLOCKED` sans annulation ni écrasement silencieux ;
- une réservation générique conserve sa catégorie, sa quantité et un identifiant d'allocation, sans fabriquer de salle ;
- son affectation vers une ressource réelle compatible est traçable et conserve l'identité de l'allocation ; le rejeu exact retourne le même résultat sans seconde mutation.

### Personnel, indisponibilités et PlanyBot

- compétences structurées et indisponibilités sont créées et relues dans le périmètre autorisé ;
- le rejeu exact d'une création Personnel réussit, tandis qu'un même identifiant d'opération avec un contenu divergent répond `409 IDEMPOTENCY_CONFLICT` ;
- deux indisponibilités qui se chevauchent sont refusées avec `409 PERSON_UNAVAILABILITY_OVERLAP` ;
- PlanyBot propose la personne lorsqu'elle est compétente et disponible, puis l'exclut pendant son indisponibilité ;
- un viewer ne peut pas créer une compétence (`403`), confirmant l'autorité RBAC serveur ;
- les formulaires et états structurés Compétences/Indisponibilités sont présents dans le consommateur Planning et disposent de styles dédiés.

### Trois sessions, SSE, présence et concurrence

- trois sessions distinctes sont ouvertes : un administrateur et deux sessions planificateur indépendantes ;
- les deux flux SSE planificateur reçoivent l'événement Personnel, puis les invalidations de réservation dans leur périmètre ;
- la première présence est acquise, la seconde session reçoit `423 RESERVATION_LOCKED`, et le verrou reste consultatif : l'autorité finale demeure la version optimiste ;
- une mutation concurrente valide aboutit, puis la requête portant l'ancienne version reçoit `409 VERSION_CONFLICT` et ne remplace pas la valeur canonique ;
- le logout libère la présence, permettant son acquisition par l'autre session ;
- après arrêt et redémarrage sur le même fichier de données, la réservation modifiée est conservée et un nouveau flux SSE reçoit une mise à jour post-redémarrage.

### Idempotence, audit et rollback

- les mutations Personnel couvertes exigent une clé d'idempotence ; les replays exacts n'ajoutent ni nouvelle entité ni seconde diffusion, et les contenus divergents sont rejetés ;
- les tests API complets maintiennent les contrôles Auth, CSRF, RBAC, isolation société/site, audit post-commit, SSE filtré et familles inconnues fermées ;
- la migration Personnel refuse tout rollback sans export préalable ; avec export privé obligatoire, elle retire le marker Sprint 5 Personnel et restaure le fichier source **byte-exactement** ;
- l'export de sauvegarde est créé avec le mode privé `0600`.

## Non-régression

Les **257/257** tests complets confirment l'absence de régression automatisée sur Fondations, Organisation, Stock, Ressources, Projets, Commercial/Devis, Planning, batch/Undo-Redo, fuseaux/DST, Auth/RBAC/CSRF, audit, SSE et migrations. Les vérifications syntaxiques, la vérification du build local et le contrôle d'espaces du diff sont verts.

## Limites explicites

- cette campagne QA est fonctionnelle et automatisée ; elle ne constitue pas une nouvelle campagne E2E navigateur ni une validation esthétique par le PO ;
- les performances sur 100 ressources / 10 000 réservations relèvent du gate Performance G5 indépendant et ne sont pas revendiquées par ce rapport ;
- la tenue prolongée de nombreuses connexions SSE et la récupération après une coupure réseau réelle ne sont pas simulées au-delà du redémarrage contrôlé couvert ;
- le rapport QA ne donne aucun verdict pour REVIEW, SECURITY, PERFORMANCE, INTEGRATION, E2E ou RELEASE.

## Verdict terminal QA G5

Le gate QA indépendant G5 est **APPROVED** sur les empreintes exactes ci-dessus : les suites ciblées et les **257/257** tests complets passent, lint/build/diff-check sont verts, et les parcours double option, ressource générique, personnel/indisponibilités, trois sessions, SSE, `423`, `409`, redémarrage, idempotence et rollback byte-exact sont démontrés. Aucun P0 ni P1 QA n'est ouvert.

---

# Re-QA G5 — candidat corrigé après REVIEW et SECURITY

Date : 2026-08-21 20:18 CEST  
Verdict : **APPROVED — les 6 P1 corrigés sont fermés, 0 P0/P1 QA ouvert**  
Périmètre : correction des quatre P1 REVIEW G5 et des trois P1 SECURITY G5, dont le défaut SSE commun aux deux gates ; non-régression Sprint 5 et modules antérieurs.  
Indépendance : aucun code applicatif, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat exact vérifié

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

```text
server.js                                              dd5d410a47670be5e50b313fa1634357f2b5718e645bde93c9987a0b368abe21
app.js                                                 04f7a5a9ce015e6d2ae00d1faa092f63023ded430c2c8dff11944f1e394f5054
planning.css                                           4016e6d89ac521cfc22eb42aad17ef16d54db5720e6e8df0bebf6c4739cc57d1
tests/api.test.js                                      a1833d491bd36782031a2d1ccb72d762990e9dab34f124045f1fa5b23e0bba72
tests/planning-postproduction.test.js                  9c5721e024c6e25161916c1a256202f1a289a80a86ae62e6b967764a714e061f
tests/sprint5-realtime.test.js                         d8b17b3ac2f35b70d654552920387f4108f2ad18e0b7763d1e334db9f9320cf9
tests/sprint5-migration.test.js                        d32231df043658ec415e3368f9f57763a6b5bcf280e793e8b62237dfadc441b7
docs/api/openapi-v1.yaml                               a588ec9eb527b62034f426369b45fa901324020bf6d4dca945a7068a033b5575
```

Les empreintes ont été recalculées avant la campagne et correspondent exactement au candidat corrigé transmis.

## Commandes et résultats frais

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **39/39**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/planning-postproduction.test.js` | PASS, **43/43**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/sprint5-realtime.test.js` | PASS, **1/1**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/sprint5-migration.test.js` | PASS, **1/1**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/quotes.test.js` | PASS, **47/47**, 0 échec/annulé/ignoré/TODO, 4 607,48 ms |
| `npm test` | PASS, **259/259**, 0 échec/annulé/ignoré/TODO, 8 591,69 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

Les premières exécutions ciblées ont toutes abouti. Des relances de collecte de résumé via pipeline ont ensuite rencontré ponctuellement `listen EPERM` dans le sandbox pour les suites HTTP ; elles ne sont pas comptées comme preuves réussies et n'invalident pas les exécutions directes antérieures ni la suite complète finale, toutes deux vertes.

## Fermeture des six P1

### 1. Option simple sans groupe

- confirmer une option non groupée n'active plus l'arbitrage de double option ;
- une seconde option simple indépendante conserve son statut, sa version et l'absence d'`optionDecision` ;
- l'arbitrage ne s'exécute que pour un `optionGroupId` non vide ; les options groupées conservent priorité, gagnant/perdant et alternatives structurées.

Statut QA : **FERMÉ**, démontré par le scénario API négatif dédié.

### 2. Permissions SSE fermées par famille

- le catalogue `ssePermissionsForEvent` associe explicitement Réservation/Personnel à `planning.read`, Ressource/Catégorie à `resource.read`, Commercial à ses permissions de lecture et les autres familles connues à leur permission canonique ;
- une famille inconnue retourne une liste vide et n'est jamais diffusée ;
- l'ouverture du flux exige au moins une permission de lecture admise et chaque événement revalide permission, session, société, site et scope d'entité.

Statut QA : **FERMÉ**, contrôlé par assertions contractuelles API et non-régression Auth/RBAC/SSE.

### 3. Présence sur les commandes clavier

- déplacements verticaux et horizontaux ainsi que redimensionnements clavier passent par `withPlanningPresence` avec l'intention `moving` ou `resizing` ;
- la mutation n'est déclenchée que si l'acquisition réussit et la présence est libérée dans le `finally` partagé ;
- la restauration du focus clavier reste exécutée après la commande.

Statut QA : **FERMÉ**, couvert par le test Planning ciblé du chemin clavier et par la suite complète.

### 4. Notification de libération au logout ou à l'expiration

- logout, expiration TTL et suppression explicite utilisent le helper unique `releaseReservationPresence`, qui retire le verrou puis émet `reservation.presenceReleased.v1` ;
- le scénario trois sessions attend effectivement cette invalidation sur l'autre flux avant de réacquérir la réservation ;
- le client recharge la présence aussi bien sur `reservation.presence.v1` que sur `reservation.presenceReleased.v1`.

Statut QA : **FERMÉ**. Le logout est exercé dynamiquement ; l'expiration utilise le même chemin canonique de libération.

### 5. Isolation du site des indisponibilités Personnel

- `personnelSnapshotAllowed` exige désormais explicitement `siteAllowed` lorsque l'instantané porte un `siteId`, en plus de la société et de l'adhésion visible ;
- un acteur limité à Paris reçoit `false` pour une indisponibilité Boulogne, tant lors de la lecture/relecture historique que dans `sseScopeAllowed` ;
- PlanyBot et les mutations conservent les contrôles de site à l'entrée.

Statut QA : **FERMÉ**, démontré par le négatif Paris/Boulogne.

### 6. Bornage des connexions SSE

- une session ne peut maintenir qu'un seul flux actif ; une seconde ouverture reçoit `429 SSE_SESSION_LIMIT` ;
- un plafond global serveur complète la limite par session et répond par une erreur stable lorsque la capacité est atteinte ;
- logout, révocation et fermeture réseau ferment le client et décrémentent la structure active.

Statut QA : **FERMÉ**, avec négatif HTTP de double flux sur la même session et régressions logout/révocation vertes.

## Non-régression et limites

- double option, ressource générique, personnel, PlanyBot, trois sessions, présence, concurrence `423`/`409`, idempotence, redémarrage et rollback byte-exact restent verts ;
- la suite complète à **259/259** confirme les modules Fondations, Organisation, Ressources, Stock, Projets, Commercial/Devis, Planning, DST, batch/Undo-Redo, Auth/RBAC/CSRF, audit, SSE et migrations ;
- la campagne QA ne remplace pas une nouvelle interaction navigateur réelle ni la validation esthétique du PO ;
- l'expiration TTL est vérifiée par son chemin partagé de libération, mais aucun test n'attend réellement vingt secondes ; le plafond global est inspecté et le plafond par session est exécuté. Un test par horloge contrôlée et un test saturant le plafond global renforceraient la couverture sans constituer un P0/P1 ouvert ;
- la charge prolongée SSE et les seuils volumétriques relèvent du gate Performance indépendant ; SECURITY doit rendre son propre verdict sur le candidat corrigé.

## Verdict terminal de re-QA G5

La re-QA G5 du candidat corrigé est **APPROVED** : les six P1 sont fermés, les suites ciblées passent, les **259/259** tests complets sont verts et lint/build/diff-check réussissent. Aucun P0 ni P1 QA n'est ouvert. Ce verdict ne vaut pas approbation des gates REVIEW, SECURITY, PERFORMANCE, INTEGRATION, E2E ou RELEASE.

---

# Re-QA finale G5 — isolation HTTP des indisponibilités Personnel

Date : 2026-08-21 20:22 CEST  
Verdict : **APPROVED — 0 P0/P1 QA ouvert**  
Périmètre : correctif final de la fuite inter-site sur `GET` et `DELETE /api/v1/person-unavailabilities`, puis non-régression complète.  
Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat final exact

```text
server.js                                              b9b6294f5816ca8ed12d7be1789127e4a9bc1f19d7f2e25a12ef8a3db5c0d200
app.js                                                 04f7a5a9ce015e6d2ae00d1faa092f63023ded430c2c8dff11944f1e394f5054
planning.css                                           4016e6d89ac521cfc22eb42aad17ef16d54db5720e6e8df0bebf6c4739cc57d1
tests/api.test.js                                      1e581cec20a6f19e82d91dee9fa953ec3d20858803f11a53e9652229c2ec342b
tests/planning-postproduction.test.js                  9c5721e024c6e25161916c1a256202f1a289a80a86ae62e6b967764a714e061f
tests/sprint5-realtime.test.js                         d8b17b3ac2f35b70d654552920387f4108f2ad18e0b7763d1e334db9f9320cf9
tests/sprint5-migration.test.js                        d32231df043658ec415e3368f9f57763a6b5bcf280e793e8b62237dfadc441b7
docs/api/openapi-v1.yaml                               a588ec9eb527b62034f426369b45fa901324020bf6d4dca945a7068a033b5575
```

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

## Preuves fraîches

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **40/40**, 0 échec/annulé/ignoré/TODO |
| `npm test` | PASS, **260/260**, 0 échec/annulé/ignoré/TODO, 8 585,64 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

## Vérification de la correction

- la liste `GET /api/v1/person-unavailabilities` filtre chaque élément avec `personnelSnapshotAllowed` et ne repose plus sur la seule visibilité de l'adhésion ;
- la suppression logique `DELETE /api/v1/person-unavailabilities/{id}` résout elle aussi la cible avec `personnelSnapshotAllowed` avant le contrôle de version ou toute mutation ;
- la fixture crée un acteur actif disposant de `planning.write` mais limité à `site_paris`, afin que le résultat négatif ne puisse pas être attribué à un simple manque de permission ;
- une indisponibilité située à `site_boulogne` et rattachée à une personne couvrant plusieurs sites n'apparaît pas dans la liste de cet acteur ;
- sa tentative de suppression reçoit `404 NOT_FOUND`, sans révéler l'existence de la cible ;
- une relecture administrateur confirme que l'indisponibilité Boulogne reste `confirmed`, avec sa version inchangée ; aucune mutation inter-site n'a eu lieu.

Le contrôle couvre désormais dynamiquement les deux consommateurs HTTP qui restaient permissifs. Il complète les preuves précédentes sur le replay idempotent historique et le routage SSE, déjà liés à `personnelSnapshotAllowed`.

## Non-régression et limites

- les six corrections G5 précédentes restent couvertes dans les **260/260** tests complets ;
- Auth, CSRF, RBAC, isolation société/site, double option, ressources génériques, présence, SSE, concurrence, personnel, PlanyBot, idempotence, rollback et modules antérieurs restent verts ;
- cette passe ne constitue pas une campagne navigateur ni un test de charge SSE ; ces axes restent aux gates E2E et Performance indépendants.

## Verdict terminal

La re-QA finale G5 est **APPROVED** sur les empreintes exactes ci-dessus. L'isolation Paris/Boulogne des indisponibilités est démontrée sur la lecture et la suppression avec un acteur pourtant autorisé à écrire sur son propre site, la cible hors site reste inchangée, et la suite complète passe à **260/260**. Aucun P0/P1 QA n'est ouvert.

---

# Re-QA post-release visuelle — route Équipe autonome

Date : 2026-08-22 21:29 CEST

Verdict : **REJECTED — 1 P1 QA ouvert**

Périmètre : route `#team`, indépendance vis-à-vis de l'étape O3, navigation, annuaire, compétences, indisponibilités et matrice `planning.read` / `planning.write`.

Indépendance : aucun code, test ou autre document modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat exact

```text
app.js                         707005ff708137c5b591868120fb6fd54ea9337bb7cda28e3e78eceb820faee8
tests/organization.test.js     5c512ddcb44bb0722121804f2ff0dd4051e21f65f7a99a1f6ba52dbd3f876ab3
server.js                      b9b6294f5816ca8ed12d7be1789127e4a9bc1f19d7f2e25a12ef8a3db5c0d200
```

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

## Preuves fraîches

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/organization.test.js` | PASS, **34/34**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/api.test.js` | PASS, **40/40**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/planning-postproduction.test.js` | PASS, **43/43**, 0 échec/annulé/ignoré/TODO |
| `npm test` | PASS, **261/261**, 0 échec/annulé/ignoré/TODO, 8 523,86 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

La route et son rendu statique sont bien raccordés : `team` appartient aux routes Organisation, appelle directement `teamPage()` avant la gouvernance O3, active l'entrée `team`, affiche le fil d'Ariane « Équipe », protège la lecture par `planning.read` et masque formulaires/boutons de mutation sans `planning.write`. Le test ajouté démontre seulement ce câblage par expressions régulières ; il n'exécute pas le parcours avec les rôles livrés.

## P1 — un planificateur autorisé ne reçoit pas l'annuaire nécessaire à la page Équipe

Le rôle de démonstration `planner` reçoit bien `planning.read` et `planning.write`, mais pas `membership.read`. Or `loadOrganizationData()` construit l'annuaire de `teamPage()` depuis `GET /api/v1/memberships`; il absorbe son `403` en remplaçant `organization.memberships` par une liste vide. Conséquences observables :

- « Membres actifs » vaut zéro au lieu d'afficher l'équipe accessible ;
- les compétences/indisponibilités éventuellement retournées ne peuvent plus résoudre les noms et affichent « Personne » ;
- les formulaires pourtant autorisés par `planning.write` ont un sélecteur Personne vide, donc la création n'est pas utilisable ;
- la promesse de droits `planning.read` / `planning.write` de la page autonome n'est pas tenue pour le rôle opérationnel principal.

Reproduction HTTP fraîche sur le serveur local du candidat, avec `planner@northlight.fr` :

```text
POST /api/v1/auth/login                         200
permissions                                    planning.read, planning.write (présentes)
GET /api/v1/memberships?pageSize=200           403 FORBIDDEN
GET /api/v1/person-skills?pageSize=200          200
GET /api/v1/person-unavailabilities?pageSize=200 200
```

Critère de fermeture : avec un acteur `planning.read` sans privilège de gouvernance, la page doit recevoir un annuaire personnel strictement borné à sa société et à ses sites, sans exposer les rôles/périmètres administratifs ; avec `planning.write`, les personnes autorisées doivent être sélectionnables pour créer une compétence ou une indisponibilité. Ajouter un test fonctionnel de rôle lecture seule et un test de planificateur, au-delà des assertions textuelles de route.

## Limite visuelle

Le serveur local a démarré correctement, mais aucun navigateur contrôlable n'était connecté à cette tâche (`agent.browsers.list()` vide). Aucun verdict esthétique n'est donc fabriqué. Le défaut P1 est néanmoins démontré dynamiquement au niveau des permissions/API et bloque la fonctionnalité avant même le rendu visuel.

## Verdict terminal

La re-QA post-release de la page Équipe est **REJECTED**. Le câblage autonome, l'entrée active, le fil d'Ariane et la séparation lecture/écriture sont présents dans le frontend, et les **261/261** tests restent verts, mais le rôle Planificateur ne peut pas charger l'annuaire indispensable à l'usage de la page. Un P1 QA reste ouvert ; le candidat doit retourner en DEV puis repasser QA.

---

# Re-QA finale post-release — page Équipe et annuaire opérationnel

Date : 2026-08-22 21:42 CEST

Verdict : **APPROVED — 0 P0/P1 QA ouvert**

Périmètre : fermeture du P1 annuaire `#team`, endpoint `/api/v1/personnel-directory`, séparation avec la gouvernance, permissions de lecture/écriture, isolation société/site et non-régression.

Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat final exact

```text
server.js                      8b1e180f94c0101342e4ecda6258e23d5ddafd99c1e9caecdff5cbbd3c51063a
app.js                         8a122679a279beedb6c0d6cd8f0bf9197a36124bc60c55bef25d35b93f9823b7
index.html                     edada446944aa48c1782028dc52e8b35cf00589156a3016ab0a2cd1bf97504ae
planning.css                   4016e6d89ac521cfc22eb42aad17ef16d54db5720e6e8df0bebf6c4739cc57d1
tests/api.test.js              f5c788f3cf74e1fb810b0730a8d18269922179eca7576eeec6ff02bbeb08d2f3
tests/organization.test.js     665257902c792725f0978a5726238eafb5596b2b8059b164dd9169c93741fe16
docs/api/openapi-v1.yaml       75a83115cbeb5712f237884cc9144726e8cfa5b9e0a455d98ab386c1048e2c1e
```

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

## Preuves fraîches

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/api.test.js` | PASS, **41/41**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/organization.test.js` | PASS, **34/34**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/planning-postproduction.test.js` | PASS, **43/43**, 0 échec/annulé/ignoré/TODO |
| `npm test` | PASS, **262/262**, 0 échec/annulé/ignoré/TODO, 8 401,69 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

## Fermeture du P1 précédent

La page Équipe ne dépend plus de la collection de gouvernance `organization.memberships`. Elle charge une collection séparée `personnelAdmin.directory` depuis `/api/v1/personnel-directory`, sous la permission `planning.read` :

- le DTO ne contient que `id`, `displayName`, `jobTitle` et `defaultSiteId` ; aucun e-mail, identifiant utilisateur, rôle ou scope de gouvernance n'est exposé ;
- les membres sont actifs, de la société courante et filtrés par `membershipAllowed`; un site par défaut hors périmètre n'est pas révélé ;
- l'API de gouvernance `/api/v1/memberships` reste refusée au planificateur sans `membership.read` ;
- l'annuaire opérationnel alimente le compteur, les libellés et les deux sélecteurs « Personne » des formulaires Compétence et Indisponibilité ;
- le lien « Gérer les accès » est rendu uniquement avec `membership.read`, tandis que les formulaires et commandes restent conditionnés par `planning.write` ;
- la route `#team` reste autonome et ne consulte pas l'état verrouillé de l'étape O3.

Reproduction HTTP indépendante sur le serveur local du candidat :

```text
Planificateur : GET /api/v1/personnel-directory?pageSize=200   200
               2 membres : Camille Martin, Alex Bernard
               champs exacts : id, displayName, jobTitle, defaultSiteId
Planificateur : GET /api/v1/memberships?pageSize=200           403
Lecteur :       GET /api/v1/personnel-directory?pageSize=200   200
```

Les tests ajoutés vérifient aussi le périmètre Paris/Boulogne et l'absence de champs sensibles ; les tests Personnel existants maintiennent les refus d'écriture du lecteur et les filtres des compétences/indisponibilités.

## Limite visuelle indépendante

Aucun navigateur contrôlable n'était attaché à cette tâche de re-QA. Le contrôle navigateur réel du développeur (planificateur, deux membres et deux sélecteurs remplis, aucune commande de gouvernance) n'est donc pas revendiqué comme preuve QA indépendante. La fermeture est néanmoins démontrée dynamiquement par les rôles/API réels, par le contrat frontend et par les suites ciblées. Une dernière recette esthétique PO reste distincte du verdict technique.

## Verdict terminal

La re-QA finale de la page Équipe est **APPROVED**. Le P1 est fermé sans promouvoir le planificateur vers la gouvernance : l'annuaire minimal est lisible et scopé, les sélecteurs sont alimentés, les données sensibles restent absentes et le lien d'administration est masqué sans `membership.read`. Les suites ciblées et les **262/262** tests complets passent ; aucun P0/P1 QA n'est ouvert.

---

# Gate QA indépendant G6 — PlanyBot et import Excel

Date : 2026-08-23 10:21 CEST

Verdict : **APPROVED — 0 P0/P1 QA ouvert**

Périmètre : candidat Git exact `cdc475c9ff015531e662327dbdc9d7c2e82f6aa8`, US-057 à US-060 et US-062 à US-064, non-régression des modules antérieurs.

Indépendance : aucun code, test, contrat ou statut modifié ; seul `docs/qa-report.md` est actualisé.

## Candidat exact

```text
server.js                                           2c8b7d270daee986524a6011dc1aa9551312af0a4c3dcab8dffe031fc116f372
app.js                                              2bef5de38aa129788b35b6e05a767390635d368984a02609079b0d8fa309c480
planning.css                                        788b3e981245b1927ce2f726b980ac2772848a16ca2c42d69f12c81a7ef1f99d
tests/plany.test.js                                 9ea6407fb3b76b756584c2666d9e184a52f6ad9fcfc0380853baab1529f72687
tests/quotes.test.js                                20a28dc983e91b8aa0219ed79d8cac3739c0588d9ef19c19126f81accd86e9e2
tests/api.test.js                                   f5c788f3cf74e1fb810b0730a8d18269922179eca7576eeec6ff02bbeb08d2f3
tests/sprint6-plany-migration.test.js               317fbbf11e4e341be7220d7893e3f59c7f45f970c4e357ea721912949d6f801b
docs/specifications/sprint-6-planybot-excel.md      f498e70b697950cbf687d0ddcb9abb8c804114112505f9aef8a7e38adc9437a5
docs/api/openapi-v1.yaml                            8eb7cba34b35f9600d4f64bc76993d3cbbc27bc22e59382343e92356b58d2bf3
```

Environnement : Node `v26.6.0`, Darwin `25.5.0` arm64.

Le dépôt contenait avant cette passe une modification non QA de `docs/project-status.md`. Elle n'a été ni modifiée ni restaurée par le reviewer ; l'intégrateur doit mettre le statut G6 à jour sur le candidat figé.

## Preuves fraîches

| Commande exacte | Résultat observé |
|---|---|
| `node --test tests/plany.test.js` | PASS, **12/12**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/quotes.test.js` | PASS, **48/48**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/sprint6-plany-migration.test.js` | PASS, **1/1**, 0 échec/annulé/ignoré/TODO |
| `node --test tests/api.test.js` | PASS, **41/41**, 0 échec/annulé/ignoré/TODO |
| `npm test` | PASS, **267/267**, 0 échec/annulé/ignoré/TODO, 8 858,19 ms |
| `npm run lint` | PASS, code 0 |
| `npm run build` | PASS, code 0 ; **5 actifs runtime** vérifiés |
| `git diff --check` | PASS, code 0 |

## Vérification des critères G6

### US-057 / US-058 — interface et dialogue contextualisé

- PlanyBot est présenté comme un panneau distinct, repliable, attaché au Planning et non comme une mutation implicite du calendrier ;
- le dialogue restitue des faits structurés issus des objets autorisés : disponibilités, résumé projet, conflits, personnel et phases d'analyse du planning client ;
- les quantités et périodes annoncées sont calculées depuis les données visibles, sans fabrication de réservation ou de montant ;
- les messages et états d'analyse sont exposés dans des zones `aria-live="polite"`, les commandes sont des boutons natifs, l'ouverture place le focus dans la saisie, `Échap` ferme le panneau et le focus revient à l'élément déclencheur.

Statut : **conforme sur contrat et tests de source**.

### US-059 — recommandations explicables et déterministes

- les ressources occupées ou hors société/site/scope sont exclues avant classement ;
- l'ordre observé est : disponibilité, continuité projet, préférence tarifaire client, site projet, coût interne configuré, puis nom/identifiant stable ;
- chaque recommandation expose ses raisons métier ;
- le coût interne ne figure pas dans la réponse d'un acteur dépourvu de `finance.read`, et la préférence commerciale n'est calculée qu'avec `quote.read`.

Statut : **conforme**, y compris le négatif de non-divulgation du coût.

### US-060 — prévisualisation, confirmation et concurrence

- une demande de réservation crée une proposition persistée et auditée mais laisse le nombre de réservations inchangé ;
- la réservation n'est créée qu'après confirmation explicite avec digest exact et `planning.write` ; le serveur revalide société, acteur, projet, site, ressource, versions sources, disponibilité et capacité au moment de confirmer ;
- digest divergent : `409 PLANY_PROPOSAL_CHANGED` sans mutation ; même clé et même corps : replay unique ; même clé avec corps divergent : `409 IDEMPOTENCY_CONFLICT` ;
- lecture d'une proposition d'un autre acteur : `404` ; confirmation par lecteur : `403` ; refus : aucune réservation créée ;
- un seul audit d'exécution et une seule réservation subsistent après rejeu.

Statut : **conforme**. Le contrôle explicite de version source est présent dans le chemin canonique ; le corpus automatise le digest obsolète, le replay et la divergence, mais ne modifie pas artificiellement une ressource entre préparation et confirmation.

### US-062 / US-063 — import borné et clarification humaine

- l'analyse Excel/CSV/PDF est bornée à 5 Mo et 250 lignes ; elle produit une analyse sans réservation ni mutation commerciale automatique ;
- une ligne `ambiguous` ou `unmatched` bloque la prévisualisation par `409 CLIENT_PLANNING_CLARIFICATION_REQUIRED` ;
- la correction humaine exige une ligne de devis, une ressource, dates/heures/durée valides, une confirmation et un motif ;
- la prévisualisation consomme exclusivement la dernière révision et refuse toute sélection qui diverge d'une correction confirmée ;
- l'analyse initiale reste inchangée, les révisions sont append-only, numérotées, digérées, attribuées et datées ; replay identique unique, divergence refusée ;
- un import dans un budget reste préparatoire et ne crée aucun planning ; un import dans un devis brouillon résout les tarifs côté serveur et ne crée aucune réservation.

Statut : **conforme**.

### US-064 — RBAC, scopes, audit et rollback

- authentification et CSRF sont exigés sur les mutations ; les permissions `planning.read`, `planning.write`, `quote.read`, `quote.manage`, `finance.read` et `audit.read` sont appliquées au serveur ;
- les contrôles société, site, projet, ressource et propriétaire de conversation/proposition sont rejoués aux lectures et confirmations ;
- l'audit couvre la proposition préparée, exécutée ou refusée ainsi que la clarification d'import, avec identifiants, digests, versions et acteur ; la consultation générale reste sous `audit.read` ;
- la migration est additive et idempotente, crée une sauvegarde privée, vérifie son digest et restaure les octets d'origine à l'identique.

Statut : **conforme**.

## Non-régression et limites

- les **267/267** tests complets confirment la non-régression Auth/CSRF/RBAC, isolation société/site, Organisation, Ressources, Stock, Commercial/Devis, Planning, présence/SSE, batch, DST, audit et migrations ;
- aucun navigateur contrôlable n'était attaché à cette tâche (`agent.browsers.list()` vide). Le verdict QA ne revendique donc pas de recette visuelle réelle, de contraste calculé ni de navigation assistive complète ; le contrôle porte sur le contrat DOM/CSS, les gestionnaires clavier/focus et les tests automatisés. La recette navigateur et l'acceptation esthétique PO restent à exécuter au gate E2E ;
- la campagne QA ne remplace pas les verdicts indépendants REVIEW, SECURITY et PERFORMANCE ;
- aucun P0/P1 fonctionnel n'a été observé. La simulation explicite d'une modification de ressource entre préparation et confirmation renforcerait la couverture automatisée du `PLANY_PROPOSAL_STALE`, sans remettre en cause le contrôle serveur inspecté.

## Verdict terminal

Le gate QA indépendant G6 du candidat Git `cdc475c9ff015531e662327dbdc9d7c2e82f6aa8` est **APPROVED** : les critères US-057..060 et US-062..064 sont couverts, aucune réservation n'est créée avant confirmation, les ambiguïtés imposent une clarification versionnée, les replays/divergences et droits/scopes sont correctement traités, la migration est réversible byte-exact et les **267/267** tests passent. Aucun P0/P1 QA n'est ouvert. Ce verdict ne vaut pas approbation des gates REVIEW, SECURITY, PERFORMANCE, INTEGRATION, E2E ou RELEASE.
