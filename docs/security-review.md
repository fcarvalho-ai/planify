# Revue SECURITY indépendante — G6 PlanyBot et import Excel

Date : 2026-08-23

Candidat Git : `cdc475c9ff015531e662327dbdc9d7c2e82f6aa8`

Verdict : **REJECTED — 0 P0, 2 P1, 0 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `2c8b7d270daee986524a6011dc1aa9551312af0a4c3dcab8dffe031fc116f372` |
| `app.js` | `2bef5de38aa129788b35b6e05a767390635d368984a02609079b0d8fa309c480` |
| `tests/plany.test.js` | `9ea6407fb3b76b756584c2666d9e184a52f6ad9fcfc0380853baab1529f72687` |
| `tests/quotes.test.js` | `20a28dc983e91b8aa0219ed79d8cac3739c0588d9ef19c19126f81accd86e9e2` |
| `docs/api/openapi-v1.yaml` | `8eb7cba34b35f9600d4f64bc76993d3cbbc27bc22e59382343e92356b58d2bf3` |
| `docs/specifications/sprint-6-planybot-excel.md` | `f498e70b697950cbf687d0ddcb9abb8c804114112505f9aef8a7e38adc9437a5` |

## Constats bloquants

### P1 — SEC-G6-01 — un rejeu PlanyBot peut restituer des faits devenus hors périmètre

Dans `planyPostMessage`, le chemin de rejeu idempotent contrôle de nouveau uniquement les `projectId` et `siteId` du `context` fourni, puis renvoie directement `existing.result` (`server.js:1324-1332`). Or `planyAnswer` peut déduire un projet et des ressources depuis le texte du message sans qu'ils figurent dans ce contexte. La conversation ne mémorise ensuite que les identifiants du contexte explicite (`server.js:1332-1340`).

Conséquence : après réduction des scopes projet/site/entité, rejouer la même clé, le même message et un contexte vide peut restituer le résultat précédemment autorisé contenant noms, identifiants, disponibilité ou synthèse d'un projet/ressource désormais interdit. Le même défaut de provenance rend aussi l'historique insuffisamment revalidable lorsqu'une conversation créée sans contexte explicite contient des faits inférés. Cela contredit l'exigence Sprint 6 de revalidation des permissions courantes sur chaque lecture et chaque rejeu.

Condition de fermeture : persister la provenance complète des entités exposées, puis revalider tenant, site, projet et entités avant tout rejeu/historique ; ajouter un test négatif avec retrait de scopes entre la première réponse et le rejeu.

### P1 — SEC-G6-02 — quota décompressé agrégé absent sur les fichiers clients

Le fichier encodé est plafonné, et chaque entrée ZIP déflatée est individuellement limitée à 20 MiB. Cependant, `clientPlanningZipEntries` accepte jusqu'à 2 000 entrées et conserve chaque résultat dans une `Map`, sans plafond sur le total décompressé (`server.js:1961-1966`). Les flux PDF déflatés suivent également un plafond par flux, sans budget cumulé (`server.js:1999`).

Un fichier compressé inférieur à 5 MiB peut donc provoquer plusieurs gigaoctets de décompression cumulée. Le traitement utilise `inflateRawSync`/`inflateSync` sur le thread HTTP principal : un utilisateur autorisé à importer peut épuiser mémoire et CPU et rendre le service indisponible. Les limites par fichier et par nombre d'imports ne protègent pas contre ce cas.

Condition de fermeture : budget cumulé strict pour octets décompressés, feuilles, lignes, colonnes, cellules et chaînes, interruption fail-closed avant allocation excessive, puis tests ZIP/PDF bomb et limites exactes.

## Contrôles satisfaisants observés

- Authentification et CSRF/origine sont exigés sur les mutations ; la confirmation d'une proposition exige `planning.write`.
- Les propositions sont privées à l'utilisateur, bornées, expirables, revalident projet/site/ressources et utilisent versions, digest et idempotence avant mutation.
- Le classement ne renvoie pas les coûts internes sans `finance.read`; les préférences commerciales exigent `quote.read`.
- Les ressources, réservations, projets et fichiers sont filtrés société/site/entité sur les chemins normaux.
- Les fichiers importés sont nommés côté serveur par digest, stockés hors liste statique avec modes répertoire `0700` et fichier `0600`; aucun nom utilisateur ne choisit un chemin.
- Les formules Excel ne sont pas exécutées, les entrées ZIP ne deviennent pas des chemins locaux et les sorties PlanyBot examinées passent par l'échappement HTML.
- Audit et SSE interviennent après succès des mutations ; l'audit des messages conserve longueur/intention plutôt que le texte libre.
- Migration additive avec marqueur d'intégrité, sauvegarde source et rollback byte-exact documenté dans l'implémentation.

## Preuves fraîches

- `node --test tests/plany.test.js tests/quotes.test.js` — Node `v26.6.0`, 2026-08-23 : **60/60 PASS**, 0 échec, durée `5020 ms`.
- Inspection indépendante ciblée de l'auth, CSRF, RBAC/scopes, rejeux, conversations, coûts, stockage fichier, parseurs XLSX/PDF/CSV, quotas, audit/SSE et migration sur les empreintes ci-dessus.

La suite verte démontre les cas couverts, mais elle ne contient ni retrait de scope avant rejeu ni attaque par volume décompressé cumulé ; elle ne ferme donc pas les deux constats.

## Limites

- Aucun fichier malveillant volumineux n'a été exécuté afin de ne pas mettre en danger la machine de travail.
- Aucun pentest ou fuzzing externe ; revue locale statique et tests HTTP ciblés.
- `docs/project-status.md` est laissé à l'intégrateur conformément à l'ownership demandé.

## Verdict

Les contrôles usuels sont solides, mais les deux P1 permettent respectivement une restitution après révocation de droits et un déni de service par décompression cumulée. **SECURITY REJECTED** jusqu'à correction et revalidation indépendante.
