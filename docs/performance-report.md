# Gate PERFORMANCE indépendant S7-C — Backlog et Forecast représentatifs

Date : 2026-08-23

Candidat exact : `05f65c54851701e2ada724d22fed7987edfeef08`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 4 P2 ouverts.**

Le benchmark Finance frais couvre exactement le volume demandé : 250 ressources, 10 000 réservations, 2 000 Devis acceptés, 2 000 ActualRecords et 2 000 dépenses Projet. Les lectures Backlog et Forecast restent très largement sous le seuil p95 `< 300 ms`.

## Mesures fraîches

Commande : `npm run benchmark:finance` — macOS arm64, Node `v26.6.0`, sortie 0.

| Lecture directe | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| Marges | `24,73 ms` | `27,47 ms` | `27,47 ms` | `< 300 ms` |
| Backlog | `75,05 ms` | `76,13 ms` | `76,13 ms` | `< 300 ms` |
| Forecast | `47,15 ms` | `71,48 ms` | `71,48 ms` | `< 300 ms` |

Jeu : 250 ressources, 10 000 réservations, 2 000 documents commerciaux, 2 000 ActualRecords, 2 000 ProjectCosts. Résultat témoin : 2 000 lignes, CA signé `20 000 000` unités mineures, coût planifié `25 200 000`, coût réel `5 200 000`.

## Analyse de complexité

- **Construction commune :** Projets, Réservations et Actuals sont parcourus une fois et indexés par `quoteId:lineId`; les agrégats Backlog/Forecast réutilisent ensuite les lignes calculées. La ventilation par sources est linéaire dans les Réservations/Actuals visibles.
- **Principal/compléments :** le transfert conserve les quantités par découpage séquentiel, sans duplication de sources. La recherche des compléments utilise actuellement `rows.filter()` pour chaque ligne de base, soit `O(L²)` dans le pire cas en nombre de lignes commerciales; au jeu de 2 000 lignes demandé, la p95 reste `76,13 ms` au maximum.
- **Forecast :** chaque ligne répartit son backlog sur au plus trois fenêtres fixes; la complexité supplémentaire est `O(L)` et la mémoire du drill-down est bornée à 200 éléments dans la réponse.
- **Revenue Chain :** la chaîne réutilise le même read-model puis ventile `planned`, `actual` et `billable` par source avant groupement. Son coût est dominé par `financeFlowLineRows` et le nombre de sources visibles; elle n'a pas de benchmark autonome dans le harness actuel, donc aucun chiffre distinct n'est revendiqué.
- **UI :** deux lectures supplémentaires sont lancées en parallèle avec les autres cartes Finance. Les détails sont bornés à 200 items et le rendu reste linéaire; aucun traitement quadratique n'est ajouté côté navigateur. Aucun profil navigateur frais `< 2 s` n'est revendiqué.
- **Persistance/écritures :** S7-C est un read-model pur, sans nouvelle collection, migration, écriture atomique, audit ou SSE. Les seuils d'écriture `< 250 ms` ne sont objectivement pas impactés.

## P2 importants / limites

1. La liaison compléments repose sur un balayage `rows.filter()` par ligne (`O(L²)`). Elle est conforme à 2 000 lignes avec une marge importante, mais un index `baseQuoteId:baseLineId -> complements[]` serait préférable avant d'augmenter la volumétrie contractuelle.
2. Le benchmark mesure directement le moteur et non les endpoints HTTP, la sérialisation JSON ou une rafale SSE. La marge au seuil est large, mais le coût transport n'est pas chiffré ici.
3. Revenue Chain n'est pas chronométrée séparément avec les 10 000 sources; l'analyse de code montre qu'elle réutilise le moteur mesuré, puis ajoute une ventilation/groupement linéaire.
4. Le critère UI « exploitable et interactive `< 2 s` » n'a pas de profil navigateur frais sur 200 lignes de drill-down ni de mesure d'erreur partielle des cinq appels Finance concurrents.

## Preuves

- HEAD : `05f65c54851701e2ada724d22fed7987edfeef08`.
- Hashes : `server.js` `fe2c0714ae125515ab4faa61c6141518ac5ad860654e2247bc1fbd8281f456ca`; `app.js` `608f84b3235c746e997077e596d562c9b3588d3af52fc650de7333806285f571`; benchmark Finance `ffaf2a1ce2797df73871712a60b461069a9da0de580ecc2db55ce1cdab18eecc`.
- `npm run benchmark:finance` : **PASS**, 8 itérations par lecture, tous les p95 `< 300 ms`.
- `node --test tests/sprint7-forecast.test.js` : **PASS, 6/6**, `85,79 ms`.
- Inspection fraîche de la complexité du transfert vers compléments, de la ventilation par source, du bornage des réponses et des consommateurs UI.

L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Revalidation PERFORMANCE indépendante S7-B — garde frontend import tarifaire

Date : 2026-08-23

Candidat exact : `37a133762bc7626cc9b51bc9577a52a44c3820ec`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 4 P2 ouverts.**

Le serveur, les chemins Actual/Finance, le cache et la projection des réponses sont inchangés depuis `3819b0d`. Le diff ajoute uniquement des contrôles frontend constants et, pour une fiche client non autorisée, un passage linéaire sur la chaîne HTML déjà construite.

## Analyse d'impact

- **Utilisateur autorisé :** après le rendu existant, deux appels `can()` décident d'un retour immédiat. Les handlers ajoutent le même contrôle uniquement lors d'une action d'import.
- **Utilisateur non autorisé :** deux substitutions parcourent le HTML de la fiche en `O(H)`, où `H` est la taille du rendu déjà produit. Aucune copie de données métier, requête réseau ou mutation supplémentaire n'est déclenchée.
- **Action refusée :** ouverture/prévisualisation/confirmation s'arrêtent avant encodage du fichier et appel API ; ce chemin consomme moins de CPU, mémoire et I/O que le parcours autorisé.
- **Backend :** hash identique au candidat approuvé ; les mesures Actual/Finance et l'analyse de la projection commerciale restent directement applicables.

## Références conservées

| Campagne | Lecture p95 max | Confirmation p95 | Correction p95 | Seuil |
|---|---:|---:|---:|---:|
| Actual isolée 1 | `68,74 ms` | `179,15 ms` | `163,13 ms` | reads `<300`, writes `<250` |
| Actual isolée 2 | `73,28 ms` | `142,16 ms` | `145,77 ms` | reads `<300`, writes `<250` |

Finance représentatif : 250 ressources, 10 000 réservations, 2 000 documents, 2 000 ActualRecords et 2 000 ProjectCosts ; marge p95 `37,52 ms` pour un seuil `<300 ms`.

Ces chiffres sont des références sur les chemins byte-identiques, pas une nouvelle campagne sur `37a1337`. Aucun comportement du diff ne peut augmenter leur latence serveur.

## P2 importants / limites

1. Le rendu non autorisé construit d'abord le HTML complet avant suppression du bouton ; intégrer la permission directement au template éviterait ce passage linéaire supplémentaire.
2. Aucun profil navigateur ne mesure une fiche client très volumineuse en contacts/cartes tarifaires.
3. Aucun benchmark HTTP représentatif n'isole encore la projection commerciale proche de 200 documents × 500 lignes.
4. Le critère global navigateur « exploitable et interactif < 2 s » n'a pas été remesuré sur ce diff frontend mineur.

## Preuves

- Candidat exact : `37a133762bc7626cc9b51bc9577a52a44c3820ec`.
- Hashes : `server.js` `d5e7adefdde78db2cc9ebdd53613edf5d7abf17d89e7844f0d98e971a397c5e7`; `app.js` `2af7b4560d9ecd650c7c847ad957b1b702df86f133d79c075b3116cc8d2cf34d`.
- `node --check app.js && node --check tests/clients.test.js` : **PASS**.
- `git diff --check 3819b0d..37a1337` : **PASS**.
- Inspection fraîche : aucun changement serveur, aucune nouvelle boucle métier, I/O, sérialisation ou dépendance.
- Aucun serveur ni benchmark long supplémentaire lancé.

L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Revalidation finale PERFORMANCE indépendante S7-B — contrôles d'écriture de coûts

Date : 2026-08-23

Candidat exact : `3819b0d3490531082fc4efe26c44fffed44f388d`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 4 P2 ouverts.**

Le diff applicatif depuis `4c6c2ae` ajoute exactement trois contrôles de permission constants sur des mutations de coûts. Il ne modifie ni lecture/persistance, ni calcul Finance/Actual, ni projection récursive, ni cache, ni volumétrie de réponse. Aucune nouvelle campagne longue n'est justifiée pour ce correctif d'autorisation.

## Analyse d'impact

- **Ligne Devis :** un `Object.prototype.hasOwnProperty.call` et, seulement lorsque le coût est fourni, un `has()` sur une petite liste de permissions. Le contrôle précède les recalculs et l'écriture ; le refus réduit donc le travail.
- **Tarif :** un `has()` avant `mutate`; le refus évite lecture transactionnelle, validation métier complète, écriture atomique, audit et SSE.
- **Import grille client :** un `has()` avant parsing du corps et XLSX, stockage du fichier et mutation ; le chemin non autorisé est nettement allégé.
- **Chemins autorisés administrateur :** trois recherches linéaires dans une liste de permissions de taille bornée, négligeables devant parsing, résolution tarifaire, sérialisation et écriture disque.
- **Lectures :** aucun changement. Les conclusions et mesures de projection, Actual et Finance du candidat précédent restent objectivement applicables.

## Références de performance conservées

| Campagne | Lecture p95 max | Confirmation p95 | Correction p95 | Seuil |
|---|---:|---:|---:|---:|
| Actual isolée 1 | `68,74 ms` | `179,15 ms` | `163,13 ms` | reads `<300`, writes `<250` |
| Actual isolée 2 | `73,28 ms` | `142,16 ms` | `145,77 ms` | reads `<300`, writes `<250` |

Finance représentatif : 250 ressources, 10 000 réservations, 2 000 documents, 2 000 ActualRecords et 2 000 ProjectCosts ; marge p95 `37,52 ms` pour un seuil `<300 ms`.

Ces mesures ne sont pas revendiquées comme une exécution fraîche de `3819b0d`; elles restent applicables par absence de changement des chemins mesurés. Le seul effet courant est un contrôle d'autorisation constant, avant les traitements coûteux.

## P2 importants / limites

1. Aucun benchmark HTTP représentatif n'isole encore la projection commerciale proche de la borne 200 × 500 lignes.
2. La projection récursive n'a pas de budget explicite de profondeur/nœuds et les tarifs imbriqués dans une grille n'ont pas de pagination indépendante.
3. Les campagnes Actual utilisent cinq confirmations et cinq corrections par série ; le p95 y correspond au maximum.
4. Le critère navigateur « exploitable et interactif < 2 s » n'a pas été remesuré sur les derniers changements UI mineurs.

## Preuves

- Candidat : `3819b0d3490531082fc4efe26c44fffed44f388d`.
- `node --check server.js && node --check app.js && node --check tests/sprint7-finance.test.js && node --check tests/clients.test.js` : **PASS**.
- `git diff --check 4c6c2ae..3819b0d` : **PASS**.
- Inspection fraîche du diff : trois gardes de permission, aucune boucle, allocation proportionnelle, I/O ou changement du chemin chaud autorisé.
- Aucun serveur ou benchmark long supplémentaire lancé conformément au périmètre demandé.

L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Revalidation PERFORMANCE indépendante S7-B — projection commerciale récursive

Date : 2026-08-23

Candidat exact : `4c6c2aea1c6b540f427a1a2e9ceb9d2e05c17854`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 4 P2 ouverts.**

