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
