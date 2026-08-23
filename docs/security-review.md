# Gate SECURITY indépendant S7-C — Backlog, Forecast et chaîne de revenus

Date : 2026-08-23

Candidat exact : `05f65c54851701e2ada724d22fed7987edfeef08`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 4 P2 ouverts.**

Les trois lectures S7-C sont protégées par `finance.read` et construisent leurs totaux, compteurs et drill-down uniquement à partir des lignes autorisées. Les scopes Société, Site, Projet, Client, Devis, Ressource/Prestation sont appliqués avant agrégation. Le transfert d'un dépassement du Devis principal vers un complément n'a lieu que si ce complément fait lui-même partie des lignes visibles : un complément masqué ne contribue ni aux montants, ni aux `sourceCount`, ni aux identifiants retournés.

## Autorisation et isolation

- **Permission :** toute la famille `/api/v1/analytics/*` exige `finance.read` avant dispatch. C'est conforme à la SPEC Sprint 7, qui définit cette permission comme l'autorité de lecture du CA, du facturable et des analyses Finance. Le rôle standard `FINANCE` possède aussi `quote.read`; aucun droit d'écriture Devis/Planning n'est ajouté par ces routes GET.
- **Société/Site/Projet/Client/Devis :** `financeFlowLineRows()` construit d'abord la map des Projets autorisés avec `companyId`, `projectAllowed`, `clientAllowed` et `siteAllowed`; il ne retient ensuite que les Devis acceptés autorisés par `quoteAllowed`.
- **Ressources et prestations :** chaque ligne passe `financeQuoteLineAllowed`. Réservations et réalisés sont filtrés par les snapshots autorisés, les scopes Ressource et la provenance Devis avant d'être indexés par ligne.
- **Principal visible / complément masqué :** les compléments sont recherchés uniquement dans `rows`, déjà filtré. Un complément hors scope n'est donc ni alimenté ni compté; le dépassement provenant d'un Actual autorisé reste facturable sur la ligne principale visible, sans révéler l'existence, le numéro, le montant ou la capacité du complément masqué.
- **Absence d'inférence :** `totals`, `sources`, `itemCount`, fenêtres et groupes sont recalculés sur ce sous-ensemble. Les listes d'IDs proviennent des mêmes Réservations/Actuals autorisés; aucune somme globale n'est calculée puis filtrée. Les réponses n'exposent ni montant ni `sourceCount` d'un complément invisible.
- **Temporalité :** `asOf` est une date bornée et validée; les Actuals dont la fin est postérieure sont exclus avant calcul. Les lignes analytiques `planned`, `actual` et `billable` gardent la date de leur source, ce qui permet à Revenue Chain d'appliquer `from`/`to` sans réattribuer les événements.
- **Sortie/OpenAPI/UI :** les endpoints et schémas structurés Backlog/Forecast documentent la permission, `asOf`, la validation 422 et la provenance `quoteId`/`quoteVersionId`/`quoteLineId`. L'UI ne charge Finance qu'avec `finance.read` et échappe les labels/identifiants affichés. Aucune mutation, persistance, CSRF, audit ou SSE sensible n'est introduite par S7-C.

## P2 importants / limites