Le candidat ajoute une projection des réponses commerciales pour les utilisateurs sans `finance.read`, plus des garde-fous d'affichage dans l'UI et l'alignement OpenAPI. L'algorithme parcourt une fois le graphe JSON sérialisable : temps `O(N)` et allocation `O(N)`. Il n'ajoute ni lecture disque, ni mutation, ni requête réseau et reste du même ordre que `JSON.stringify`. Avec `finance.read`, le corps est envoyé directement sans parcours.

## Analyse d'impact ciblée

- **Périmètre :** la projection s'active uniquement sur les familles Devis/Budgets, catalogue/grilles/tarifs, imports client et dashboard Projet. Les routes Actual et Finance mesurées ne sont pas traversées.
- **Bornes métier :** la liste commerciale est bornée à 200 documents et un document à 500 lignes, soit un pire cas de 100 000 lignes avant pagination suivante. Les listes de versions omettent leur snapshot. Les objets sont produits par le serveur et acycliques.
- **Écritures :** contrôle, persistance atomique, audit et SSE ont lieu selon le chemin existant ; la projection ne fait que préparer la réponse. Elle peut ajouter une latence linéaire de réponse sur une mutation commerciale, sans élargir la section critique de persistance.
- **UI/OpenAPI :** les conditions `finance.read` / `finance.cost.manage` sont des tests constants et ne changent pas la volumétrie DOM des vues autorisées. Le changement de schéma OpenAPI n'a aucun coût runtime.

## Mesures antérieures objectivement réutilisables

Les chemins benchmarkés et leurs scripts sont byte-identiques au candidat mesuré ; la nouvelle projection ne s'applique pas à leurs routes.

| Campagne | Jeu représentatif | Lecture p95 max | Confirmation p95 | Correction p95 | Seuil |
|---|---|---:|---:|---:|---:|
| Actual isolée 1 | 161 ressources, 10 011 réservations, 2 500 actuals | `68,74 ms` | `179,15 ms` | `163,13 ms` | reads `<300`, writes `<250` |
| Actual isolée 2 | même volumétrie isolée | `73,28 ms` | `142,16 ms` | `145,77 ms` | reads `<300`, writes `<250` |

Finance représentatif : **250 ressources, 10 000 réservations, 2 000 documents, 2 000 ActualRecords et 2 000 ProjectCosts** ; marge p95 `37,52 ms` pour un seuil `<300 ms`.

Hashes des scripts inchangés : `scripts/benchmark-actuals.js` `6bd427…`; `scripts/benchmark-finance.js` `1d0b472…`. Hash applicatif courant : `server.js` `5b16de4759502126ed8151ffedf8f92e7f91683605d003c07374c33ffe028fcf`; `app.js` `abf8882c11b07f132ce8cdcb8e4ce480225194d7be34bb4f7ad06d31e0881d8d`.

## P2 importants / limites

1. Aucun benchmark HTTP représentatif n'isole encore le surcoût de projection sur une réponse commerciale proche de la borne 200 × 500 lignes ; ajouter ce scénario à un harness sans serveur externe.
2. La projection ne possède pas de budget explicite de profondeur/nœuds. Les données actuelles sont acycliques et bornées par le domaine, mais les tarifs imbriqués dans une grille ne disposent pas d'une pagination indépendante.
3. Les campagnes Actual n'utilisent que cinq confirmations et cinq corrections ; leur p95 est donc le maximum et caractérise imparfaitement la variance.
4. Le critère navigateur « exploitable et interactif < 2 s » n'a pas été remesuré sur cette modification UI mineure.

## Preuves et limites d'exécution

- `node --check server.js && node --check app.js` : **PASS** sur `4c6c2ae`.
- La tentative fraîche de la sous-suite HTTP a été arrêtée par `listen EPERM` avant assertions dans le sandbox ; aucun résultat de performance n'en est déduit.
- La campagne ciblée précédente sur le `server.js` byte-identique avait passé `12/12`, avec les petites réponses commerciales observées dans l'ordre de `1–3 ms`; cette mesure de seed n'est pas assimilée à une preuve représentative 100 000 lignes.
- Aucun nouveau serveur ni benchmark long n'a été lancé conformément à la demande terminale. L'approbation repose sur les mesures applicables aux chemins inchangés et sur l'analyse de complexité du chemin ajouté.

## Conclusion

Aucun élément n'indique un dépassement P0/P1 des seuils RC1 : les références Actual/Finance restent largement sous leurs budgets et le nouveau travail est un parcours linéaire en mémoire, adjacent à la sérialisation existante. Les limites P2 doivent être instrumentées avant d'augmenter les plafonds de pagination ou d'imbriquer davantage les grilles. L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Revalidation ultime PERFORMANCE indépendante S7-B — analyse d'impact

Date : 2026-08-23

Candidat exact : `01e1246ce6083d9a5d060ebc38f4d1f3a369bfed`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 3 P2 ouverts.**

Le diff applicatif depuis le candidat mesuré `cf89c30b…` contient exactement deux changements de lecture : ajout de `rate` à un `Set` de quatre types pour la projection audit et construction conditionnelle de quatre champs dans le dashboard Projet. Il ne modifie ni cache/persistance, ni Actual, ni moteur Finance, ni benchmarks. Les mesures isolées fraîches immédiatement précédentes sont donc réutilisables objectivement ; une nouvelle campagne longue n'apporterait pas de preuve sur les deux lignes touchées.

## Analyse d'impact ciblée

- **Audit :** `Set.has()` passe de trois à quatre valeurs ; complexité constante, hors chemins Actual/Finance benchmarkés.
- **Dashboard Projet :** sans `finance.read`, quatre sommes sur les documents ne sont plus calculées, donc le chemin est strictement allégé. Avec Finance, le travail est identique au candidat mesuré.
- **Actual/Finance :** aucun changement dans `readDb`, `mutate`, snapshots, confirmation/correction, `financeMargins`, indexes ou scripts de benchmark.
- **Tests ciblés :** les deux branches dashboard (`viewer`/admin) et la projection audit `rate` terminent en `1–2 ms` dans la campagne fonctionnelle fraîche.

## Mesures réutilisées du candidat immédiatement précédent

Ces mesures ont été exécutées le même jour, dans le même environnement, sur `cf89c30b…`; les fichiers de benchmark sont byte-identiques sur `01e1246c…`.

| Campagne | Lecture p95 max | Confirmation p95 | Correction p95 | Seuil |
|---|---:|---:|---:|---:|
| Actual isolée 1 | `68,74 ms` | `179,15 ms` | `163,13 ms` | reads `<300`, writes `<250` |
| Actual isolée 2 | `73,28 ms` | `142,16 ms` | `145,77 ms` | reads `<300`, writes `<250` |

Finance représentatif : **250 ressources, 10 000 réservations, 2 000 documents, 2 000 ActualRecords, 2 000 ProjectCosts**, marge p95 `37,52 ms` pour un seuil `<300 ms`.

## P2 importants / limites

1. Cinq confirmations et cinq corrections par campagne rendent le p95 égal au maximum ; une campagne longue caractériserait mieux la variance.
2. Le benchmark Actual contient 161 ressources et le dataset Finance complet est mesuré séparément.
3. Aucun profil navigateur/SSE frais ne démontre l'interactivité UI `<2 s`; le diff actuel ne touche toutefois pas l'UI.

## Preuves

| Contrôle | Résultat |
|---|---|
| `git diff cf89c30b…01e1246c -- server.js` | 2 lignes fonctionnelles modifiées, sans chemin benchmarké affecté |
| `node --test tests/sprint7-finance.test.js` | **PASS, 11/11**, `600,04 ms`; dashboard ciblé `2 ms`, audit ciblé `4,47 ms` |
| SHA-256 `scripts/benchmark-actuals.js` | `6bd42742306e65ce72db3ac62c1d80cbaa20c7df93116cfaf1884fdf56741873` (inchangé) |
| SHA-256 `scripts/benchmark-finance.js` | `1d0b4726837026923736bdb27210ea9a5262b429afa9771b665ecc3aee715e11` (inchangé) |

Empreinte applicative :

```text
server.js                           a883b6993d7753360cb153c557e1ea9bfd3f1175e5dfb2a250b524616f952e2d
```

## Handoff

- Gate PERFORMANCE S7-B : **APPROVED** sur `01e1246c…` par analyse d'impact et mesures précédentes objectivement applicables.
- Fichier modifié : `docs/performance-report.md` uniquement pour l'axe Performance.
- Mise à jour `docs/project-status.md` à réaliser par l'intégrateur.

---

# Revalidation PERFORMANCE indépendante S7-B — cache brut, Actuals et Finance

Date : 2026-08-23

Candidat exact : `cf89c30b6568ebfa44efa4c6c26531213f15864f`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 3 P2 ouverts.**

Deux campagnes Actual isolées successives respectent toutes les lectures `< 300 ms` et toutes les écritures `< 250 ms`. Le benchmark Finance représentatif reste très inférieur à `300 ms`. Le passage du cache validé à une chaîne JSON immuable, reparsée à chaque lecture, stabilise les mutations tout en préservant l'isolation entre consommateurs.

## Campagnes Actual isolées

Commande exécutée deux fois séquentiellement : `npm run benchmark:actuals`.

Dataset par campagne : **161 ressources, 10 011 réservations, 2 500 ActualRecords**.

| Campagne | Liste p95 | Pending p95 | Détail p95 | Confirmation p95 | Correction p95 | Verdict |
|---|---:|---:|---:|---:|---:|---|
| isolée 1 | `57,69 ms` | `68,74 ms` | `58,07 ms` | `179,15 ms` | `163,13 ms` | PASS |
| isolée 2 | `59,96 ms` | `73,28 ms` | `55,74 ms` | `142,16 ms` | `145,77 ms` | PASS |

La marge minimale observée sur le seuil d'écriture est `70,85 ms`. Les deux processus terminent avec code `0`.

## Benchmark Finance représentatif

Commande : `npm run benchmark:finance`.

Dataset : **250 ressources, 10 000 réservations, 2 000 documents commerciaux, 2 000 ActualRecords et 2 000 ProjectCosts**.

| Chemin | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| `financeMargins()` | `24,74 ms` | `37,52 ms` | `37,52 ms` | `< 300 ms` |

Résultat réconcilié : 2 000 items, CA signé `20 000 000`, coût planifié `25 200 000`, coût réel `5 200 000` unités mineures. Processus terminé avec code `0`.

## Analyse du correctif

- Un hit du cache ne lance plus `structuredClone` sur le graphe validé : il parse la chaîne JSON immuable, ce qui fournit un graphe privé à la mutation/lecture.
- Après écriture atomique, le cache reçoit exactement la chaîne compacte écrite ; aucun second clone profond n'est conservé.
- Les confirmations/corrections Actual conservent `trackReservationCosts: false` et ne relancent pas le backfill global.
- La persistance reste une réécriture atomique du document complet ; la marge mesurée est désormais reproductible sur les deux campagnes demandées.

## P2 importants / limites

1. Cinq confirmations et cinq corrections par campagne rendent le p95 égal au maximum ; une campagne longue d'au moins 20 écritures par chemin caractériserait mieux la variance.
2. Le benchmark Actual ne comprend que 161 ressources et n'embarque pas simultanément les 2 000 documents commerciaux ; Finance couvre séparément le jeu de référence complet.
3. Le benchmark Finance mesure le moteur directement, sans HTTP ni profil navigateur/SSE ; l'interactivité UI `< 2 s` n'est pas remesurée dans ce gate.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande | Résultat |
|---|---|
| `npm run benchmark:actuals` — isolé 1 | **PASS**, p95 lectures max `68,74 ms`, écritures max `179,15 ms` |
| `npm run benchmark:actuals` — isolé 2 | **PASS**, p95 lectures max `73,28 ms`, écritures max `145,77 ms` |
| `npm run benchmark:finance` | **PASS**, marge p95 `37,52 ms` |

Empreintes SHA-256 :

```text
server.js                           e48715d640ae9fb9094e60a89d959da2713313abb21ab4972163328fe7a3a5c8
scripts/benchmark-actuals.js        6bd42742306e65ce72db3ac62c1d80cbaa20c7df93116cfaf1884fdf56741873
scripts/benchmark-finance.js        1d0b4726837026923736bdb27210ea9a5262b429afa9771b665ecc3aee715e11
```

## Handoff

- Gate PERFORMANCE S7-B : **APPROVED** sur `cf89c30b…`.
- Fichier de gate modifié : `docs/performance-report.md` uniquement pour l'axe Performance.
- Mise à jour `docs/project-status.md` à réaliser par l'intégrateur.

---

# Gate PERFORMANCE indépendant S7-B — Actuals, Finance, cache et snapshots

Date : 2026-08-23

Candidat de gate exact : `6bbc224c55415f5753ecd363fcfb1ae1693e018a`

Code applicatif exact : `0aec6303c9b9f5672be4c512277cfca6a6e99988`

Reviewer : agent indépendant `g7b_review`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 3 P2 ouverts.**

Le backfill global de snapshots a disparu des confirmations/corrections Actual, le cache validé évite la validation complète à chaque lecture et le JSON compact limite la taille écrite. Les lectures et l'agrégat Finance respectent largement leurs seuils. Les écritures restent néanmoins à la limite : un premier passage isolé réussit, mais le second passage isolé échoue avec une confirmation p95 `252,79 ms` pour un contrat strict `< 250 ms`. Le gate ne peut pas être approuvé sur un seuil non reproductible.

## P1 bloquant

### PERF-S7B-08 — le seuil d'écriture Actual n'est pas tenu de façon reproductible

Deux exécutions isolées fraîches de `npm run benchmark:actuals` sur le même code et le même dataset donnent :

| Passage | Liste p95 | Pending p95 | Détail p95 | Confirmation p95 | Correction p95 | Verdict |
|---|---:|---:|---:|---:|---:|---|
| isolé 1 | `119,21 ms` | `134,93 ms` | `114,25 ms` | `239,19 ms` | `245,87 ms` | PASS, marge correction `4,13 ms` |
| isolé 2 | `118,34 ms` | `131,30 ms` | `116,12 ms` | **`252,79 ms`** | `239,72 ms` | **FAIL** |

Le processus sort avec code `1` au second passage. Les six réservations à confirmer ont leurs snapshots préparés avant démarrage, et les routes Actual passent `trackReservationCosts: false`; le backfill de 8,9 s du candidat précédent est donc fermé. Le coût résiduel vient principalement du clone transactionnel, de la création révision/audit/digest puis de la sérialisation et du rename de tout le document JSON contenant environ 10 000 Réservations, 10 000 snapshots et 2 500 ActualRecords. Le cache supprime les validations répétées, mais pas la réécriture globale.

Correction requise : obtenir une marge reproductible sous `250 ms` sur plusieurs passages propres, soit en réduisant la taille/duplication persistée et le travail de mutation, soit via une persistance transactionnelle approuvée. Conserver l'atomicité, les digests et le rollback ; augmenter le nombre d'écritures mesurées avant re-gate.

## Benchmark Finance représentatif — conforme

Commande fraîche : `npm run benchmark:finance`.

Dataset : **250 ressources, 10 000 réservations, 2 000 documents commerciaux, 2 000 ActualRecords, 2 000 ProjectCosts et 10 000 snapshots planifiés**.

| Chemin | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| `financeMargins()` | `28,95 ms` | `41,76 ms` | `41,76 ms` | `< 300 ms` |

Résultat réconcilié : 2 000 items, CA signé `20 000 000`, coût planifié `25 200 000`, coût réel `5 200 000` unités mineures. Le moteur est indexé et reste très en dessous du seuil.

## P2 importants

1. **Échantillon d'écriture trop faible.** Cinq confirmations et cinq corrections rendent le p95 égal au maximum et ne caractérisent pas suffisamment la variance observée autour de 250 ms. Une campagne d'au moins 20 écritures par chemin, avec warm-up exclu, est nécessaire au prochain gate.
2. **Dataset Actual partiellement représentatif.** Le harness couvre 10 011 Réservations et 2 500 ActualRecords, mais seulement 161 ressources et aucun lot de 2 000 documents commerciaux. Le benchmark Finance couvre séparément le dataset complet, sans toutefois mesurer les routes HTTP Actual sur ce même document combiné.
3. **Finance HTTP/UI non profilés.** Le benchmark Finance mesure directement le moteur, pas GET/POST/PATCH via HTTP, les rafales SSE ni le rendu navigateur avec 2 000 lignes. L'UI limite le drill-down à 200, mais l'interactivité `<2 s` n'a pas de profil frais.

## Analyse du correctif

- `freezeReservationPlannedCosts()` est exécuté explicitement avant la mesure Actual ; les écritures interactives ne lancent plus le backfill global.
- `mutate(..., { trackReservationCosts: false })` est appliqué aux confirmations/corrections, évitant le scan de détection des Réservations pour ces chemins.
- Le cache `validatedDatabaseCache` est lié à la signature du fichier et retourne un clone ; après écriture atomique réussie, le nouvel état normalisé est mis en cache.
- `atomicWriteFile()` sérialise en JSON compact, puis renomme atomiquement. Cela réduit les octets, mais le coût reste proportionnel à toute la base.
- Les snapshots planifiés restent dans une collection séparée et ne gonflent pas les DTO Réservation ; ils gonflent néanmoins le document persistant réécrit à chaque mutation.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande | Résultat |
|---|---|
| `npm run benchmark:finance` | **PASS**, marge p95 `41,76 ms` |
| `npm run benchmark:actuals` — isolé 1 | **PASS**, lectures `<135 ms`, écritures p95 `239,19/245,87 ms` |
| `npm run benchmark:actuals` — isolé 2 | **FAIL (exit 1)**, confirmation p95 `252,79 ms` |
| Contrôle statique JSON/cache/snapshots | backfill global fermé ; réécriture document complet toujours critique |

Empreintes SHA-256 :

```text
server.js                           a65c81f95c013fa66ac61306d285b50abdbe461f901fe3da4b957e4c779a220e
scripts/benchmark-actuals.js        6bd42742306e65ce72db3ac62c1d80cbaa20c7df93116cfaf1884fdf56741873
scripts/benchmark-finance.js        1d0b4726837026923736bdb27210ea9a5262b429afa9771b665ecc3aee715e11
```

## Handoff

- Gate PERFORMANCE S7-B : **REJECTED** sur `6bbc224c…`, code `0aec6303…`; retour DEV requis pour PERF-S7B-08.
- Fichier modifié par ce gate : `docs/performance-report.md` uniquement pour l'axe Performance.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

---

# Revalidation PERFORMANCE indépendante — S7-D

Date : 2026-08-24

Candidat exact : `57014500241b512eda1c202475f6793a9be213eb`

Reviewer : agent indépendant `g7d_security_performance`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts.**

`PERF-S7D-01` est fermé. Les boucles Réservation/Réalisé sont désormais bornées aux jours effectivement recouverts, tandis que la capacité brute conserve son parcours Ressources × jours. Sur le dataset contractuel, l'occupation annuelle p95 passe de `3 235,26 ms` à au plus `36,26 ms` lors de deux passages frais.

## Benchmark représentatif frais

Commande exécutée deux fois : `npm run benchmark:finance`.

Dataset de chaque passage : **250 ressources, 10 000 Réservations, 2 000 Devis, 2 000 ActualRecords et 2 000 ProjectCosts**.

| Chemin direct | p95 passage 1 | p95 passage 2 | pire p95 | Seuil |
|---|---:|---:|---:|---:|
| Marges | `27,09 ms` | `26,94 ms` | `27,09 ms` | `<300 ms` |
| Backlog | `71,11 ms` | `82,83 ms` | `82,83 ms` | `<300 ms` |
| Forecast | `55,21 ms` | `69,82 ms` | `69,82 ms` | `<300 ms` |
| Occupation 1 jour | `29,44 ms` | `28,37 ms` | `29,44 ms` | `<300 ms` |
| Occupation annuelle | `36,01 ms` | `36,26 ms` | `36,26 ms` | `<300 ms` |
| Rentabilité | `26,46 ms` | `26,31 ms` | `26,46 ms` | `<300 ms` |
| Non-facturé | `47,68 ms` | `52,89 ms` | `52,89 ms` | `<300 ms` |
| Remises | `7,07 ms` | `7,26 ms` | `7,26 ms` | `<300 ms` |

Les deux processus terminent avec code `0`. La rentabilité contient maintenant 4 000 sources de détail, car les 2 000 dépenses Projet sont ventilées en plus des 2 000 lignes commerciales ; les totaux restent CA signé `20 000 000`, coût planifié `25 200 000`, coût réel `5 200 000` en unités mineures.

## Analyse du correctif

- Chaque Réservation calcule une fois `reservationStart`, `reservationEnd`, `firstDay` et `lastDay`, puis parcourt seulement les jours recouverts.
- Chaque Réalisé applique le même bornage ; les Réservations du benchmark ne recouvrent qu'une heure, supprimant le facteur artificiel ×365.
- La pagination serveur borne désormais occupation à 500 lignes par page et les autres read-models à 200, tout en conservant `itemCount` et `pageCount`.
- Les calculs globaux de rentabilité/remise restent effectués avant pagination, évitant des totaux partiels.
- Le benchmark intègre désormais le pire intervalle accepté par l'API, ce qui empêche une régression silencieuse du P1.

## P2 importants

1. **Benchmark moteur, pas HTTP.** Les mesures excluent lecture/validation du JSON, authentification, sérialisation HTTP et concurrence avec les autres requêtes Finance. La marge est toutefois très large : pire p95 annuel `36,26 ms` pour une cible `300 ms`.
2. **UI non profilée.** Aucun profil navigateur frais ne mesure scripting/paint/heap ni l'objectif exploitable `<2 s`. `loadFinance()` lance dix lectures en parallèle ; la pagination limite le DOM, mais un smoke/perf navigateur reste souhaitable au gate E2E.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande | Résultat |
|---|---|
| `npm run benchmark:finance` — passage 1 | **PASS**, annuel p95 `36,01 ms` |
| `npm run benchmark:finance` — passage 2 | **PASS**, annuel p95 `36,26 ms` |
| ciblés S7 Actual/Finance/Forecast/Occupation/Migration | **PASS, 40/40** |
| `node --test tests/api.test.js` | **PASS, 42/42** |
| `node --check server.js && node --check app.js` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Empreintes SHA-256 :

```text
server.js                           de8a479429e02a664ddcd24eaf06219c9c53cfb78e27fee8f4b84f433500da51
app.js                              bd6bfb8fdc7e468e09c37a2eef5fe92c82e4988355976ab35fddaaf29b8b5641
tests/sprint7-occupancy.test.js     4ad258132ac40e7d450a257882651341f9517515e7477be9cd4658a74c390c85
scripts/benchmark-finance.js        f8b72c6c3b69feb01387cb69a3478a34449a313d9c4722de4ea7622957ecc596
```

## Handoff

- `PERF-S7D-01` : **fermé**.
- Gate PERFORMANCE S7-D : **APPROVED** sur `5701450`, avec 0 P0/0 P1.
- Fichier modifié : `docs/performance-report.md` uniquement ; statut projet à consolider par l'intégrateur.