1. Le cas négatif automatisé « principal visible, complément hors scope » n'est pas isolé dans un test dédié. La construction filtrée rend le canal fermé par inspection, mais une fixture explicite protégerait mieux ce contrat.
2. Un rôle personnalisé doté de `finance.read` sans `quote.read` peut lire le drill-down Finance — autorisé par la définition de `finance.read` — tandis que `actualRecordAllowed()` écarte les Actuals liés à un Devis faute de `quote.read`. Le rôle standard Finance possède les deux droits; documenter ou valider cette dépendance éviterait un résultat incomplet pour un rôle personnalisé.
3. Plusieurs sous-objets OpenAPI (`sources`, `filters`, `freshness` et certaines propriétés d'item) restent extensibles via `additionalProperties`; aucun champ non autorisé n'est actuellement produit, mais des DTO entièrement fermés limiteraient le risque d'une future dérive de réponse.
4. La coupure `asOf` des Actuals utilise la date UTC de `endsAt` (`slice(0, 10)`) plutôt que la date métier du site. Il n'y a pas de fuite inter-scope, mais une réalisation proche de minuit peut changer de jour par rapport au fuseau local.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- HEAD : `05f65c54851701e2ada724d22fed7987edfeef08`.
- Hashes : `server.js` `fe2c0714ae125515ab4faa61c6141518ac5ad860654e2247bc1fbd8281f456ca`; `app.js` `608f84b3235c746e997077e596d562c9b3588d3af52fc650de7333806285f571`; `tests/sprint7-forecast.test.js` `25948794870bc01963e8d96505d62cd868713c7052a94b5a4c060238490d8351`; OpenAPI `019e16ad0c2dc531fc5670a6525da4aa24efa877ecdc9e296c2af3e802dfb8d3`.
- `node --test tests/sprint7-forecast.test.js` : **PASS, 6/6**, `85,79 ms`; couvre `asOf`, conservation d'arrondi, transfert principal/complément, scopes Ressource et planned/actual/billable.
- Inspection fraîche des routes, de `financeFlowLineRows`, `financeFlowAnalyticRows`, `revenueChain`, `financeBacklog`, `financeForecast`, des helpers de scopes et des schémas OpenAPI.
- La suite complète du même candidat a été exécutée par la REVIEW/QA indépendante et n'est pas revendiquée comme une nouvelle preuve SECURITY.

L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Revalidation SECURITY indépendante S7-B — alignement frontend import tarifaire

Date : 2026-08-23

Candidat exact : `37a133762bc7626cc9b51bc9577a52a44c3820ec`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 3 P2 ouverts.**

Le serveur est byte-identique au candidat `3819b0d` déjà approuvé (`server.js` `d5e7adef…`). Le diff courant ajoute une défense UX cohérente avec l'autorité serveur : l'import d'une grille client n'est visible et invocable que si l'utilisateur possède simultanément `client.manage` et `finance.cost.manage`.

## Contrôles ciblés

- **Fail-closed UI :** le bouton est retiré lorsque l'une des deux permissions manque. Trois entrées programmatiques sont également enveloppées (`open`, `preview`, `confirm`) et refusent avant ouverture ou appel API. Ainsi, une régression du masquage visuel ne suffit pas à déclencher le parcours depuis le frontend.
- **RBAC serveur :** aucune autorité n'est déplacée vers le navigateur. `POST /clients/:id/rate-card-imports` conserve le contrôle serveur `finance.cost.manage` avant parsing, fichier, mutation, audit et SSE ; `client.manage` reste appliqué par le routeur/handler. Un client HTTP direct ne contourne donc pas les wrappers.
- **Session/permissions :** `can()` consulte les permissions de la session chargée. En mode API, une permission absente ou un utilisateur absent produit `false`. Le mode prototype explicite conserve son comportement historique local et ne devient pas un fallback commercial API.
- **XSS :** le diff n'introduit aucune donnée utilisateur, interpolation HTML ou nouveau sink. Il ne fait que supprimer une chaîne HTML statique et substituer un texte statique. Les données de la fiche restent échappées par le rendu de base.
- **CSRF/isolation :** aucune modification ; les appels continuent de passer par le client API commun et le serveur approuvé.

## P2 importants / limites

1. Le masquage du bouton repose sur une substitution de chaîne exacte après rendu. Les gardes d'action maintiennent la sécurité, mais un rendu déclaratif par permission serait moins fragile pour l'UX.
2. Le test ajouté est une inspection statique de tokens/regex ; il ne monte pas le DOM avec les quatre matrices de permissions pour vérifier bouton, focus et absence de requête.
3. La révocation dynamique d'une permission pendant qu'un drawer déjà ouvert reste affiché n'a pas de test navigateur. La garde `preview`/`confirm` relit toutefois `can()` au moment de l'action et le serveur reste autoritaire.

## Preuves

Environnement : macOS arm64, Node `v26.6.0`.

- Hashes : `server.js` `d5e7adefdde78db2cc9ebdd53613edf5d7abf17d89e7844f0d98e971a397c5e7`; `app.js` `2af7b4560d9ecd650c7c847ad957b1b702df86f133d79c075b3116cc8d2cf34d`; `tests/clients.test.js` `5ff3d19c19c3da9565e168ff8a0747cd6a15a1209c42147a8d4de30d3e4815cd`.
- `node --check app.js && node --check tests/clients.test.js` : **PASS**.
- `git diff --check 3819b0d..37a1337` : **PASS**.
- Inspection fraîche du diff exact, de `can()`, des bindings de formulaire et de l'autorité serveur inchangée.
- Aucun test HTTP ou serveur long relancé : le seul test modifié ajoute une assertion statique frontend et le backend exact est celui du gate précédent.

L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Revalidation finale SECURITY indépendante S7-B — autorité d'écriture des coûts

Date : 2026-08-23

Candidat exact : `3819b0d3490531082fc4efe26c44fffed44f388d`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 3 P2 ouverts.**

`SEC-S7B-11` est fermé sur les trois voies d'écriture identifiées. La permission `finance.cost.manage` est désormais contrôlée côté serveur, indépendamment de l'UI, avant toute modification persistante du coût interne.

## Fermeture de SEC-S7B-11

- **Lignes Devis — POST/PATCH :** `quoteLineFromInput` refuse tout payload possédant explicitement `costUnitMinor` sans `finance.cost.manage`. Pour POST et PATCH, ce contrôle s'exécute avant insertion/remplacement de ligne, recalcul, version commerciale et audit. Il se trouve dans la fonction atomique `mutate`; une exception empêche `atomicWrite`, puis la branche rejetée n'exécute ni `emit` ni `send` de succès.
- **Création de tarif — `POST /api/v1/rates` :** `createRateCommand` vérifie `finance.cost.manage` avant l'appel à `mutate`; aucun marqueur d'idempotence, tarif, audit, persistance ou SSE n'est créé lors du refus.
- **Activation d'une grille client — `POST /clients/:id/rate-card-imports` :** après le contrôle d'existence/scoping du client, la permission Finance est vérifiée avant lecture du corps, prévisualisation, création de fichier, marqueur d'idempotence, mutation, audit et SSE.
- **Conservation administrateur :** le rôle `organizationAdmin` possède `finance.cost.manage` dans la matrice et la migration S7 Finance l'ajoute aux rôles existants. Les parcours positifs administrateur de création de tarif et d'activation de grille restent présents dans `tests/clients.test.js`; les mutations Finance dédiées restent également couvertes.
- **Absence de contournement UI :** l'UI continue de masquer et d'omettre `costUnitMinor` sans `finance.cost.manage`; le serveur refuse maintenant un client HTTP direct.

## Isolation, réponses et contrats inchangés

- La projection commerciale sans `finance.read`, l'audit Finance redacted, le dashboard Projet restreint et le SSE compact validés sur `4c6c2ae` ne sont pas modifiés par ce correctif.
- Le contrôle d'import conserve le 404 d'isolation client avant le 403 de permission, sans révéler l'existence d'un client hors périmètre.
- L'OpenAPI décrit maintenant explicitement l'exigence conjointe `quote.manage` + `finance.cost.manage` pour créer un tarif et marque `costUnitMinor` comme donnée interne.

## P2 importants / limites

1. Les tests négatifs frais couvrent la ligne Devis, la création de tarif et l'import client, ainsi que l'absence de modification des collections principales ; ils ne comptent pas explicitement audit, SSE et marqueurs d'idempotence avant/après pour les trois refus.
2. La blacklist récursive de réponse dépend des noms actuels de champs ; des DTO positifs typés resteraient plus robustes face à un futur alias financier.
3. La révocation dynamique de permission/scope Finance après création n'a toujours pas de matrice exhaustive GET/PATCH/replay/SSE.

## Preuves

Environnement : macOS arm64, Node `v26.6.0`.

- Hashes : `server.js` `d5e7adefdde78db2cc9ebdd53613edf5d7abf17d89e7844f0d98e971a397c5e7`; `app.js` `abf8882c11b07f132ce8cdcb8e4ce480225194d7be34bb4f7ad06d31e0881d8d`; `tests/sprint7-finance.test.js` `041df67f0e9e976566105030ff09529df06b6b093b44711b4090bb0f1c550662`; `docs/api/openapi-v1.yaml` `5491260431b6d8869fc6a3cf8a3e43371a169e746d37047eeb7474ceea9acc25`.
- `node --check server.js && node --check app.js && node --check tests/sprint7-finance.test.js && node --check tests/clients.test.js` : **PASS**.
- `git diff --check 4c6c2ae..3819b0d` : **PASS**.
- Inspection fraîche du diff exact, de `mutate`, de la matrice/migration des permissions, des handlers et consommateurs de tests.
- Aucune campagne HTTP longue n'a été relancée ; les preuves fonctionnelles complètes du candidat doivent rester celles du gate QA/intégration portant sur ce même hash.

L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Revalidation SECURITY indépendante S7-B — projection commerciale et autorité serveur

Date : 2026-08-23

Candidat exact : `4c6c2aea1c6b540f427a1a2e9ceb9d2e05c17854`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 3 P2 ouverts.**

`SEC-S7B-10` est fermé pour les **lectures** : la projection centralisée couvre les Devis/Budgets, leurs versions et replays, le catalogue, les grilles et tarifs, les imports client et le dashboard Projet ; elle retire récursivement les coûts, marges et snapshots internes lorsqu'il manque `finance.read`. L'interface masque également les vues Finance sans `finance.read` et la saisie de coût sans `finance.cost.manage`; `RateResponse` documente l'absence possible de `costUnitMinor`.

Un contournement bloquant subsiste cependant sur les **mutations directes de l'API** : masquer la réponse ne protège pas l'intégrité des coûts enregistrés.

## P1 bloquant

### SEC-S7B-11 — mutation de coûts internes sans `finance.cost.manage`

Un rôle commercial/planning sans `finance.read` ni `finance.cost.manage` peut encore écrire des coûts internes en appelant directement l'API :

- l'ajout ou la modification d'une ligne Devis accepte `costUnitMinor` sous la seule autorité `quote.manage`; le contrôle `quote.overridePrice` ne concerne que le prix de vente ;
- `POST /api/v1/rates` accepte `costUnitMinor` sous `quote.manage` via `createRateCommand` ;
- l'import d'une grille client peut persister la colonne de coût sous `client.manage`.

Le DTO de réponse retire ensuite le coût, mais la mutation est déjà atomiquement enregistrée et influence `costTotal` et les marges. L'UI du candidat exige correctement `finance.cost.manage`; le serveur, qui reste l'autorité, ne reproduit pas cette règle. Un client HTTP peut donc contourner l'interface et altérer aveuglément les données Finance.

Correction requise : refuser tout champ de coût explicite sans `finance.cost.manage` (ou préserver strictement le coût résolu existant lorsque le cas d'usage ne l'autorise pas), sur lignes Devis, tarifs et imports. Ajouter des tests HTTP négatifs pour les rôles commercial/planning et vérifier qu'un refus ne produit ni écriture, ni audit métier, ni SSE, ni résultat d'idempotence rejouable.

## Fermetures confirmées

- **Lectures et replays commerciaux :** `send()` applique une projection récursive aux familles de routes commerciales identifiées ; `finance.read` conserve la réponse complète.
- **Audit et dashboard :** les entités Finance sont redacted sans `finance.read`; le dashboard Projet ne construit pas les quatre indicateurs coût/marge dans ce cas.
- **SSE :** les événements restent des invalidations compactes sans valeur financière.
- **UI :** visibilité Finance liée à `finance.read`; champ et payload de coût liés à `finance.cost.manage`. Aucun droit UI n'est considéré comme une autorisation serveur.
- **OpenAPI :** `RateResponse` distingue correctement la réponse complète de la projection sans `costUnitMinor`; ce contrat de sortie ne ferme pas le défaut d'autorisation d'entrée ci-dessus.
- **Cache brut, tamper et atomicité :** aucun nouveau chemin de fichier piloté par l'utilisateur ; le cache reste privé et lié à la signature du fichier validé. La projection intervient après la mutation/persistance et ne modifie pas le rollback.

## P2 importants

1. La blacklist récursive dépend des noms actuels de champs ; un futur alias financier pourrait être exposé si le DTO n'évolue pas avec le schéma. Des DTO positifs typés/allowlistés seraient plus robustes.
2. La cohérence arithmétique interne de chaque entrée de snapshot de coût n'est pas recalculée indépendamment de son digest.
3. La révocation dynamique de permission/scope Finance après création reste sans matrice exhaustive GET/PATCH/replay/SSE.

## Preuves et limites

Environnement : macOS arm64, Node `v26.6.0`.

- Hashes : `server.js` `5b16de4759502126ed8151ffedf8f92e7f91683605d003c07374c33ffe028fcf`; `app.js` `abf8882c11b07f132ce8cdcb8e4ce480225194d7be34bb4f7ad06d31e0881d8d`; `tests/sprint7-finance.test.js` `05bbfd5a804fe3d5173d1549104390d53cbdce3af9df43caf200434cf4fb9895`; `docs/openapi-sprint7.yaml` `6a817faf7ded9c942b32a528887c11e1ff37ea275ea986c28945902db59cbc81`.
- `node --check server.js && node --check app.js` : **PASS** sur le candidat exact.
- `node --test tests/sprint7-finance.test.js` : tentative fraîche interrompue avant assertions par `listen EPERM` dans le sandbox (13 tests signalés en échec d'environnement, aucun échec métier interprété). Le serveur du candidat est byte-identique à celui de `d7661b7`, dont la campagne ciblée précédente avait passé `12/12`; les changements propres à `4c6c2ae` (UI/OpenAPI/test statique) ont été inspectés, mais cette preuve antérieure n'est pas présentée comme un test frais du candidat.
- Inspection ciblée des autorisations, constructeurs de commandes, projection `send()`, réponses audit/SSE, UI et OpenAPI. Aucun serveur ni campagne longue supplémentaire n'a été lancé.

## Condition de revalidation

Fermer `SEC-S7B-11`, publier les tests négatifs de mutation sur le même hash candidat, puis rejouer SECURITY. L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Revalidation ultime SECURITY indépendante S7-B — canaux financiers résiduels

Date : 2026-08-23

Candidat exact : `01e1246ce6083d9a5d060ebc38f4d1f3a369bfed`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 3 P2 ouverts.**

Les deux P1 du candidat précédent sont fermés : les audits `rate` sont maintenant redacted sans `finance.read`, et le dashboard Projet omet ses quatre champs de coût/marge pour un lecteur commercial non Finance. La recherche des canaux adjacents montre toutefois que les contrats commerciaux principaux restituent encore les mêmes coûts internes et marges à `quote.read`, ce qui maintient une voie de contournement directe.

## P1 bloquant

### SEC-S7B-10 — les DTO commerciaux exposent encore coûts et marges sans `finance.read`

Le routeur exige seulement `quote.read` pour `/api/v1/quotes`, `/api/v1/quote-catalog`, `/api/v1/rate-cards` et `GET /api/v1/rates` (`server.js:2652-2654`). Or aucune projection financière n'est appliquée :

- liste et détail Devis renvoient les objets bruts (`server.js:2893-2895`, `3038`), dont chaque ligne contient `costUnitMinor`, `costTotal`, `marginAmount`, `marginBps`, et le document `costTotal`, `marginAmount`, `marginBps` ;
- le détail d'une version renvoie le snapshot commercial complet (`server.js:3037`) ;
- le catalogue Devis inclut `rate.costUnitMinor` (`server.js:2882-2889`) ;
- les grilles tarifaires imbriquent les objets `rates` bruts, eux-mêmes porteurs de `costUnitMinor` (`server.js:2890`).

Ainsi, masquer le dashboard n'empêche pas un lecteur `quote.read` sans `finance.read` d'obtenir directement le coût interne et la marge du même Projet/Devis.

Correction requise : centraliser un DTO commercial contextualisé par `finance.read` et l'utiliser sur liste, détail, versions, mutations/replays, catalogue et grilles. Sans Finance, supprimer tous les champs `cost*`, `margin*` et coûts des snapshots tarifaires, tout en conservant les prix de vente nécessaires. Ajouter une matrice HTTP avec rôle `quote.read` sans `finance.read` sur chacun de ces canaux.

## Fermetures confirmées

- **Audit Rate :** `rate` appartient maintenant à `FINANCE_AUDIT_ENTITY_TYPES`; `before/after` et détails non sûrs sont masqués pour audit-only. Le test vérifie la présence d'un événement `rate` et l'absence de `costUnitMinor`.
- **Dashboard Projet :** les champs `estimatedCost`, `estimatedMargin`, `actualCost`, `actualMargin` ne sont construits que si `has(auth, 'finance.read')`; le lecteur commercial reçoit les autres indicateurs sans ces clés.
- **Canaux Finance dédiés :** Actual, CostRate, ProjectCost et marges conservent leurs permissions, scopes et redactions précédemment validés.
- **Cache/tamper/atomicité :** le diff ne touche pas le cache brut, les digests, l'écriture atomique ni le rollback ; les conclusions du candidat `cf89c30b…` restent applicables.

## P2 importants

1. La cohérence arithmétique interne de chaque entrée de snapshot de coût n'est pas recalculée indépendamment de son digest.
2. La révocation dynamique de permission/scope Finance après création reste sans matrice complète GET/PATCH/replay/SSE.
3. La signature cache n'est pas comparée explicitement avant/après la lecture validée, laissant une course théorique de remplacement concurrent.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `01e1246ce6083d9a5d060ebc38f4d1f3a369bfed` |
| `node --check server.js` | **PASS** |
| `node --test tests/sprint7-finance.test.js` | **PASS, 11/11**, 0 échec/skip/todo, `600,04 ms` |
| Inspection audit, dashboard, quotes, versions, catalogue et rate-cards | 2 P1 précédents fermés ; SEC-S7B-10 confirmé |

Empreintes SHA-256 :

```text
server.js                           a883b6993d7753360cb153c557e1ea9bfd3f1175e5dfb2a250b524616f952e2d
tests/sprint7-finance.test.js       08c1e92878357c0df2fd16eb92a994768e1cd5da7fbfffa3514b8d66c4103986
```

## Handoff

- Gate SECURITY S7-B : **REJECTED** sur `01e1246c…`; retour DEV requis pour SEC-S7B-10.
- Fichier modifié : `docs/security-review.md` uniquement pour l'axe Sécurité.
- Mise à jour `docs/project-status.md` à réaliser par l'intégrateur.

---

# Revalidation SECURITY indépendante S7-B — confidentialité Finance et cache brut

Date : 2026-08-23

Candidat exact : `cf89c30b6568ebfa44efa4c6c26531213f15864f`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**REJECTED — 0 P0, 2 P1, 3 P2 ouverts.**

Le correctif ferme la fuite audit ciblée pour `actualRecord`, `costRate` et `projectCost` : un acteur `audit.read` sans `finance.read` reçoit désormais `before/after = null` et seulement des identifiants de contexte. Le cache validé conserve maintenant une chaîne JSON immuable et chaque lecture retourne un nouveau graphe par `JSON.parse`, ce qui ferme l'altération en mémoire du cache partagé. Deux canaux financiers hors de cette liste restent cependant accessibles sans `finance.read` et bloquent le gate.

## P1 bloquants

### SEC-S7B-08 — les audits `rate` exposent encore le coût interne

`createRateCommand()` crée un objet `rate` contenant `costUnitMinor`, puis l'insère intégralement dans `after` de l'audit avec `entityType = "rate"` (`server.js:3529-3542`). Or `FINANCE_AUDIT_ENTITY_TYPES` ne contient que `actualRecord`, `costRate` et `projectCost` (`server.js:1102-1107`). La projection retourne donc cet événement brut à tout acteur possédant `audit.read`, même sans `finance.read`.

Correction requise : classifier les champs financiers par contenu/DTO plutôt que par trois seuls types, ou inclure au minimum `rate` et tester un tarif dont `costUnitMinor` est non nul avec le rôle audit-only.

### SEC-S7B-09 — le dashboard Projet retourne coûts et marges avec `quote.read`

`GET /api/v1/projects/:id/dashboard` est classé `commercialReadRoute` et n'exige que `quote.read` (`server.js:2653`). Sa réponse contient pourtant `estimatedCost = sum(costTotal)` et `estimatedMargin = sum(marginAmount)` (`server.js:3062`) sans projection `finance.read`. Un rôle commercial non Finance peut ainsi lire directement coût et marge agrégés.

Correction requise : exiger `finance.read` pour ces champs ou les omettre/nullifier lorsque la permission manque, avec un test HTTP négatif `quote.read` sans Finance.

## Correctifs conformes

- **Audit ciblé :** Actual, CostRate et ProjectCost sont expurgés sans `finance.read`; l'administrateur Finance conserve les snapshots complets.
- **Cache brut isolé :** `validatedDatabaseCache` stocke une chaîne JSON, et chaque hit exécute `JSON.parse`; modifier le résultat d'une lecture ne modifie plus la lecture suivante.
- **Tamper :** la clé `dev:ino:size:mtimeNs:ctimeNs` invalide les altérations/remplacements séquentiels ; révisions, snapshots, marqueurs et chaînes falsifiés sont refusés.
- **Atomicité/rollback :** écriture temporaire privée, `fsync`, rename, cache publié après succès ; export/rollback `0600` et restauration byte-exacte restent couverts.
- **Scopes Finance :** mutations et replays CostRate/ProjectCost repassent par les résolveurs société/site/Client/Projet.

## P2 importants

1. `financeCostSnapshotValid()` ne recalcule toujours pas chaque `amountMinor` depuis quantité × allocation × coût unitaire ; une falsification arithmétiquement cohérente avec digest recalculé reste hors preuve.
2. La révocation dynamique de `finance.read`/scopes après création n'est pas couverte de bout en bout pour GET, PATCH, replay et SSE.
3. La signature du cache est reprise après validation sans comparer explicitement une signature avant/après lecture ; une course de remplacement entre ces étapes reste théoriquement possible.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `cf89c30b6568ebfa44efa4c6c26531213f15864f` |
| `node --check server.js` | **PASS** |
| `node --test tests/sprint7-finance.test.js tests/sprint7-actuals.test.js tests/migration-sprint7.test.js` | **PASS, 25/25**, 0 échec/skip/todo, `665,50 ms` |
| Inspection routes audit/dashboard, DTO, cache, tamper et rollback | correctif ciblé confirmé ; deux canaux P1 confirmés |

Empreintes SHA-256 :

```text
server.js                           e48715d640ae9fb9094e60a89d959da2713313abb21ab4972163328fe7a3a5c8
tests/sprint7-finance.test.js       c15668044402c27700347d1bccb2dc977570dc8281b9ca19e4c8a2388170a2cb
tests/sprint7-actuals.test.js       d83667ecd893ed88046f95474dd33bf1f5b508cbd83676db774e349f0742a7c9
tests/migration-sprint7.test.js     129f32023259f7eb98d2f845c5cfcd11f28199ba378bcb5b8eff6fbb88e72a94
```

## Handoff

- Gate SECURITY S7-B : **REJECTED** sur `cf89c30b…`; retour DEV requis pour SEC-S7B-08 et SEC-S7B-09.
- Fichier de gate modifié : `docs/security-review.md` uniquement pour l'axe Sécurité.
- Mise à jour `docs/project-status.md` à réaliser par l'intégrateur.

---

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