---

# Revalidation PERFORMANCE indépendante — S7-B

Date : 2026-08-23

Candidat Git : `b42ea165ed32eeebae0b3f9f2080520bf946d4d8`

Verdict : **REJECTED — 0 P0, 1 P1, 2 P2**

## Seuils et environnement

Seuils S7 : lectures/agrégats p95 `< 300 ms`, confirmations/corrections p95 `< 250 ms`, UI interactive `< 2 s`.

Environnement : Node `v26.6.0`, runtime local CommonJS/JSON, données temporaires privées nettoyées par les scripts.

## Benchmark Finance représentatif

Commande : `npm run benchmark:finance`

Dataset : **250 ressources, 10 000 réservations, 2 000 documents commerciaux, 2 000 ActualRecords, 2 000 ProjectCosts**, 250 taux internes et 10 000 snapshots planifiés.

| Chemin | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| `financeMargins()` | `23,00 ms` | `36,49 ms` | `36,49 ms` | `< 300 ms` |

Le résultat est réconcilié sur 2 000 lignes : CA signé `20 000 000`, coût planifié `25 200 000`, coût réel `5 200 000` en unités mineures. Le benchmark termine sans échec.

L'index `costRateIndex()` est construit une fois par contexte et partagé par les résolutions ; le scan `allocations × costRates` du rapport précédent est fermé. Le comptage de révisions ProjectCost est désormais préagrégé en `Map`, supprimant `O(page × revisions)`.

## P1 bloquant

### PERF-S7B-05 — confirmation et correction dépassent le seuil d'écriture

Commande : `npm run benchmark:actuals`

Dataset : 161 ressources, 10 011 réservations et 2 500 réalisations. Les lectures passent, mais les écritures échouent au seuil `<250 ms` :

| Chemin HTTP | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| Liste Actual | `97,13 ms` | `103,99 ms` | `110,04 ms` | `< 300 ms` |
| Pending | `112,19 ms` | `122,78 ms` | `122,82 ms` | `< 300 ms` |
| Détail | `95,11 ms` | `106,00 ms` | `106,73 ms` | `< 300 ms` |
| Confirmation | `296,41 ms` | `8 937,01 ms` | `8 937,01 ms` | `< 250 ms` |
| Correction | `283,10 ms` | `284,22 ms` | `284,22 ms` | `< 250 ms` |

La première confirmation déclenche `freezeReservationPlannedCosts()` depuis `atomicWrite()` et matérialise les snapshots manquants de l'ensemble des réservations, expliquant le pic de 8,9 s. Les écritures suivantes réécrivent un JSON enrichi d'environ 10 000 snapshots et restent autour de 280–300 ms, au-dessus du contrat.

Correction requise : ne pas backfiller toute la base sur une mutation interactive. Réaliser le backfill en migration bornée/explicite, puis figer uniquement les réservations affectées par la commande ; mesurer de nouveau confirmation, correction et écritures Finance sur le dataset représentatif.

## P2 importants

### PERF-S7B-06 — benchmark Finance incomplet sur HTTP et écritures

Le nouveau harness mesure directement le moteur de marge, pas les endpoints HTTP de listes ni POST/PATCH CostRate/ProjectCost. La preuve de lecture principale est excellente, mais une campagne aval devra conserver p50/p95/max HTTP des trois lectures et des mutations Finance après correction du P1.

### PERF-S7B-07 — UI Finance sans profil navigateur frais

L'UI lance trois lectures en parallèle et limite les drill-down à 200 items. Chaque invalidation CostRate/ProjectCost recharge encore listes et marge complètes. Aucun profil navigateur scripting/paint/heap ne démontre l'interactivité `<2 s` avec 2 000 lignes sources.

Recommandation : profiler chargement initial et rafale SSE, puis cibler l'entité/l'agrégat invalidé.

## Analyse statique favorable

- Agrégat marge linéaire/indexé : index Actual, snapshots planifiés par clé, lignes visibles par clé et taux par scope/unité.
- Les listes restent paginées à 200 ; le drill-down renvoie au plus 200 items et son total séparé.
- Les scopes sont appliqués avant agrégation, ce qui borne les jeux visibles.
- SSE compact, aucune collection sérialisée dans l'événement.
- Runtime local sans dépendance ni accès réseau ajouté.

## Limites

- Huit itérations seulement pour le benchmark direct Finance ; l'écart au seuil reste néanmoins très large (`36,49` contre `300 ms`).
- Le benchmark Actual utilise 161 ressources mais dépasse les volumes de réservations/réalisations contractuels ; il démontre directement l'échec des écritures affectées.
- Aucun test multi-session soutenu ni profil navigateur frais.
- `docs/project-status.md` reste sous ownership intégrateur.

## Verdict

L'agrégat Finance passe largement et les scans identifiés sont optimisés, mais confirmation/correction ne respectent plus le seuil d'écriture. **PERFORMANCE REJECTED** sur `b42ea165ed32eeebae0b3f9f2080520bf946d4d8`.

---

# Gate PERFORMANCE indépendant — S7-D Occupation & rentabilité

Date : 2026-08-23

Candidat applicatif exact : `5f61fd4`

HEAD documentaire au lancement : `5dcbd7aaa00957e9a8563f728c2de5e59ab3aede`

Reviewer : agent indépendant `g7d_security_performance`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 2 P2 ouverts.**

Les quatre nouveaux calculs sont largement conformes sur la fenêtre nominale d'une journée. L'occupation ne tient toutefois pas le seuil contractuel sur une période pourtant explicitement acceptée par l'API : 365 jours prennent `3 235,26 ms`, plus de dix fois la cible `<300 ms`.

## Benchmark représentatif nominal

Commande : `npm run benchmark:finance`

Dataset : **250 ressources, 10 000 réservations, 2 000 documents commerciaux, 2 000 ActualRecords et 2 000 ProjectCosts**. Huit mesures par chemin après warm-up.

| Chemin direct | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| Marges | `22,17 ms` | `23,80 ms` | `23,80 ms` | `<300 ms` |
| Backlog | `46,93 ms` | `69,53 ms` | `69,53 ms` | `<300 ms` |
| Forecast | `43,90 ms` | `51,21 ms` | `51,21 ms` | `<300 ms` |
| Occupation, 1 jour | `26,78 ms` | `27,48 ms` | `27,48 ms` | `<300 ms` |
| Rentabilité | `23,50 ms` | `26,23 ms` | `26,23 ms` | `<300 ms` |
| Non-facturé | `44,68 ms` | `48,60 ms` | `48,60 ms` | `<300 ms` |
| Remises | `5,88 ms` | `7,20 ms` | `7,20 ms` | `<300 ms` |

Le benchmark termine avec code `0` et les totaux attendus sur 2 000 lignes.

## P1 bloquant

### PERF-S7D-01 — l'occupation sur la borne autorisée de 366 jours bloque le processus plus de 3 secondes

`analyticsPeriod()` accepte jusqu'à 366 jours. `financeOccupancy()` parcourt ensuite chaque jour pour chaque Ressource, puis de nouveau chaque jour de la période pour chaque Réservation et chaque Réalisé, même lorsqu'ils ne recouvrent qu'une heure. La complexité pratique est donc `O(jours × (ressources + réservations + réalisés))` avec de nombreux `Date.parse()` dans les boucles.

Mesure indépendante, même moteur et même volume de référence, 250 ressources/10 000 réservations, période `2026-01-01` → `2026-12-31`, agrégation mensuelle par Site : **`3 235,26 ms` pour une lecture**, seuil `<300 ms`. Le calcul synchrone monopolise l'event loop et rend le serveur local indisponible pour les autres sessions pendant ce temps.

Correction requise : borner chaque Réservation/Réalisé aux seuls buckets qu'il recouvre, pré-indexer les sources visibles par Ressource et bucket, puis rebenchmarker au minimum 31 et 365 jours. Une autre option acceptable consiste à réduire explicitement la période maximale de l'API à une borne qui respecte le contrat, si le Produit l'approuve.

## P2 importants

1. **Fenêtre UI sans marge robuste.** Sur 31 jours avec 250 ressources et 10 000 réservations, huit mesures chaudes donnent p50 `285,77 ms` et p95 `292,06 ms`. Le seuil passe de seulement `7,94 ms` et ne couvre ni HTTP/JSON, ni les neuf autres requêtes Finance lancées en parallèle.
2. **UI/HTTP non profilés.** Le script mesure les fonctions directement. Aucun profil navigateur frais ne démontre l'affichage exploitable `<2 s`, l'interactivité, le coût DOM des tableaux ou l'effet d'une invalidation SSE. `loadFinance()` déclenche dix lectures simultanées ; dans le monolithe synchrone, leurs temps CPU se cumulent en pratique.

## Analyse favorable

- Rentabilité agrège toutes les lignes avant de borner le drill-down ; l'ancien risque de total partiel au-delà de 200 lignes est fermé.
- Les maintenances superposées sont fusionnées par Ressource avec saturation à la capacité nominale.
- Les sorties restent bornées à 1 000 lignes d'occupation, 500 dépassements/remises et 200 sources par axe de rentabilité.
- Les scopes sont appliqués avant les calculs, réduisant le jeu de travail pour les utilisateurs restreints.
- Aucun accès réseau, dépendance ou actif distant n'est ajouté au runtime.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / mesure | Résultat |
|---|---|
| `npm run benchmark:finance` | **PASS nominal**, p95 S7-D `27,48 / 26,23 / 48,60 / 7,20 ms` |
| Harness direct occupation 31 jours, 8 itérations chaudes | **PASS fragile**, p95 `292,06 ms` |
| Harness direct occupation 365 jours, une lecture | **FAIL**, `3 235,26 ms` > `300 ms` |
| `node --test tests/sprint7-occupancy.test.js` | **PASS, 4/4**, `82,85 ms` |
| `git diff --check` | **PASS** avant écriture des rapports |

Empreintes SHA-256 :

```text
server.js                           4ae25134dfff067b8e438204f168cf6faf04c84d06b44453f1be44199aa02d93
app.js                              bc53201ac1e56619ea9ea3212b0c488e54fd73e1255c34c1eed4d51d3100eaca
tests/sprint7-occupancy.test.js     8b5bfcc8387c25385a83c869621ddc2e4ea892b522a6686b8b1bce25b69669d0
scripts/benchmark-finance.js        89af6c12faa9127f56fc8ee1d413f025e5755e108aeb5136f3caa2c6824b3f9d
```

## Handoff

- Gate PERFORMANCE S7-D : **REJECTED** sur le candidat `5f61fd4` ; retour DEV requis pour `PERF-S7D-01`.
- Fichier modifié par ce gate : `docs/performance-report.md` uniquement.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

---

# Revalidation ultime PERFORMANCE — S7-D

Date : 2026-08-24

Candidat exact : `7051fe4ff4849b1e9849e81b8266d73fa6c2fda6`

Reviewer : agent indépendant `g7d_security_performance`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts.**

Le correctif de sécurité remplace deux scans avec résolution de scope par une seule collection `visibleReservations`, réutilisée pour canonicalisation, agrégation et compteur. L'exclusion des options `lost` et la propagation de `serviceOfferingId` sont des comparaisons/affectations constantes ; aucun nouveau parcours asymptotique n'est introduit.

## Benchmark représentatif frais

Commande exécutée deux fois : `npm run benchmark:finance`.

Dataset : **250 ressources, 10 000 Réservations, 2 000 Devis, 2 000 ActualRecords et 2 000 ProjectCosts**.

| Chemin direct | p95 passage 1 | p95 passage 2 | pire p95 | Seuil |
|---|---:|---:|---:|---:|
| Marges | `27,65 ms` | `29,13 ms` | `29,13 ms` | `<300 ms` |
| Backlog | `89,84 ms` | `77,21 ms` | `89,84 ms` | `<300 ms` |
| Forecast | `71,34 ms` | `58,20 ms` | `71,34 ms` | `<300 ms` |
| Occupation 1 jour | `21,94 ms` | `23,37 ms` | `23,37 ms` | `<300 ms` |
| Occupation annuelle | `38,38 ms` | `31,33 ms` | `38,38 ms` | `<300 ms` |
| Rentabilité | `26,26 ms` | `28,90 ms` | `28,90 ms` | `<300 ms` |
| Non-facturé | `46,39 ms` | `46,88 ms` | `46,88 ms` | `<300 ms` |
| Remises | `7,14 ms` | `7,37 ms` | `7,37 ms` | `<300 ms` |

Les deux exécutions sortent avec code `0`. Le pire chemin reste le Backlog à `89,84 ms`, soit moins d'un tiers du seuil. L'occupation annuelle conserve une marge supérieure à ×7,8.

## Analyse d'impact

- `visibleReservations` fait un seul filtrage complet `O(R)` avant canonicalisation `O(R)` et agrégation bornée aux jours recouverts ; l'ancien facteur `R × 365` reste fermé.
- Les options perdues sont éliminées avant les Maps et boucles temporelles, diminuant le travail dans les jeux arbitrés.
- La ventilation Prestation des ProjectCosts ne change ni leur nombre, ni le calcul des montants ; elle renseigne seulement la clé de groupe existante.
- Pagination et limites de drill-down restent inchangées : 500 lignes d'occupation, 200 pour les autres read-models et sources bornées.

## P2 suivis non bloquants

1. Le benchmark reste direct moteur et exclut auth, lecture/validation JSON, sérialisation HTTP et concurrence des dix requêtes Finance.
2. Aucun profil navigateur frais ne prouve encore scripting/paint/heap ni l'affichage exploitable `<2 s`; ce point reste à couvrir dans le smoke E2E Finance.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande | Résultat |
|---|---|
| `npm run benchmark:finance` — passage 1 | **PASS**, annuel p95 `38,38 ms` |
| `npm run benchmark:finance` — passage 2 | **PASS**, annuel p95 `31,33 ms` |
| ciblés S7 Actual/Finance/Forecast/Occupation/Migration | **PASS, 41/41** |
| `node --test tests/api.test.js` | **PASS, 42/42** |
| `npm test` | **PASS, 312/312** |
| `node --check server.js && node --check app.js` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Empreintes SHA-256 :

```text
server.js                           6f633bd876977b2a05f6e6e09e0236dfd55f89da04ea38afe86a17ced2e2d575
app.js                              bd6bfb8fdc7e468e09c37a2eef5fe92c82e4988355976ab35fddaaf29b8b5641
tests/sprint7-occupancy.test.js     92c3c4215649220691f2cebb33320adeb22c2973d12e935d87050199e9252598
scripts/benchmark-finance.js        f8b72c6c3b69feb01387cb69a3478a34449a313d9c4722de4ea7622957ecc596
```

## Handoff

- Gate PERFORMANCE S7-D : **APPROVED** sur `7051fe4`, 0 P0/0 P1.
- Fichier modifié : `docs/performance-report.md` uniquement ; consolidation du statut par l'intégrateur.

---

# Gate PERFORMANCE indépendant — G8 Dashboards, BI et exports

Date : 2026-08-24

Candidat applicatif exact : `0732150a9816cb3139282fabbd9bd6e3c3fe2a0a`

Reviewer : agent indépendant `g8_security_performance`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts.**

Les six dashboards, les dix datasets/drill-downs et les exports maximaux respectent les seuils G8 sur le dataset contractuel de **250 ressources, 10 000 Réservations, 2 000 documents commerciaux, 2 000 Réalisés et 2 000 coûts Projet**. Le pire dashboard est Direction à `123,67 ms` p95, le pire dataset est Backlog à `70,98 ms` p95, l'Excel Planning 10 000 lignes termine à `153,40 ms` p95 et le PDF 10 000 lignes sur 62 jours à `370,38 ms` p95.

## Dashboards représentatifs

Harness direct frais, huit itérations chaudes par vue, filtres Site/période appliqués et toutes les sources dans le périmètre :

| Dashboard | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| Direction | `113,55 ms` | `123,67 ms` | `123,67 ms` | `<300 ms` |
| Finance | `108,30 ms` | `120,17 ms` | `120,17 ms` | `<300 ms` |
| Planning | `17,17 ms` | `17,53 ms` | `17,53 ms` | `<300 ms` |
| Commercial | `13,46 ms` | `14,17 ms` | `14,17 ms` | `<300 ms` |
| Exploitation | `4,02 ms` | `4,33 ms` | `4,33 ms` | `<300 ms` |
| Chef de projet | `12,18 ms` | `13,65 ms` | `13,65 ms` | `<300 ms` |

Direction et Finance combinent Backlog, Forecast, Marges et Occupation dans une même lecture ; leurs résultats restent donc la preuve la plus contraignante du lot dashboard.

## Datasets BI et drill-down

Chaque mesure calcule le dataset, applique les scopes et construit une page de 500 lignes au maximum.

| Dataset | p95 | Seuil |
|---|---:|---:|
| signed-revenue | `1,70 ms` | `<300 ms` |
| backlog | `70,98 ms` | `<300 ms` |
| forecast | `61,60 ms` | `<300 ms` |
| margins | `10,55 ms` | `<300 ms` |
| occupancy | `32,46 ms` | `<300 ms` |
| profitability | `10,81 ms` | `<300 ms` |
| unbilled-overages | `59,13 ms` | `<300 ms` |
| rate-discounts | `2,36 ms` | `<300 ms` |
| planning-reservations | `6,60 ms` | `<300 ms` |
| actuals | `1,68 ms` | `<300 ms` |

Les limites `pageSize <= 500` et dataset `<= 10 000` sont vérifiées avant sérialisation finale ; une partition est exigée au-delà. Les sections de dashboard restent bornées à 100/200 lignes selon le read-model.

## Exports maximaux

Mesures end-to-end directes incluant construction/tri du modèle Planning, mapping des cellules et génération du buffer local :

| Export | Volume | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|---:|
| Modèle Planning sérialisé | 10 000 lignes | `11,30 ms` | `14,95 ms` | `14,95 ms` | information |
| Planning XLSX | 10 000 lignes | `150,63 ms` | `153,40 ms` | `153,40 ms` | `<2 s` |
| Planning PDF | 10 000 lignes, fenêtre exacte 62 jours | `342,15 ms` | `370,38 ms` | `370,38 ms` | `<2 s` |

Les générateurs refusent plus de 10 000 lignes avant de construire l'artefact. Le PDF découpe par groupes de 22 lignes et l'Excel produit un unique worksheet borné ; aucun fichier persistant ni accès réseau n'est créé.

## Confirmation des moteurs G7 consommés

Deux exécutions fraîches de `npm run benchmark:finance` sur le même volume contractuel donnent les pires p95 suivants : Marges `27,62 ms`, Backlog `76,45 ms`, Forecast `55,94 ms`, Occupation journalière `23,57 ms`, Occupation annuelle `30,27 ms`, Rentabilité `28,55 ms`, Non-facturé `48,51 ms`, Remises `7,39 ms`. Les deux passages sortent avec code `0` et réconcilient 2 000 lignes financières.

## UI et boucle événementielle

`loadPilotage()` lance une seule lecture dashboard. Le rendu transforme uniquement les KPI, alertes et compteurs déjà bornés ; il ne reconstruit pas localement les 10 000 sources. Les valeurs sont calculées côté serveur, un jeton de requête ignore les réponses obsolètes et le DOM du Planning reste virtualisé. Avec un pire calcul direct à `123,67 ms`, la marge théorique avant le seuil d'écran `<2 s` est importante.

Aucun profil navigateur frais scripting/paint/heap n'a toutefois été exécuté dans ce gate ; la preuve UI est donc une analyse d'impact, à confirmer dans le gate E2E G8.

## P2 non bloquants

1. Les mesures dashboards/datasets sont directes moteur : elles excluent auth, lecture JSON, sérialisation HTTP et contention multi-session. La marge au seuil est large (pire p95 `123,67 ms` contre `300 ms`), mais un benchmark HTTP G8 permanent rendrait la preuve plus proche de la production locale.
2. L'interface Pilotage est structurellement bornée et son backend reste très inférieur à 2 s, mais aucun profil navigateur frais ne mesure encore First Contentful Paint, scripting, layout, heap ou une rafale SSE. Le gate E2E doit conserver un contrôle visuel et une mesure navigateur sur la machine de référence.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / mesure | Résultat |
|---|---|
| `npm run benchmark:finance` — deux passages | **PASS**, 250/10 000/2 000/2 000/2 000 |
| harness G8 direct dashboards + datasets, huit itérations | **PASS**, pires p95 `123,67 / 70,98 ms` |
| harness export end-to-end 10 000 lignes | **PASS**, XLSX `153,40 ms`, PDF 62 jours `370,38 ms` |
| `node --test tests/sprint8-dashboards.test.js tests/sprint8-exports.test.js tests/sprint8-bi.test.js tests/sprint8-security.test.js` | **PASS, 19/19** |
| `npm test` | **PASS, 331/331** |
| `npm run lint` | **PASS** |
| inspection UI/limites/pagination | rendu Pilotage borné ; exports et datasets refusent les dépassements |

Empreintes SHA-256 :

```text
server.js                           1e07f1f3c0a68df3c3a990f29b185275dd70e0053056da12a115569fb3cd0883
app.js                              2325f2f5b568954b435d5b4f2255803bb22022d01f9cdf227eca5f4687bc3e1c
tests/sprint8-dashboards.test.js    64f3fe9f10a0c8ce8f236dfe6155ede400b60f2452b0dd12b591d0b9b067f4a4
tests/sprint8-exports.test.js       e5a80094531912e2c3b80a28bf6706599736e2d3a0fff77b99a580b00f7dc397
tests/sprint8-bi.test.js            a0c8dbf3ecb64974559d52a5bc6b0ac2c14b87467ad670ec6b7d77004b591f32
scripts/benchmark-finance.js        f8b72c6c3b69feb01387cb69a3478a34449a313d9c4722de4ea7622957ecc596
```

## Handoff

- Gate PERFORMANCE G8 : **APPROVED** sur `0732150`, 0 P0/0 P1, 2 P2 suivis.
- Fichier modifié par ce gate : `docs/performance-report.md` uniquement.
- `docs/project-status.md` reste à consolider par l'intégrateur.

---

# Re-gate PERFORMANCE indépendant — G8 terminal

Date : 2026-08-24

Candidat applicatif exact : `33ec24b2632729dd5faa45f47ca162b84c0df1d4`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 2 P2 ouverts, 0 P3.**

La correction rend bien `kpiId` obligatoire et le cas public sans KPI retourne systématiquement `422 DASHBOARD_KPI_REQUIRED` sous 300 ms : campagne de 20 mesures, p95 `193,33 ms`, max `203,23 ms`. Les six dashboards eux-mêmes respectent aussi le seuil. En revanche, le drill-down Finance avec KPI explicite `billableRevenue`, donc le parcours nominal corrigé, reste au-dessus du seuil contractuel de lecture API : p95 `331,53 ms` sur 20 itérations chaudes. Le gate Performance ne peut donc pas être approuvé.

## P1 bloquant

### PERF-G8-03 — le drill-down Finance explicite dépasse encore 300 ms

Sur le dataset contractuel de **250 ressources, 10 000 Réservations, 2 000 documents commerciaux, 2 000 Réalisés et 2 000 coûts Projet**, `dashboardDrilldownReadModel(finance, kpiId=billableRevenue)` donne :

| Campagne | Itérations chaudes | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|---:|
| confirmation courte | 8 | `245,73 ms` | `321,84 ms` | `321,84 ms` | `<300 ms` |
| confirmation stabilisée | 20 | `235,77 ms` | `331,53 ms` | `335,31 ms` | `<300 ms` |

Le dépassement est reproductible sur deux campagnes indépendantes. Le drill-down reconstruit le read-model Finance complet avant d'extraire le KPI demandé; ce travail inclut plusieurs moteurs financiers non requis par `billableRevenue`. Correction attendue : valider le KPI avant calcul puis ne calculer que ses sources, ou mutualiser/cacher les calculs de la requête afin de conserver p95 `<300 ms`. Ajouter ce parcours explicite au benchmark permanent.

## Correction no-KPI confirmée

Le contrat OpenAPI exige désormais `kpiId`, le test HTTP vérifie le code d'erreur stable et 20/20 mesures observées retournent `422 DASHBOARD_KPI_REQUIRED` : p50 `181,83 ms`, p95 `193,33 ms`, max `203,23 ms`.

La validation survient cependant après `dashboardReadModel()`, pas avant tout calcul. Elle respecte la cible actuelle mais conserve un travail inutile ; ce point est absorbé dans le durcissement demandé par `PERF-G8-03`.

## Mesures des dashboards et drill-downs explicites

Huit itérations chaudes par vue/KPI sur le même processus et le même dataset contractuel :

| Vue | Dashboard p95 | KPI explicite | Drill-down p95 |
|---|---:|---|---:|
| Direction | `258,25 ms` | `signedRevenue` | `192,87 ms` |
| Finance | `186,63 ms` | `billableRevenue` | `321,84 ms` **FAIL** |
| Planning | `25,80 ms` | `occupancy` | `52,03 ms` |
| Commercial | `37,14 ms` | `budgets` | `44,24 ms` |
| Exploitation | `25,45 ms` | `resources` | `34,74 ms` |
| Chef de projet | `51,19 ms` | `projects` | `40,22 ms` |

Les moteurs financiers unitaires restent verts dans `npm run benchmark:finance`; pires p95 frais : Marges `27,08 ms`, Backlog `79,00 ms`, Forecast `70,51 ms`, Occupation journalière `22,33 ms`, Occupation annuelle `30,00 ms`, Rentabilité `27,09 ms`, Non-facturé `52,28 ms`, Remises `7,15 ms`.

## Exports et bornes

| Chemin | Volume | Résultat frais | Budget/lecture |
|---|---:|---:|---:|
| modèle Planning allocation/jour | 10 000 lignes | p95 `32,91 ms` | information |
| Planning XLSX | 10 000 lignes | p95 `200,68 ms` | `<2 s`, PASS |
| Planning PDF | 10 000 lignes, buffer `7 468 218` octets | p95 `717,66 ms` | `<2 s`, PASS |
| refus export KPI Direction | 16 004 lignes calculées, `422` | p95 `518,81 ms` | borne correcte, calcul tardif |

## P2 non bloquants

1. **PERF-G8-04 — refus d'export tardif.** Le plafond de 10 000 sources empêche bien toute troncature ou livraison surdimensionnée, mais le détail complet est matérialisé avant le `422`. La campagne de cinq mesures donne p95 `518,81 ms`. Un arrêt anticipé réduirait CPU, mémoire et temps de blocage de la boucle Node.
2. **PERF-G8-05 — profil UI absent.** L'analyse statique confirme une seule vue dashboard à la fois, un KPI explicite pour le détail et une pagination côté interface. Le PDF de 10 000 lignes reste sous 2 s, mais produit un buffer de 7,47 MB et monopolise le processus environ 0,7 s. Aucun profil navigateur frais scripting/paint/heap, ni test de concurrence export + dashboard, n'a été exécuté dans ce re-gate.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / mesure | Résultat |
|---|---|
| `git rev-parse HEAD` | `33ec24b2632729dd5faa45f47ca162b84c0df1d4` |
| `npm run benchmark:finance` | **PASS**, dataset 250/10 000/2 000/2 000/2 000 |
| harness direct dashboards/drill-downs explicites | dashboards **PASS**; Finance explicite **FAIL**, p95 `331,53 ms` confirmé |
| harness no-KPI, 20 mesures | **PASS 20/20**, `422`, p95 `193,33 ms` |
| harness Planning/XLSX/PDF | **PASS** sous 2 s; p95 `32,91/200,68/717,66 ms` |
| harness borne export KPI, 5 mesures | refus **PASS 5/5**, p95 `518,81 ms` |
| ciblés G8 + Finance | **PASS, 38/38**, 0 échec/skip/todo |
| `npm test` | **PASS, 337/337**, 0 échec/skip/todo |
| `npm run lint` | **PASS** |

Empreintes SHA-256 :

```text
server.js                           9c76d64ff05850e41a91bddca4519f7870b231b8ff95aa3ad061a5b41bdb7e37
app.js                              8897086486d372cf94b87c0b6c4a5fb5e0d5a6d10d2c67b4489e282af95aa0e5
tests/sprint8-dashboards.test.js    d864ebdeb5cadd76ee50d474e95af5bfba588dfccd7772a4e8f19ae7d40f1084
tests/sprint8-exports.test.js       7570ca69c479f50dc169139210b9111cda6bb614fc2c99ce96721aaaa60a7529
scripts/benchmark-finance.js        f8b72c6c3b69feb01387cb69a3478a34449a313d9c4722de4ea7622957ecc596
```

## Limites et handoff

- Mesures moteur directes : elles incluent agrégation, scopes, pagination et génération des buffers, mais excluent login, lecture du fichier JSON, sérialisation HTTP et contention multi-session. Le dépassement Finance est donc conservateur pour la route HTTP, pas expliqué par le transport.
- `git diff --check` global est rouge uniquement sur des espaces de fin de ligne dans `docs/code-review.md`, modifié en parallèle et hors ownership. Les deux rapports de ce lot sont propres.
- Gate PERFORMANCE G8 : **REJECTED** sur `33ec24b2`, 0 P0/1 P1 (`PERF-G8-03`). Retour DEV requis, puis re-gate Performance et gates aval impactés.
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement. Consolidation de `docs/project-status.md` laissée à l'intégrateur.

---

# Revalidation PERFORMANCE indépendante — G8 après corrections

Date : 2026-08-24

Candidat applicatif exact : `1d4d97b3c43b6d91756b5c74207371dd879c760a`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 2 P2 ouverts.**

Les six dashboards, chaque drill-down demandé avec un `kpiId`, le Planning ventilé à 10 000 lignes, le XLSX multi-feuilles et le PDF A3 restent sous leurs seuils. La route publique de drill-down documente toutefois `kpiId` comme facultatif. Sans ce paramètre, elle recalcule puis matérialise successivement le détail de tous les KPI : Direction atteint `559,92 ms` p95 et Finance `560,46 ms` p95 sur le dataset contractuel, au-dessus du seuil explicite `< 300 ms`.

## P1 bloquant

### PERF-G8-02 — le drill-down public sans KPI dépasse le seuil contractuel

`GET /api/v1/dashboards/:kind/drilldown` accepte l'absence de `kpiId` dans le code et dans OpenAPI. `dashboardDrilldownReadModel()` sélectionne alors tous les KPI disponibles, reconstruit le dashboard, puis relance Backlog, Marges, Occupation ou Non-facturé pour plusieurs branches avant de paginer la liste finale. La pagination à 500 lignes ne borne donc pas le travail en amont.

Mesures directes, cinq itérations chaudes, dataset contractuel 250/10 000/2 000/2 000/2 000 :

| Route logique | p50 | p95 | Seuil |
|---|---:|---:|---:|
| Direction, tous KPI | `446,53 ms` | `559,92 ms` | `<300 ms` |
| Finance, tous KPI | `545,49 ms` | `560,46 ms` | `<300 ms` |

La variante interne utilisée pour le détail de l'export Finance atteint `616,40 ms` p95 pour 10 000 lignes ; elle reste sous le budget d'export de 2 s, mais confirme le recalcul multiple.

Correction requise : rendre `kpiId` obligatoire sur la route publique et refuser son absence avant calcul, ou partager/indexer les calculs afin que la variante multi-KPI respecte `<300 ms`. Ajouter ensuite un benchmark permanent qui mesure la route publique dans ses deux formes documentées.

## Mesures conformes

### Dashboards

Campagne stabilisée de vingt itérations chaudes sur Direction/Finance et huit sur les autres vues :

| Dashboard | p95 | Seuil |
|---|---:|---:|
| Direction | `266,93 ms` | `<300 ms` |
| Finance | `205,32 ms` | `<300 ms` |
| Planning | `31,06 ms` | `<300 ms` |
| Commercial | `40,64 ms` | `<300 ms` |
| Exploitation | `34,64 ms` | `<300 ms` |
| Chef de projet | `38,28 ms` | `<300 ms` |

Une première série courte de huit mesures avait produit un maximum Direction à `427,74 ms`; la campagne de vingt mesures après warm-up donne p95 `266,93 ms` et max `270,74 ms`. Cette sensibilité au warm-up est conservée en P2.

### Drill-down d'un KPI précis

Huit itérations par KPI Direction, page de 500 lignes : pire p95 `264,50 ms` pour Backlog. CA signé `245,20 ms`, CA produit `263,59 ms`, marges `234,10/246,62 ms`, occupation/saturation/sous-utilisation `228,36/233,54/241,86 ms`. Ces parcours UI nominaux respectent `<300 ms`.

### Exports Planning maximaux

| Chemin | Volume | p95 | Seuil |
|---|---:|---:|---:|
| construction allocation/jour | 10 000 lignes | `30,98 ms` | information |
| XLSX trois feuilles | 10 000 lignes + filtres/définitions | `195,09 ms` | `<2 s` |
| PDF A3 | 10 000 lignes, contexte 62 jours | `362,70 ms` | `<2 s` |

Les refus de plus de 10 000 lignes, 250 ressources et 62 jours surviennent avant la génération de l'artefact. La mémoire observée en fin de campagne est d'environ `310 MB` RSS / `76 MB` heap utilisé, processus incluant simultanément le dataset et les buffers de mesure.

### Moteurs financiers consommés

`npm run benchmark:finance` reste vert sur le même volume. Pires p95 : Marges `27,05 ms`, Backlog `96,74 ms`, Forecast `73,79 ms`, Occupation journalière `23,23 ms`, Occupation annuelle `30,08 ms`, Rentabilité `28,67 ms`, Non-facturé `51,18 ms`, Remises `7,32 ms`.

## P2 non bloquants

1. La première série courte Direction a observé `427,74 ms` maximum avant stabilisation. Le p95 contractuel sur vingt mesures passe, mais un benchmark HTTP permanent avec warm-up explicite et davantage d'itérations caractériserait mieux GC, parsing JSON et sérialisation.
2. Aucun profil navigateur frais scripting/paint/heap n'a été exécuté. L'UI ne charge qu'un dashboard puis un KPI nominatif et borne son tableau, mais le critère « exploitable et interactif `<2 s` » doit encore être confirmé dans l'E2E navigateur après fermeture du P1.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / mesure | Résultat |
|---|---|
| `git rev-parse HEAD` | `1d4d97b3c43b6d91756b5c74207371dd879c760a` |
| `npm run benchmark:finance` | **PASS**, dataset 250/10 000/2 000/2 000/2 000 |
| harness direct dashboards, 8 puis 20 itérations | dashboards stabilisés **PASS**, pire p95 `266,93 ms` |
| harness drill-down, cinq à huit itérations | KPI nominatif **PASS** ; multi-KPI **FAIL** `560,46 ms` |
| harness export Planning, cinq itérations | XLSX `195,09 ms`, PDF `362,70 ms`, **PASS** |
| ciblés G8 + Finance | **PASS, 35/35** |
| `npm test` | **PASS, 334/334** |
| `npm run lint` | **PASS** |

Empreintes SHA-256 :

```text
server.js                           015388c5d033f7d43c0e9472d2c8146d7e151eaba053e9a56a4a01bde6172365
app.js                              c40d6bb10cc5394b845131b49f7c06b7de90a878b1e54e97a635f1e42a50f480
tests/sprint8-dashboards.test.js    2fe0fa87f0fe3e0c902a731b7184914abba75e2de9e139994067ec994dfc4c80
tests/sprint8-exports.test.js       45b0eb8efe99e5770f9573e4219ee23a7affb75ba264ae5b235be3f7937d78e7
scripts/benchmark-finance.js        f8b72c6c3b69feb01387cb69a3478a34449a313d9c4722de4ea7622957ecc596
```

## Handoff

- Gate PERFORMANCE G8 : **REJECTED** sur `1d4d97b3`, 0 P0/1 P1 (`PERF-G8-02`).
- Fichier modifié : `docs/performance-report.md` uniquement pour l'axe Performance.
- Retour DEV requis avant INTEGRATION/E2E ; `docs/project-status.md` reste à consolider par l'intégrateur.

---

## Référence terminale du journal PERFORMANCE

La section **« Re-gate PERFORMANCE indépendant — G8 terminal »** datée du 2026-08-24 et portant sur `33ec24b2632729dd5faa45f47ca162b84c0df1d4` est la preuve la plus récente et fait autorité : **REJECTED, 0 P0/1 P1 (`PERF-G8-03`)/2 P2/0 P3**.

---

# Revalidation ultime PERFORMANCE indépendante — G8

Date : 2026-08-24

Candidat applicatif exact : `b56d13f0cf576dbb5726f567d1c98a2081d2ca61`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 3 P2 ouverts, 0 P3.**

`PERF-G8-03` est fermé. Le résultat `unbilled` calculé pour le dashboard Finance est réutilisé par le drill-down `billableRevenue` de la même requête au lieu de relancer le moteur. Sur le dataset contractuel de **250 ressources, 10 000 Réservations, 2 000 documents commerciaux, 2 000 Réalisés et 2 000 coûts Projet**, le benchmark permanent donne p95 `206,60 ms`; une campagne indépendante de 30 itérations donne p95 `268,50 ms` et max `289,14 ms`. Les deux preuves restent sous le seuil `<300 ms`.

## Benchmark contractuel frais

`npm run benchmark:finance`, huit mesures chaudes par chemin :

| Chemin | p95 |
|---|---:|
| Marges | `25,33 ms` |
| Backlog | `55,28 ms` |
| Forecast | `48,63 ms` |
| Occupation journalière | `25,46 ms` |
| Occupation annuelle | `29,44 ms` |
| Rentabilité | `26,48 ms` |
| Non-facturé | `52,82 ms` |
| Remises | `7,09 ms` |
| Drill-down Finance `billableRevenue` | **`206,60 ms`** |

La campagne de confirmation longue de 30 itérations `billableRevenue` donne p50 `191,83 ms`, p95 `268,50 ms`, max `289,14 ms`, **0/30 mesure ≥300 ms**.

## Chemins impactés complémentaires

Campagne de vingt itérations après warm-up :

| Chemin | p95 | Seuil |
|---|---:|---:|
| Dashboard Finance | `185,76 ms` | `<300 ms` |
| Dashboard Projet avec filtre Projet | `38,06 ms` | `<300 ms` |
| absence de `kpiId` → `422` | `183,45 ms` | `<300 ms` |

La temporalité Projet ajoute des index et filtres en mémoire, mais reste très éloignée du seuil. Le cas sans KPI demeure systématiquement fermé et rapide.

## P2 non bloquants

1. **PERF-G8-04 — borne export tardive :** la limite de 10 000 lignes de détail est encore contrôlée après matérialisation. Un arrêt anticipé reste recommandé.
2. **PERF-G8-05 — navigateur/concurrence :** aucun profil navigateur frais scripting/paint/heap ni test de concurrence export + dashboard n'a été rejoué. L'analyse UI reste bornée à un dashboard et un KPI paginé.
3. **PERF-G8-06 — sensibilité ponctuelle au GC/hôte :** une première campagne combinant plusieurs benchmarks dans le même processus a produit deux pauses isolées et un p95 `636,79 ms` sur 20 mesures. Ce résultat n'a pas été reproduit par le benchmark officiel (p95 `206,60 ms`) ni par la campagne indépendante plus longue de 30 mesures (p95 `268,50 ms`, max `289,14 ms`). Conserver davantage d'itérations et un suivi RSS/heap dans le benchmark permanent permettrait de distinguer régression applicative et contention ponctuelle de la machine.

## Preuves et empreintes

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / campagne | Résultat |
|---|---|
| `git rev-parse HEAD` | `b56d13f0cf576dbb5726f567d1c98a2081d2ca61` |
| `npm run benchmark:finance` | **PASS**, `billableRevenue` p95 `206,60 ms` |
| confirmation `billableRevenue`, 30 mesures | **PASS**, p95 `268,50 ms`, max `289,14 ms` |
| no-KPI + dashboards Finance/Projet, 20 mesures | **PASS**, p95 `183,45/185,76/38,06 ms` |
| ciblés G8 + Finance | **PASS, 39/39** |
| `npm test` | **PASS, 338/338** |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

```text
server.js                           8bf91bc83c49ac42821ea07d3e9128a9bfa9bee3a673ee01807a966c936959ca
app.js                              8897086486d372cf94b87c0b6c4a5fb5e0d5a6d10d2c67b4489e282af95aa0e5
tests/sprint8-dashboards.test.js    aa416fc59090bbaf9ba987cf7fc9df877aefc664b7d12ed1a184157a96a955b1
scripts/benchmark-finance.js        087702c7b9bf7d19c4f2a1042bd5318a234332f4863f7c3e571f34857d73e08e
docs/api/openapi-v1.yaml            7395603efc38905461287d6c517d61653729869a76230a020ea3b3e6877a860c
```

## Handoff

- Gate PERFORMANCE G8 : **APPROVED** sur `b56d13f0`, 0 P0/0 P1/3 P2/0 P3.
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation PERFORMANCE indépendante — correctif scroll Planning RC2

Date : 2026-08-24

Candidat applicatif exact : `d4c7fcfbe423940ff57fbeca541ef0e873d12c15`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 nouveau P2 UI, 1 P3.**

Changer le niveau `z-index` d'éléments déjà `position:sticky` et déjà empilés ne modifie ni leur géométrie ni la taille du contenu défilable. Aucun reflow structurel, listener, animation, transformation, `will-change` ou nouveau contexte d'empilement n'est ajouté. Le scroll reste natif et la virtualisation lignes/colonnes, son état `scrollTop/scrollLeft` et son rendu différé par `requestAnimationFrame` sont inchangés.

## Stacking, paint et virtualisation

- Les dates ordinaires passent au-dessus des réservations normales (`z-index:1`) et des wrappers horaires (`z-index:4`).
- Les cellules et spacers virtualisés ne changent ni ordre de grille, ni dimensions, ni fenêtres de rendu.
- Le header sticky pouvait déjà être composité avec `z-index:4`; la nouvelle valeur ne crée pas à elle seule de couche supplémentaire. Elle peut provoquer uniquement une invalidation de paint locale lors du chargement de la feuille CSS.
- Le sélecteur `.planning-matrix-scroll .matrix-corner` ne matche pas la structure actuelle et n'a donc aucun coût de paint effectif au-delà du matching CSS constant.

## P2 UI — PERF-G8-08 — réservation focalisée au-dessus du header en vue non horaire

`.planning-event[tabindex="0"]:focus-visible` conserve `z-index:9`. Dans les vues où l'événement n'est pas enfermé dans le wrapper horaire `z-index:4`, il peut donc encore peindre au-dessus de `.matrix-day{z-index:8}` pendant un scroll vertical. Le cas normal est corrigé, mais la promesse « header au-dessus des bookings » n'est pas absolue pour l'état clavier focalisé. Recommandation : donner au header un niveau supérieur aux états interactifs internes, tout en restant sous les overlays globaux, puis vérifier focus et redimensionnement par navigateur.

## P3 — limite de mesure navigateur

Le navigateur intégré est indisponible ; aucune trace FPS, paint ou screenshot de scroll n'a été obtenue. Les tests contractuels confirment le scroll et la virtualisation, mais pas la fluidité visuelle ni le chevauchement réel.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `d4c7fcfbe423940ff57fbeca541ef0e873d12c15` |
| diff candidat | une règle `z-index` CSS + une assertion ; aucun JS/backend |
| Foundations + Planning post-production | **PASS, 60/60**, durée `314,72 ms` |
| `npm test` | **PASS, 340/340**, durée `8 311,31 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

```text
planning.css                        acde3c58dfde5cc7a2d5614594eb20bca82610ae4067369a69936614a514629c
styles.css                          8f14b1483f6bb58522df36a3841e318099ca9a0fc32b82f8b9b6fde1fd07c196
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
tests/foundations.test.js           a9063cc60fd43b94784f3725b5682ac1d243819885fb2cd9468e6bb247dc7906
```

## Handoff

- Gate PERFORMANCE correctif scroll Planning : **APPROVED** sur `d4c7fcf`, 0 P0/0 P1/1 P2 (`PERF-G8-08`)/1 P3.
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation ultime PERFORMANCE — RC2 focus Pilotage

Date : 2026-08-24

Candidat applicatif exact : `34a9d7883dcf22cad517bf45393848eaa60d48d8`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal RC2

**APPROVED — 0 P0, 0 P1, 0 nouveau P2, 1 P3.**

Le correctif ajoute une règle de même sélecteur à la fin de `planning.css`. La cascade remplace uniquement la couleur d'outline lors de `:focus-visible`. Une couleur CSS directe est au moins aussi simple à résoudre que le `color-mix()` remplacé ; elle n'affecte ni géométrie, ni DOM, ni réseau, ni calcul de données. Les seuls effets possibles sont un style/paint ponctuel au changement de focus.

## Analyse de rendu

- Aucun reflow structurel : épaisseur `3px` et offset `2px` sont identiques à la règle antérieure.
- Le navigateur évalue deux règles de même sélecteur puis conserve la dernière valeur ; ce coût de cascade constant sur les quelques boutons Pilotage est négligeable.
- Aucun changement `app.js`, backend, virtualisation, dashboards, drill-downs, exports ou persistance ; les benchmarks fonctionnels G8 ne sont pas invalidés.
- Suites ciblée et complète vertes sur le candidat exact.

## P3 — PERF-G8-07 maintenu

Le navigateur intégré reste indisponible ; aucune trace style/paint fraîche n'est disponible. La duplication de l'ancien sélecteur pourra être nettoyée mécaniquement ultérieurement, mais n'a aucun impact matériel sur RC2.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `34a9d7883dcf22cad517bf45393848eaa60d48d8` |
| diff depuis `fce2929` | une règle CSS finale + une assertion ; aucun JS/backend |
| Foundations + dashboards G8 | **PASS, 29/29**, durée `1 463,49 ms` |
| `npm test` | **PASS, 340/340**, durée `8 785,32 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

```text
styles.css                          8f14b1483f6bb58522df36a3841e318099ca9a0fc32b82f8b9b6fde1fd07c196
planning.css                        2c4bea06db6d29e0fa6ad8febdd78cb24e553e02ecfeb33f8cd4db666145897b
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
tests/foundations.test.js           aaa49dde1f59c94bf7b4fc292e25852f52a638745f3adc932d7d43b71ce185e3
```

## Handoff

- Gate PERFORMANCE RC2 : **APPROVED** sur `34a9d78`, 0 P0/0 P1/0 nouveau P2/1 P3 (`PERF-G8-07`).
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation PERFORMANCE indépendante — aliases CSS post-release G8

Date : 2026-08-24

Candidat applicatif exact : `fce292974c933358bbfd980c8344cc38e5a923ed`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict avant RC2

**APPROVED — 0 P0, 0 P1, 0 nouveau P2, 1 P3.**

La déclaration ajoute cinq variables globales résolues une fois dans la cascade et référencées par des règles déjà présentes. Elle ne crée aucun sélecteur structurel supplémentaire, animation, image, police, requête réseau, listener ou mutation DOM. Le coût de résolution est constant par élément utilisateur des tokens et ne dépend pas du volume des datasets ; les propriétés finales (couleur, fond, bordure, outline) n'ajoutent aucun layout structurel.

## Analyse de rendu

- `color`, `background`, `border-color` et `outline-color` peuvent déclencher style/paint lorsque les vues concernées sont affichées, mais pas de recalcul géométrique significatif.
- Les aliases évitent des déclarations invalides et permettent au navigateur de partager les tokens racine ; aucune duplication de DOM ou de règle complexe.
- `app.js`, virtualisation Planning, dashboards, drill-downs, XLSX/PDF, serveur et persistance sont bit-identiques : aucun benchmark backend n'est invalidé.
- La suite complète ajoute un seul test statique et reste verte ; la variation de durée globale n'est pas attribuable à une règle CSS racine.

## P3 — PERF-G8-07 maintenu

Le navigateur intégré est indisponible ; aucune trace fraîche style recalculation/paint ni mesure visuelle `<2 s` n'a pu être collectée. Le diff est suffisamment borné pour conclure à l'absence de risque P0/P1, mais un profil rapide de la page Pilotage reste recommandé lors de la recette RC2.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `fce292974c933358bbfd980c8344cc38e5a923ed` |
| diff candidat | une déclaration `:root` et un test statique ; aucun JS/backend |
| Foundations + dashboards G8 | **PASS, 29/29**, durée `1 451,67 ms` |
| `npm test` | **PASS, 340/340**, durée `9 925,21 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

```text
styles.css                          8f14b1483f6bb58522df36a3841e318099ca9a0fc32b82f8b9b6fde1fd07c196
planning.css                        51b38d7ed0eef30e085725777bc293c6e2c435dc87e07056913dbc116608197d
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
```

## Handoff

- Gate PERFORMANCE CSS post-release : **APPROVED** sur `fce2929`, 0 P0/0 P1/0 nouveau P2/1 P3 (`PERF-G8-07`).
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Re-gate PERFORMANCE indépendant — correctif UI post-E2E G8

Date : 2026-08-24

Candidat applicatif exact : `593d392cd1b29b7d6fe6e92db857f9922b4ee34a`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 0 nouveau P2, 1 P3.**

Le correctif ajoute par rendu un accès DOM par identifiant, deux mutations d'attribut/propriété et une affectation `inert`. Le coût est constant, indépendant du nombre de réservations, sources de dashboard ou lignes de drill-down. Hors session, `display:none!important` retire immédiatement le shell du layout/paint et le rendu retourne avant de reconstruire le contenu applicatif. En session, la mutation précède le chemin de rendu existant sans ajouter d'appel API, calcul métier, écouteur ni sérialisation.

## Analyse d'impact

- `server.js`, moteurs Dashboard/Finance, drill-down, XLSX/PDF, persistance et SSE sont inchangés ; aucun benchmark backend précédent n'est invalidé par ce diff exclusivement frontend.
- La règle CSS `.app-shell[hidden]` est un sélecteur simple, déclenché uniquement lors du changement d'état d'authentification.
- L'affectation `inert` porte sur un unique conteneur. Lorsqu'elle passe à vrai, le navigateur retire le sous-arbre de l'interactivité au lieu d'en parcourir les éléments côté application.
- Le test statique couvre la présence du contrat de masquage. La suite complète confirme l'absence de régression fonctionnelle ou serveur.

## P3 — PERF-G8-07 — profil navigateur non rejoué

Le navigateur intégré était indisponible (`browsers.list()` vide), donc aucune trace fraîche scripting/style/layout/paint ni mesure de transition connexion/déconnexion n'a pu être capturée. Le risque est faible au regard du diff O(1) et du retrait de layout hors session, mais une mesure navigateur reste souhaitable au prochain smoke E2E. Les trois P2 généraux déjà documentés pour G8 (borne export tardive, concurrence navigateur/export, sensibilité GC de la campagne Finance) restent inchangés et ne sont ni fermés ni aggravés par ce correctif.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `593d392cd1b29b7d6fe6e92db857f9922b4ee34a` |
| diff applicatif `HEAD^..HEAD` | trois lignes frontend modifiées ; aucun changement backend/API/données |
| ciblés Foundations + dashboards + sécurité G8 | **PASS, 32/32**, durée `2 008,85 ms` |
| `npm test` | **PASS, 339/339**, durée `8 592,68 ms` |
| `npm run lint` | **PASS** |
| `node --check app.js` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

```text
app.js                              cfc158f6d2d9cf8f0d5aa82a83810eb4ac4899f84785a3662ec03d39da48b738
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
styles.css                          b26952fc8f08d8c3798c0764a7da2286acb35a53f5abcd03114545c869d6b8a1
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/foundations.test.js           6b47b94a2b09c3fd116a03a527fb6096265c8142716d3b39b4bdfb9c003578cc
```

## Handoff

- Gate PERFORMANCE G8 post-E2E : **APPROVED** sur `593d392`, 0 P0/0 P1/0 nouveau P2/1 P3 (`PERF-G8-07`).
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; `docs/project-status.md` reste à consolider par l'intégrateur.

---

# Revalidation terminale PERFORMANCE — wrapper final de rendu G8

Date : 2026-08-24

Candidat applicatif exact : `68489b1fc0575706ecbf13c191ab033dc1981d63`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 0 nouveau P2, 1 P3.**

L'ajout exécute une synchronisation constante au début du wrapper terminal : un shell et une liste fermée de trois overlays. Pour les routes qui atteignent aussi le rendu de base, la synchronisation est appelée deux fois, mais elle reste idempotente, O(1) sur le chemin authentifié et sans calcul métier, accès réseau, sérialisation ou création de listener. Pour les routes spécialisées, ce nouvel appel remplace précisément la synchronisation auparavant omise.

## Analyse d'impact

- Quatre recherches DOM par identifiant et quelques affectations de propriétés constantes par rendu ; aucune dépendance à la volumétrie Planning, Dashboard ou Drill-down.
- Le nettoyage O(n) de `#app` ne s'exécute que hors session ; un second appel trouve alors le conteneur vide.
- Aucun changement backend/API/données : les mesures contractuelles Finance, dashboards, exports et SSE ne sont pas invalidées.
- La suite ciblée et la suite complète sont vertes, avec des durées inférieures aux campagnes immédiatement précédentes sur la même machine ; ces durées globales sont des preuves de non-régression, pas un profil DOM.

## P3 — PERF-G8-07 maintenu

Aucun profil navigateur frais scripting/style/layout/paint n'est disponible. La duplication constante du helper est analytiquement négligeable, mais elle pourra être fusionnée lors d'un refactor de composition si la chaîne de wrappers est simplifiée. Cette amélioration n'est pas nécessaire pour le gate.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `68489b1fc0575706ecbf13c191ab033dc1981d63` |
| diff `08595fc..68489b1` | un appel frontend constant et une assertion ; aucun changement backend |
| ciblés Foundations + dashboards + sécurité G8 | **PASS, 32/32**, durée `1 917,26 ms` |
| `npm test` | **PASS, 339/339**, durée `7 801,21 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

```text
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
styles.css                          b26952fc8f08d8c3798c0764a7da2286acb35a53f5abcd03114545c869d6b8a1
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/foundations.test.js           1b8a66d2e062c31287bedfce6bcf82ae88fb2da63f1648c128749163d726d8e0
```

## Handoff

- Gate PERFORMANCE G8 wrapper terminal : **APPROVED** sur `68489b1`, 0 P0/0 P1/0 nouveau P2/1 P3 (`PERF-G8-07`).
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation terminale PERFORMANCE — fermeture overlays G8

Date : 2026-08-24

Candidat applicatif exact : `08595fc2e643490c416117210e1b8dd8ddf34ed2`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 0 nouveau P2, 1 P3.**

Sur le chemin chaud authentifié, `syncAuthenticatedSurfaces(true)` traite un shell et une liste fixe de trois overlays : son propre coût est O(1), sans requête, calcul métier, sérialisation ni nouveau listener. Lors de la seule transition vers l'état non authentifié, `app.replaceChildren()` libère le DOM courant ; ce nettoyage est O(n) selon le nombre de nœuds de la page affichée, mais ponctuel, requis pour réduire la rémanence des données, et borné par les vues déjà paginées/virtualisées. Il n'affecte pas les dashboards, drill-downs ou exports backend.

## Analyse d'impact

- Trois overlays fixes reçoivent chacun au plus une affectation `inert`, plus `hidden=true` uniquement hors session.
- Le transfert de focus est conditionnel et exécuté uniquement hors session.
- `server.js`, données, SSE serveur, RBAC, dashboards, Finance, XLSX/PDF et benchmarks G8 restent bit-identiques au candidat précédent.
- Les suites ciblée et complète restent vertes ; aucune croissance de test ou d'exécution anormale n'est attribuable à ces quelques opérations DOM.

## P3 — PERF-G8-07 maintenu

Le navigateur intégré est toujours indisponible. Aucune trace fraîche de teardown DOM, style/layout/paint ou transition overlay → connexion n'a pu être collectée. Le risque demeure faible et non bloquant compte tenu du caractère ponctuel de la purge et de la liste fixe d'overlays, mais un profil navigateur doit accompagner le prochain smoke E2E. Les P2 généraux G8 déjà ouverts restent inchangés et hors impact de ce correctif.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `08595fc2e643490c416117210e1b8dd8ddf34ed2` |
| diff `593d392..08595fc` | helper frontend et test statique uniquement ; aucun changement backend/API/données |
| ciblés Foundations + dashboards + sécurité G8 | **PASS, 32/32**, durée `2 439,05 ms` |
| `npm test` | **PASS, 339/339**, durée `11 011,94 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

```text
app.js                              24a00f070b3677cf920a2d802a16721c7f25d4dd42d72d3fbea14b6fdd6cbddc
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
styles.css                          b26952fc8f08d8c3798c0764a7da2286acb35a53f5abcd03114545c869d6b8a1
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/foundations.test.js           0a09c42af8028fa4676ec9f984c8aa01cb1a4854494b3f55a52674ed14288b80
```

## Handoff

- Gate PERFORMANCE G8 overlays : **APPROVED** sur `08595fc`, 0 P0/0 P1/0 nouveau P2/1 P3 (`PERF-G8-07`).
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; `docs/project-status.md` reste à consolider par l'intégrateur.
