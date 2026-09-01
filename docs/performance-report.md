# Gate PERFORMANCE indépendant — promotion stable `0.6.0`

Date : 2026-09-01

Base : tag `v0.6.0-rc3` (`1cc545db295b42f1c342b45e74bbaed13c3943c8`). Promotion locale : `package.json 0.6.0`, SHA-256 `db168e4361a14536c88ab004cb7c5a707529d9f29d53e5182e88d976fe38f26a`.

## Verdict

**APPROVED — 0 P0, 0 P1; 2 P2 et 1 P3 hérités de RC3, inchangés.**

La promotion modifie uniquement quatre métadonnées/documentations. `app.js`, `server.js`, OpenAPI, données, tests, scripts et dépendances sont byte-identiques à RC3. Aucun chemin d'exécution, algorithme, I/O, allocation, rendu, migration ou cardinalité ne change; aucun nouveau benchmark produit ne serait informatif.

## Analyse d'impact et références

- La valeur `0.6.0` de `package.json` n'est consommée ni par le serveur, ni par le frontend. Elle ne modifie pas le démarrage, le stockage, les en-têtes, le routage, le SSE ou la sérialisation.
- La documentation de rollback ne déclenche aucune opération runtime. La migration tarifaire, sa sauvegarde et son export sont les mêmes que RC3; la promotion n'ajoute aucune lecture/écriture de données.
- Les références RC3 restent pleinement applicables : Planning 250 ressources / 10 000 réservations p95 lecture `46,35 ms`, conflit `70,24 ms`, écriture `126,37 ms`, lot 100 `180,34 ms`; PDF 500 lignes p95 `11,73 ms`.
- Ces chiffres sont réutilisés parce que les binaires source sont identiques, pas présentés comme de nouvelles mesures. Aucun temps de test ou de commande documentaire n'est converti en métrique produit.

## Constats et limites maintenus

1. **P2 — Catalogue exhaustif à très forte volumétrie :** chargement séquentiel et détection O(N²), inchangés.
2. **P2 — enveloppe mémoire/DOM Planning à longue période :** monolithe JSON et budget DOM/heap à surveiller, inchangés.
3. **P3 — preuve interactive navigateur :** aucune nouvelle trace FPS/layout/paint/mémoire; hors impact de la promotion documentaire.

Preuves : diff RC3 limité à quatre métadonnées avant rapports; SHA-256 `app.js 9601017d92cf…`, `server.js 3f4b87eb8ee4…`, OpenAPI `055f9a05f5f7…` identiques au tag; `git diff --check` **PASS**.

Analyse différentielle uniquement : aucun benchmark, test de charge, navigateur ou contention multi-utilisateur n'est revendiqué. Les contrôles QA/CI de la stable appartiennent aux gates aval. Toute modification runtime invalide la réutilisation des mesures RC3.

Gate PERFORMANCE stable `0.6.0` : **APPROVED avec 2 P2 et 1 P3 non bloquants**. Seul `docs/performance-report.md` est modifié; `docs/project-status.md` reste à l'intégrateur.

---

# Re-gate PERFORMANCE indépendant — candidat `0.6.0-rc3`

Date : 2026-09-01

Base : tag publié `v0.6.0-rc2` (`7a294bb0475c2ad25bb04edcd41031661b3fe581`). Candidat local : `package.json 0.6.0-rc3`; test Devis SHA-256 `729a80fde8cec1550c2c446deba650d5881da40a64725782cc05b654d3834784`.

## Verdict

**APPROVED — 0 P0, 0 P1; 2 P2 de montée en charge et 1 P3 de preuve navigateur hérités, inchangés.**

`server.js` SHA-256 `3f4b87eb8ee4106b819878a0eb73f71516a92099d2fa9e43995a7582444b3af1` et `app.js` `9601017d92cf6884df6c74e3b688b15421b1f6b60c4fe99e692aabf3255b96aa` sont byte-identiques à RC2. Aucun chemin runtime, algorithme, allocation, I/O, persistance ou rendu n'est modifié; les mesures RC2 restent exactement applicables et aucun nouveau benchmark produit ne serait informatif.

## Analyse d'impact

- Le changement est limité au helper de test `closeEventStream`. Les deux fermetures concernées attendent désormais la résolution de `reader.cancel()` puis un seul `setImmediate` avant la réouverture suivante.
- Ce coût est uniquement dans la campagne Node, en O(1), deux fois dans un scénario de 51 tests. Il ne touche ni le serveur livré, ni le navigateur, ni la durée d'une connexion SSE réelle, ni la limite globale de clients.
- Attendre le retrait du flux évite une requête de test prématurée et son `429`; cela ne crée ni boucle de polling, ni sleep fixe, ni retry, ni connexion supplémentaire. La fermeture reste bornée par l'annulation locale du lecteur.
- Les métadonnées `0.6.0-rc3` et la documentation ne sont lues par aucun chemin applicatif. Aucun changement de dataset ou de migration n'accompagne ce candidat.

## Preuves fraîches et références conservées

- `node --test tests/quotes.test.js` : **51/51 PASS**, `4 091,14 ms`.
- `npm test` : **368/368 PASS**, `9 345,08 ms`.
- Ces durées sont des preuves de non-blocage de la suite, **pas** des mesures de performance produit.
- Les références produit RC2 restent : Planning 250 ressources / 10 000 réservations p95 lecture `46,35 ms`, conflit `70,24 ms`, écriture `126,37 ms`, lot 100 `180,34 ms`; PDF 500 lignes p95 `11,73 ms`.
- `git diff --check` : **PASS**.

## Constats et limites maintenus

1. **P2 — Catalogue exhaustif à très forte volumétrie :** `apiAll` séquentiel et détection partagée O(N²), inchangés.
2. **P2 — enveloppe mémoire/DOM Planning à longue période :** monolithe JSON et budget DOM/heap à surveiller, inchangés.
3. **P3 — preuve interactive navigateur :** absence de trace fraîche FPS/layout/paint/mémoire, inchangée et hors impact de ce test Node.

Cette revalidation est strictement différentielle; elle ne revendique ni benchmark nouveau, ni CI distante, ni contention multi-utilisateur. Toute modification ultérieure du runtime invalide la réutilisation des mesures RC2.

Gate PERFORMANCE RC3 : **APPROVED avec 2 P2 et 1 P3 non bloquants**. Seul `docs/performance-report.md` est modifié; `docs/project-status.md` reste à l'intégrateur.

---

# Analyse d'impact PERFORMANCE — métadonnées RELEASE `0.6.0-rc2`

Date : 2026-08-30

Le changement de version `package.json` vers `0.6.0-rc2` (SHA-256 `aa90023d025139aecb3535a976dd1bbf4b4957c5e82c261df1b25faef6f6447a`) et les textes de release/rollback ne sont lus par aucun chemin applicatif. Les empreintes mesurées restent `app.js 9601017d92cf…` et `server.js 3f4b87eb8ee4…`; la migration tarifaire et son rollback faisaient déjà partie du code approuvé et mesuré. **Aucun re-gate PERFORMANCE ni nouveau benchmark n'est requis** pour ce lot documentaire.

Le reporting RELEASE est aligné : suite complète `368/368`; Planning 250 ressources / 10 000 réservations p95 lecture `46,35 ms`, conflit `70,24 ms`, écriture `126,37 ms`, lot de 100 `180,34 ms`; PDF 500 lignes p95 `11,73 ms`. Le verdict PERFORMANCE final reste **APPROVED — 0 P0/P1**, avec les deux P2 de montée en charge et le P3 de preuve navigateur déjà consignés ci-dessous.

---

# Revalidation PERFORMANCE finale — contraste Projet et historique Devis/PDF

Date : 2026-08-30

Candidat revalidé : `app.js` SHA-256 `9601017d92cf6884df6c74e3b688b15421b1f6b60c4fe99e692aabf3255b96aa`; `server.js` `3f4b87eb8ee4106b819878a0eb73f71516a92099d2fa9e43995a7582444b3af1`; `tests/planning-postproduction.test.js` `32464251b1622da22054f17e7b150104c044262e7d441ec411986f04fdc2b3c6`; `tests/quotes.test.js` `ba661c8cb654b403d6312aebf8a68d150fdaa301b2935239cdca6a805b0fa7f8`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict

**APPROVED — 0 P0, 0 P1, 2 P2 de montée en charge et 1 P3 de preuve navigateur.**

Le P1 `REV-GLOBAL-20` est fermé. Le correctif de couleurs n'ajoute aucun appel réseau ni parcours dépendant du volume. La suppression de la re-projection Catalogue à la lecture réduit le travail Devis/PDF et ne dégrade aucun seuil contractuel.

## Mesures fraîches et réutilisées sur l'empreinte serveur exacte

Environnement : macOS arm64, Node `v26.6.0`; stockage JSON temporaire privé, serveur local monoprocessus.

| Chemin | Dataset / échantillons | Résultat | Seuil |
|---|---:|---:|---:|
| Planning GET réservations | 250 ressources / 10 000 réservations, 30 | p95 `46,35 ms`, max `46,52 ms` | `< 300 ms` |
| Planning conflit | même dataset, 30 | p95 `70,24 ms`, max `71,24 ms` | `< 250 ms` |
| Planning écriture atomique | même dataset, 20 | p95 `126,37 ms`, max `131,45 ms` | `< 250 ms` |
| Planning batch 100 cellules | même dataset, 10 | p95/max `180,34 ms` | `< 250 ms` |
| Replay idempotent Planning | même dataset | `103,54 ms` | `< 250 ms` |
| PDF Devis | 500 lignes longues, 30 après 5 warmups | p50 `10,22 ms`, p95 `11,73 ms`, max `13,09 ms` | analyse `< 300 ms` lecture |

Le PDF de 500 lignes produit `664 182` octets. `npm run benchmark:http` rapporte un fichier de `11 694 590` octets, RSS `673 529 856` octets et heap utilisée `141 463 304` octets en fin de campagne. La suite complète passe **368/368** en `9 611,05 ms`; Planning passe **54/54**, Devis **51/51**, Articles **5/5** et Sécurité **4/4**.

## Analyse des impacts

- **Contraste serveur/UI :** luminance et ratio parcourent exactement trois canaux RGB; le coût est O(1). La prévalidation du formulaire modifie un texte, une classe et l'état du bouton sur événement humain. Le rendu Planning calcule au plus un ratio par carte déjà incluse dans la fenêtre virtualisée. Les nouvelles valeurs du payload ont une taille constante.
- **Création rapide :** le passage de `#7667f5` à `#6553db` ne change ni sérialisation, ni nombre de validations, ni transaction. Le smoke POST répond en `7 ms`, très sous le seuil d'écriture `< 250 ms`.
- **Compatibilité legacy :** la réparation choisit noir/blanc en O(1) lors d'un PATCH existant et ne déclenche aucune migration globale ni scan de table. Le smoke PATCH répond en `8 ms`.
- **Devis/PDF :** `professionalQuoteProjection` effectue désormais une copie superficielle et un `map` O(L) sans recherche du Catalogue vivant par ligne. Le générateur reste linéaire et paginé dans les 500 lignes maximales. La mesure actuelle p95 `11,73 ms` améliore la référence antérieure `27,59 ms`; aucun cache ou état persistant supplémentaire n'est ajouté.
- **Mémoire :** conserver les snapshots historiques ne change pas leur cardinalité, puisqu'ils étaient déjà persistés sur les lignes nouvelles. Ne plus joindre le Catalogue à la lecture évite des recherches et allocations de remplacement; aucune hausse mémoire structurelle n'est identifiée.

## Constats maintenus

1. **P2 — Catalogue exhaustif à très forte volumétrie.** L'UI `apiAll` charge séquentiellement toutes les pages de 200 et la détection des codes SAGE partagés conserve un chemin O(N²). Cela peut dépasser le budget interactif de 2 s autour de 10 000 Articles; le volume métier actuel est 71. Prévoir recherche/pagination visible côté serveur et compteur O(N) avant cette montée en charge.
2. **P2 — enveloppe mémoire/DOM Planning à longue période.** Le benchmark volumique atteint environ `642 MiB` RSS malgré une heap utilisée d'environ `135 MiB`; le monolithe relit/clone/sérialise encore l'état complet lors des écritures. Conserver le suivi RSS/heap et le budget DOM avant hausse durable de volume ou concurrence.
3. **P3 — preuve interactive navigateur manquante.** Cette session ne fournit pas de trace fraîche FPS/layout/paint/mémoire ni de chronométrage navigateur du seuil « interactive `< 2 s` ». Les tests de virtualisation, la complexité et les latences API rendent le résultat plausible au volume cible, mais l'E2E release doit le matérialiser.

## Limites et handoff

La mesure PDF est un microbenchmark in-process après warmup; elle n'inclut ni transport HTTP, ni affichage par un lecteur PDF. La campagne Planning est locale, séquentielle et monoprocessus; elle ne mesure pas disque lent, contention multi-utilisateur ou pression mémoire prolongée. Toute modification d'une empreinte ci-dessus invalide ce verdict.

Gate PERFORMANCE final : **APPROVED avec 2 P2 et 1 P3 non bloquants**. Fichier modifié : `docs/performance-report.md` uniquement; `docs/project-status.md` reste à l'intégrateur conformément à la mission.

---

# Gate PERFORMANCE global — candidat post-`v0.6.0-rc1`

Date : 2026-08-30

Base mesurée : tag `v0.6.0-rc1` (`df0f02351b09bf9d64418ee5f864c6fe5cc4629f`). Candidat produit : `app.js` SHA-256 `404f4c608036dc0cbbf009e17f98493b7cba0c69cbd21d43fe6ef1ee7584d41c`, `server.js` `a410aa2a8a57932f570ef0e24445c33847d575f32b40ef78c470cc4daf95d025`, `planning.css` `7455ab68e6bb232acf6e45dce48d1ba78eb477f13bd238594f925bca0a1320cd`, `styles.css` `f4be1bf5bb9f977cc58a70d707a25520eb74e0e788950c0ab49f0b58699a9f27`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict

**APPROVED — 0 P0, 0 P1, 2 P2 de montée en charge, 1 P3 de preuve navigateur.**

Les seuils contractuels serveur Planning passent sur un dataset plus sévère que la référence (250 ressources / 10 000 réservations). Dashboard, Finance et Catalogue restent sous `300 ms` en lecture et `250 ms` en écriture. Ce verdict global remplace les revalidations partielles inférieures pour ce candidat exact.

## Mesures fraîches

Environnement : macOS arm64, Node `v26.6.0`; mesures isolées, serveur local, stockage JSON temporaire privé.

| Chemin | Dataset / échantillons | Résultat | Seuil |
|---|---:|---:|---:|
| Planning GET réservations | 250 ressources, 10 000 réservations, 30 | p95 `46,17 ms`, max `46,99 ms` | `< 300 ms` |
| Planning conflit | même dataset, 30 | p95 `69,60 ms`, max `99,38 ms` | `< 250 ms` |
| Planning écriture atomique | même dataset, 20 | p95 `122,61 ms`, max `126,88 ms` | `< 250 ms` |
| Planning batch 100 cellules | même dataset, 10 | p95/max `169,46 ms` | `< 250 ms` |
| Replay idempotent Planning | même dataset | `91,42 ms` | `< 250 ms` |
| Dashboard Vue d'ensemble | 250 ressources, 10 000 réservations, 30 | p95 `63,68 ms`, max `75,45 ms` | `< 300 ms` |
| Catalogue GET | 10 071 Articles, 50 | p95 `48,07 ms` | `< 300 ms` |
| Catalogue PATCH + persistance | 10 071 Articles, 20 | p95 `58,98 ms` | `< 250 ms` |
| Finance occupation annuelle | 250 ressources, 10 000 réservations, 20 | p95 `30,33 ms` | `< 300 ms` |
| Finance drill-down facturable | + 2 000 documents/réalisés/coûts, 20 | p95 `219,00 ms` | `< 300 ms` |

`npm run benchmark:http` rapporte un fichier de `11 694 590` octets, RSS `750 616 576` octets et heap utilisée `252 573 128` octets en fin de campagne. `npm run benchmark:finance` place les autres lectures entre p95 `7,64 ms` et `56,79 ms`. `npm test` passe **367/367** en `9 779,61 ms`; les suites ciblées Planning/Dashboard/Articles/Devis/Sécurité passent aussi sans échec.

## Analyse des chemins affectés

- **Planning :** la construction d'index de conflit du batch est linéaire dans les réservations visibles puis dans les cellules du lot; le plafond de 200 actions borne le travail par commande. Les déplacements unitaires et `cellOverrides` n'ajoutent qu'une recherche bornée sur les jours/ressources de la réservation. Copie, annulation et rétablissement déclenchent une unique transaction/persistance et n'émettent le SSE qu'après succès.
- **Scroll/gestes/navigation :** le wheel horizontal met à jour `scrollLeft` en O(1), appelle `preventDefault` et n'entraîne ni navigation réseau, ni nouvelle route empilée. La virtualisation existante conserve une fenêtre de lignes/colonnes; les couleurs Projet ajoutent deux variables CSS par carte sans changer la cardinalité.
- **Dashboard :** le read-model parcourt une fois ressources/réservations autorisées, calcule trois périodes, six mois d'historique et deux comparaisons; aucune requête par salle. La mesure directe à 10 000 réservations reste à p95 `63,68 ms`.
- **Tarifs/Devis/PDF :** le Catalogue est paginé côté API; les snapshots et cinq tarifs ont une taille constante par ligne. La détection d'un Article historique est O(N) à l'ouverture seulement; la sélection du snapshot est O(1). Le PDF reste linéaire dans les lignes et paginé; la référence antérieure de 500 lignes est p95 `27,59 ms`, backend byte-identique.
- **Temporalité et scopes :** les filtres n'augmentent pas la cardinalité. Les périodes Dashboard sont fixes (jour, semaine, mois, six mois) et l'intervalle Planning reste borné à 370 jours.

## P2/P3 et limites

1. **P2 — Catalogue exhaustif à très forte volumétrie.** L'UI `apiAll` charge séquentiellement toutes les pages de 200 et la détection des codes SAGE partagés utilise encore `filter(...findIndex...)` O(N²). À 10 071 Articles, 51 lectures séquentielles à environ `48 ms` p95 peuvent dépasser le budget interactif de `2 s`, avant rendu. Le volume métier actuel validé est 71; avant montée à plusieurs milliers, adopter recherche/pagination serveur visible et un compteur O(N).
2. **P2 — enveloppe mémoire/DOM Planning à longue période.** Le benchmark serveur atteint environ `716 MiB` RSS (`241 MiB` heap utilisée) pour un JSON de `11,2 MiB`; le monolithe relit/clone/sérialise encore l'état complet lors des écritures. La virtualisation limite la fenêtre visible, mais aucune trace navigateur n'a démontré la mémoire/paint sur plusieurs mois et cellules empilées. Instrumenter heap/RSS et budget DOM avant d'augmenter le dataset ou la concurrence.
3. **P3 — preuve interactive navigateur manquante.** Le contrôle navigateur automatisé n'était pas disponible dans cette session; le seuil UI « exploitable et interactive `< 2 s` », FPS, layout/paint et mémoire n'a donc pas de trace fraîche. Les latences API, tests purs de virtualisation/gestes et l'analyse de complexité rendent plausible le respect au volume cible, mais l'E2E release doit produire cette preuve sur le candidat figé.

La campagne est locale, séquentielle et monoprocessus : elle ne mesure pas la contention multi-utilisateur, les disques lents, la pression mémoire prolongée ni un navigateur réel. Le serveur volumique isolé a été arrêté et son fichier temporaire supprimé. Toute modification d'une empreinte produit invalide les mesures.

Gate PERFORMANCE global : **APPROVED avec 2 P2 et 1 P3 non bloquants**. Fichier modifié : `docs/performance-report.md` uniquement; la mise à jour de `docs/project-status.md` reste à l'intégrateur.

---

# Revalidation PERFORMANCE — ordre d’initialisation éditeur REV-QUOTE-ARTICLE-16

Date : 2026-08-30

Candidat revalidé : `app.js` SHA-256 `404f4c608036dc0cbbf009e17f98493b7cba0c69cbd21d43fe6ef1ee7584d41c`; `server.js` SHA-256 `a410aa2a8a57932f570ef0e24445c33847d575f32b40ef78c470cc4daf95d025`; `tests/article-catalog.test.js` SHA-256 `7618fc6e704def68f3d455aba41d3f97668617ba2900902d7d84f34683c44f23`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict

**APPROVED — 0 P0, 0 P1, 1 P2 de montée en charge UI hérité, 1 P3 de trace navigateur.**

Le delta déplace un appel `syncQuoteArticleTariff(false)` dans la même ouverture d’éditeur. Il n’ajoute aucun appel, parcours, nœud DOM, listener, allocation persistante ou requête réseau. La complexité et les mesures du candidat précédent restent strictement applicables.

## Analyse différentielle

- L’ouverture exécute toujours un `catalog.some(...)` O(N) pour détecter l’Article historique et les recherches `catalog.find(...)` déjà présentes pour synchroniser le tarif. Seul l’ordre relatif aux affectations de champs change.
- Les restaurations de `unit`, `unitPrice`, `resolvedMinor` et `costUnit` sont des affectations O(1). Elles ne déclenchent pas d’événement `change` programmatique et n’ajoutent donc pas de resynchronisation récursive.
- L’option historique demeure un seul nœud. Aucun rendu de page, recalcul par ligne, pagination PDF ou traitement serveur n’est touché.
- La mesure précédente du pire cas reste applicable : détection historique `0,72 µs/appel` à 71 Articles et `88,59 µs/appel` à 10 071 Articles. Les références serveur byte-identiques restent GET catalogue p95 `46,67 ms`, PATCH p95 `62,78 ms`, PDF 500 lignes p95 `27,59 ms`.
- Les PATCH isolés supplémentaires (Article archivé, override/coût, conservation, nouvelle source) répondent en `5–6 ms`, très sous le seuil écriture `< 250 ms`.

## Preuves fraîches

| Contrôle | Résultat |
|---|---|
| syntaxe `app.js` / `server.js` | **PASS** |
| tests Article isolés | **5/5 PASS**, `583,64 ms` |
| tests Devis | **50/50 PASS**, 0 échec |
| test d’ordre UI | synchronisation avant restauration du prix et du coût : **PASS** |
| analyse du diff | même nombre d’appels, mêmes structures et mêmes bornes |

## P2, P3 et limites

Le **P2 hérité** reste inchangé : `apiAll` séquentiel et détection des codes SAGE partagés O(N²) sur la page Catalogue à très forte volumétrie. Le volume métier approuvé est 71. Le **P3 hérité** reste l’absence de trace navigateur FPS/layout/paint/mémoire et de chronométrage interactif réel `< 2 s`.

Cette revalidation est différentielle : aucun nouveau microbenchmark n’est nécessaire pour un déplacement d’appel sans changement de cardinalité. Les durées des suites parallèles ne sont pas utilisées comme mesures de latence produit; seuls les PATCH isolés et les benchmarks antérieurs byte-identiques le sont. Aucun test multi-utilisateur n’a été réalisé.

Gate PERFORMANCE Tarifs Articles + Éditeur/PDF Devis : **APPROVED** avec P2/P3 non bloquants. Le verdict `REV-QUOTE-ARTICLE-15` inférieur reste historique et est remplacé par celui-ci. Fichier modifié : `docs/performance-report.md` uniquement; statut projet laissé à l’intégrateur.

---

# Revalidation PERFORMANCE — détection d’Article historique REV-QUOTE-ARTICLE-15

Date : 2026-08-30

Candidat revalidé : `app.js` SHA-256 `894956d4bacd1ab9462c1bd1c4bf9aa4e43d6c246d44c61c197a5f1e489c0ef9`; `server.js` SHA-256 `a410aa2a8a57932f570ef0e24445c33847d575f32b40ef78c470cc4daf95d025`; `tests/article-catalog.test.js` SHA-256 `f852af2fd3461c0588b0a3c4a52eebed94fedfc7dbc3a8fcbe2508c595d57700`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict

**APPROVED — 0 P0, 0 P1, 1 P2 de montée en charge UI hérité, 1 P3 de trace navigateur.**

`quoteHistoricalArticleOption` effectue un seul `catalog.some(...)` O(N) à l’ouverture d’une ligne en édition. Le pire cas — Article absent, donc parcours complet — mesure `0,72 µs/appel` à 71 Articles et `88,59 µs/appel` à 10 071 Articles. Le coût reste négligeable face au budget interactif `< 2 s` et n’ajoute ni requête, ni rendu de liste, ni boucle imbriquée.

## Analyse différentielle

- Les gardes de type/snapshot sont O(1). Le scan s’arrête tôt si l’Article est présent et ne parcourt entièrement le catalogue que pour une ligne historique absente.
- L’option DOM ajoutée est un seul nœud. Elle est créée une fois à l’ouverture de l’éditeur, sans listener propre, observer, timer, reflow répété ni copie du catalogue.
- Le helper n’est pas appelé par ligne lors du rendu du Devis, de la page Catalogue ou du PDF. Son coût ne dépend donc ni du nombre de lignes du document ni de la pagination.
- Le serveur, la persistance et le PDF sont byte-identiques au candidat précédent. Les références restent : catalogue 10 071 Articles GET p95 `46,67 ms`, PATCH p95 `62,78 ms`; PDF 500 lignes p95 `27,59 ms`.
- Les tests HTTP du candidat observent les PATCH de quantité/unité/source autour de `6 ms`; aucun changement algorithmique backend n’est présent.

## Mesure fraîche du helper

Microbenchmark Node après 100 warm-ups, source historique absente pour forcer le parcours complet, résultat consommé :

| Taille catalogue | Répétitions | Temps total | Temps/appel |
|---:|---:|---:|---:|
| 71 | 10 000 | `7,23 ms` | `0,72 µs` |
| 10 071 | 1 000 | `88,59 ms` | `88,59 µs` |

Preuves fonctionnelles : `node --test tests/article-catalog.test.js` **5/5 PASS** (`588,13 ms`), `node --test tests/quotes.test.js` **50/50 PASS**, syntaxe `app.js`/`server.js` **PASS**.

## P2, P3 et limites

Le **P2 hérité** demeure inchangé : `apiAll` charge les pages séquentiellement et la page Catalogue calcule les codes SAGE partagés par `filter(...findIndex...)` O(N²). Le volume métier approuvé est 71. Le nouveau scan O(N), ponctuel et mesuré à moins de `0,1 ms` pour 10 071 entrées, ne matérialise pas un nouveau P2.

Le **P3 hérité** demeure : aucune trace navigateur FPS/layout/paint/mémoire ni preuve directe du seuil interactif `< 2 s`. Le microbenchmark V8 n’inclut pas la création DOM réelle; un seul `option` rend cependant l’impact structurel constant. Aucun test multi-utilisateur n’a été réalisé.

Gate PERFORMANCE Tarifs Articles + Éditeur/PDF Devis : **APPROVED** avec P2/P3 non bloquants. Le verdict `REV-QUOTE-ARTICLE-14` immédiatement inférieur est historique et remplacé par le présent candidat. Fichier modifié : `docs/performance-report.md` uniquement; statut projet laissé à l’intégrateur.

---

# Revalidation finale PERFORMANCE — helper UI snapshot Article O(1)

Date : 2026-08-30

Candidat revalidé : `app.js` SHA-256 `2504722ff6cc67722c410b4513594fb57aa38711b26445d0f8a89f90dd978115`; `server.js` SHA-256 `a410aa2a8a57932f570ef0e24445c33847d575f32b40ef78c470cc4daf95d025`; `tests/article-catalog.test.js` SHA-256 `6051a48f89c83031a406dd8f5eff0c72d3a4f25440ca3d0bb22f0975dba2575d`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict final

**APPROVED — 0 P0, 0 P1, 1 P2 de montée en charge UI hérité, 1 P3 de trace navigateur.**

`quoteArticlePricingSource` exécute des comparaisons constantes et un spread d’un objet Article de taille bornée. Il n’effectue ni `find`, ni `filter`, ni parcours du catalogue et ne dépend donc pas de sa cardinalité. Un microbenchmark avec résultat consommé mesure un million d’appels en `26,40 ms`, soit `26,4 ns/appel` dans le runtime de test. Le benchmark serveur isolé reste sous les seuils : lecture p95 `46,67 ms`, écriture p95 `62,78 ms` à 10 071 Articles.

## Analyse différentielle UI

- La sélection du snapshot teste quatre identités/propriétés puis retourne soit l’item existant, soit un objet peu profond aux champs fixes. Complexité O(1) en temps et en mémoire par interaction.
- Le helper est appelé lors de l’ouverture/édition et du changement d’unité/source; aucun listener, timer, observer, requête réseau ou recalcul de page supplémentaire n’est ajouté.
- `syncQuoteArticleTariff` conserve une recherche `quotesModule.catalog.find(...)` O(N) déjà existante par interaction. La correction ne l’imbrique pas dans un parcours. Le calcul O(N²) des codes SAGE partagés sur la page Catalogue est hors de ce delta et reste explicitement le P2 ci-dessous.
- Le backend, le PDF et la persistance sont byte-identiques au candidat précédent. Les mesures restent applicables : PDF p95 `27,59 ms` à 500 lignes; PATCH Devis ciblés autour de `5–6 ms` en exécution isolée précédente.

## Mesures fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Chemin | Échantillons / preuve | Résultat | Seuil |
|---|---:|---:|---:|
| helper `quoteArticlePricingSource` | 1 000 000 appels après warm-up | `26,40 ms` total, `26,4 ns/appel` | analyse O(1) |
| GET catalogue, 10 071 Articles | 50 | p95 `46,67 ms` | `< 300 ms` |
| PATCH Article + persistance | 20 | p95 `62,78 ms` | `< 250 ms` |
| tests Article isolés | 5 | **5/5 PASS**, `548,85 ms` | zéro échec |
| tests Devis | 50 | **50/50 PASS** | zéro échec |

Le benchmark catalogue a été relancé isolément. Une première tentative lancée dans la même commande que le microbenchmark a rencontré `listen EPERM` dans le bac à sable; elle a été répétée seule avec succès et n’est pas comptée comme échec produit.

## P2, P3 et limites

Le **P2 hérité** demeure : le chargement exhaustif `apiAll` est séquentiel et la détection des codes SAGE partagés utilise encore `filter(...findIndex...)`, donc O(N²), à plusieurs milliers d’Articles; le volume métier approuvé est 71. Le **P3 hérité** demeure : aucune trace navigateur FPS/layout/paint/mémoire ou temps interactif `< 2 s` n’a été produite.

Le microbenchmark V8 ne mesure ni DOM ni paint et peut bénéficier des optimisations JIT; son résultat sert seulement à confirmer l’absence de croissance avec N, pas à prédire un temps utilisateur. Aucun test multi-utilisateur n’a été réalisé. Le gate E2E doit conserver la preuve visuelle et interactive.

Gate PERFORMANCE final Tarifs Articles + Éditeur/PDF Devis : **APPROVED** avec P2/P3 non bloquants. Fichier modifié : `docs/performance-report.md` uniquement; mise à jour de `docs/project-status.md` laissée à l’intégrateur.

---

# Revalidation PERFORMANCE — fallback tarifaire par unité sur snapshot Article

Date : 2026-08-30

Candidat revalidé : `server.js` SHA-256 `a410aa2a8a57932f570ef0e24445c33847d575f32b40ef78c470cc4daf95d025`; `tests/article-catalog.test.js` SHA-256 `b0b8a92951728a059100bfba3d3df4ad6936ed907ded71597135fb60436dbd68`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict revalidé

**APPROVED — 0 P0, 0 P1, 1 P2 de montée en charge UI hérité, 1 P3 de preuve navigateur.**

Le fallback `articleSnapshotRate` est constant : contrôle d’identité, validation d’unité et accès direct à une propriété de `tariffsMinor`. Il ne copie pas le snapshot et n’ajoute aucun parcours du catalogue. Les trois PATCH du scénario correctif (quantité, unité, source) répondent respectivement en `5`, `6` et `5 ms`. Le benchmark isolé à 10 071 Articles reste sous les seuils : lecture p95 `47,64 ms`, écriture p95 `78,62 ms`.

## Analyse différentielle

- `rateForSource` reçoit une référence optionnelle au snapshot déjà présent sur la ligne. En absence de rate-card applicable, `articleSnapshotRate` exécute un nombre constant de validations et retourne un petit objet tarifaire O(1).
- Le fallback vers `articleCatalogRate` n’est consulté que si le snapshot est absent, incohérent avec `sourceId` ou inutilisable. Il n’existe donc ni double scan du catalogue ni nouvelle complexité sur le chemin nominal.
- Un changement réel de source suit le chemin existant : une recherche linéaire bornée dans le catalogue en mémoire, déjà comprise dans les mesures et sans copie cumulative.
- Recalcul de montants, version documentaire, audit, sérialisation JSON, écriture atomique, SSE, pagination UI et génération PDF restent inchangés. Les mesures PDF précédentes restent applicables : p95 `27,59 ms`, max `29,29 ms` au plafond de 500 lignes longues.

## Mesures fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Chemin | Échantillons / preuve | Résultat | Seuil |
|---|---:|---:|---:|
| GET catalogue, 10 071 Articles | 50 | p95 `47,64 ms` | `< 300 ms` |
| PATCH Article + persistance | 20 | p95 `78,62 ms` | `< 250 ms` |
| PATCH quantité même source | test HTTP | `5 ms`, `200` | `< 250 ms` indicatif |
| PATCH unité même source | test HTTP | `6 ms`, `200` | `< 250 ms` indicatif |
| PATCH nouvelle source | test HTTP | `5 ms`, `200` | `< 250 ms` indicatif |
| tests ciblés Article + Devis | 55 | **55/55 PASS** | zéro échec |

Commande benchmark : `npm run benchmark:article-catalog`, exécutée après les deux suites ciblées, sans concurrence avec elles.

## P2, P3 et limites

Le **P2 hérité** demeure : à plusieurs milliers d’Articles, `apiAll` charge toutes les pages séquentiellement et le calcul UI des références partagées reste O(N²). Le volume métier approuvé est 71 et ce correctif ne modifie pas l’UI. Le **P3 hérité** demeure : aucune trace navigateur FPS/layout/paint/mémoire; l’E2E release doit confirmer l’interaction `< 2 s`.

Les temps unitaires des PATCH sont des observations de test, pas un p95 dédié. Le verdict s’appuie sur l’analyse algorithmique, les 55 tests ciblés et le benchmark représentatif du catalogue. La suite complète `367/367` communiquée par l’intégrateur n’a pas été relancée par ce reviewer. Aucun test multi-utilisateur n’a été réalisé sur la persistance JSON locale.

Gate PERFORMANCE Tarifs Articles + Éditeur/PDF Devis : **APPROVED** avec P2/P3 non bloquants. Fichier modifié : `docs/performance-report.md` uniquement; mise à jour de `docs/project-status.md` laissée à l’intégrateur.

---

# Revalidation PERFORMANCE — préservation des snapshots de ligne Devis

Date : 2026-08-30

Candidat revalidé : `server.js` SHA-256 `11ddba279a199942e3787849ebfa0b06fc9b414552aa7ee868d904c618efe86c`; `tests/article-catalog.test.js` SHA-256 `0b3da91772e11791a14c3dace67ee1345c6bf5a822dc3c8323a748ed3f659ab9`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict revalidé

**APPROVED — 0 P0, 0 P1, 1 P2 de montée en charge UI hérité, 1 P3 de preuve navigateur.**

Le correctif ajoute une comparaison constante de l'identité de source et réutilise des objets snapshot existants sur un PATCH sans changement tarifaire. Il n'ajoute ni parcours de collection, ni copie profonde, ni écriture persistée supplémentaire. Le PATCH de quantité du test correctif répond en `6 ms`. Le benchmark isolé du catalogue à 10 071 articles reste sous les seuils avec `49,41 ms` p95 en lecture et `59,98 ms` p95 en écriture.

## Analyse différentielle du PATCH Devis

- `sameSource` compare deux chaînes normalisées : coût O(1). Le chemin évite la reconstruction du snapshot Article et sa recherche dans `articleCatalogItems` lorsque la source ne change pas.
- `preservePricingSnapshot` ajoute trois comparaisons constantes (unité et bornes de prestation, plus absence de changement manuel de prix), puis réemploie `appliedRateSnapshot`. La résolution tarifaire existante est encore calculée, mais aucune boucle ni structure supplémentaire n'est introduite par le correctif.
- Le calcul des montants, la version documentaire, l'audit, l'écriture atomique et l'émission SSE sont inchangés. La taille JSON reste identique puisque le snapshot remplacé est désormais conservé, pas dupliqué.
- Catalogue, pagination UI et générateur PDF sont hors du diff correctif. Les mesures PDF du candidat précédent restent donc applicables : génération linéaire au plafond de 500 lignes longues, p95 `27,59 ms`, max `29,29 ms`.

## Mesures fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Chemin | Échantillons / preuve | Résultat | Seuil |
|---|---:|---:|---:|
| GET catalogue, 10 071 articles | 50 | p95 `49,41 ms` | `< 300 ms` |
| PATCH Article + persistance | 20 | p95 `59,98 ms` | `< 250 ms` |
| PATCH ligne même source après V2→V3 | test HTTP | `6 ms`, statut `200` | `< 250 ms` indicatif |
| tests Article | 5 | **5/5 PASS**, `551,74 ms` | zéro échec |
| tests Devis | 50 | **50/50 PASS**, `4 116,84 ms` | zéro échec |

Commande benchmark : `npm run benchmark:article-catalog`, exécutée isolément après la campagne de tests. La première exécution concurrente aux tests a été écartée de la référence afin d'éviter de mélanger la contention de processus avec la latence du candidat.

## P2, P3 et limites

Le **P2 hérité** demeure : à plusieurs milliers d'Articles, `apiAll` charge séquentiellement toutes les pages et le calcul UI des références partagées reste O(N²). Le volume métier validé est 71; ce delta ne touche pas ce chemin. Le **P3 hérité** demeure : aucune trace navigateur FPS/layout/paint/mémoire n'a été produite; l'E2E release doit confirmer l'interaction `< 2 s`.

Le temps `6 ms` est une observation fonctionnelle unique, pas un benchmark p95 du PATCH Devis. Le verdict d'impact repose donc sur l'analyse algorithmique du delta, les 55 tests ciblés et les mesures représentatives inchangées du catalogue/PDF. Aucun test de charge multi-utilisateur n'a été réalisé sur le monolithe JSON local.

Gate PERFORMANCE Tarifs Articles + Éditeur/PDF Devis : **APPROVED** avec P2/P3 non bloquants. Fichier modifié : `docs/performance-report.md` uniquement; mise à jour de `docs/project-status.md` laissée à l'intégrateur.

---

# Gate PERFORMANCE indépendant — Tarifs Articles + Éditeur/PDF Devis

Date : 2026-08-30

Candidat observé : HEAD `6cb10c90a12077ef26442c0a8a80e06ad7cd8d9e`, avec lot non commité identifié par les empreintes ci-dessous.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict

**APPROVED — 0 P0, 0 P1, 1 P2 de montée en charge UI hérité, 1 P3 de preuve navigateur.**

Le catalogue de 10 071 articles respecte les références API avec `42,63 ms` p95 en lecture/recherche (`< 300 ms`) et `60,92 ms` p95 en mutation versionnée avec persistance (`< 250 ms`). La génération PDF dynamique reste linéaire et mesure `27,59 ms` p95 au plafond de 500 lignes longues. La hauteur variable et la pagination complète ne créent donc aucune régression serveur bloquante.

## Catalogue tarifaire HTTP

Commande : `npm run benchmark:article-catalog` sur macOS arm64, Node `v26.6.0`.

Jeu : 10 000 articles synthétiques plus 71 articles SAGE migrés. Les 50 lectures HTTP authentifiées recherchent `benchmark`, trient 10 000 correspondances et renvoient une page de 100. Les 20 mutations successives font validation, version optimiste, idempotence, audit, révision append-only et écriture atomique du JSON.

| Chemin | Échantillons | p95 | Seuil | Verdict |
|---|---:|---:|---:|---|
| GET recherche catalogue, 10 000 correspondances | 50 | `42,63 ms` | `< 300 ms` | PASS |
| PATCH Article versionné et persisté | 20 | `60,92 ms` | `< 250 ms` | PASS |

Le tarif V2 ajoute cinq chaînes monétaires par article et une projection constante. Il ne change pas la complexité de filtrage/tri O(N log N) ni celle de la persistance JSON O(N). Au volume métier actuel de 71 articles, une seule page réseau suffit.

## Génération et pagination PDF

Mesure directe de `quotePdfBuffer`, 30 itérations par taille, avec une désignation professionnelle longue sur chaque ligne :

| Lignes | p50 | p95 | max | Taille PDF |
|---:|---:|---:|---:|---:|
| 1 | `0,08 ms` | `0,48 ms` | `1,05 ms` | 4 744 octets |
| 40 | `1,05 ms` | `1,23 ms` | `1,59 ms` | 62 901 octets |
| 200 | `5,75 ms` | `7,52 ms` | `7,97 ms` | 309 512 octets |
| 500 | `23,57 ms` | `27,59 ms` | `29,29 ms` | 772 443 octets |

`pdfWrap` parcourt chaque caractère une fois, `quotePdfLineHeight` est O(longueur de désignation), le groupement de pages est O(nombre de lignes), puis la sérialisation est O(taille du PDF). Le plafond serveur de 500 lignes borne la charge. La mesure n'inclut pas auth HTTP, lecture du JSON ni transfert, mais leur coût sur les tests HTTP Devis demeure de quelques millisecondes; la marge au seuil de lecture reste supérieure à 270 ms.

## UI, P2 et P3

**P2 hérité — chargement exhaustif du catalogue à très forte volumétrie.** `apiAll` reste séquentiel par pages de 200 et le calcul des références SAGE partagées reste O(N²). Ce lot ne dégrade pas ce chemin, mais à 10 071 articles les 51 requêtes séquentielles pourraient dépasser le budget interactif `< 2 s`. Le volume approuvé est 71; avant une croissance à plusieurs milliers, déplacer recherche/pagination côté serveur et calculer les doublons par compteur O(N).

**P3 — absence de trace navigateur de performance fraîche.** La parité visuelle éditeur/PDF a été vérifiée fonctionnellement, mais ce gate ne fournit pas de trace native FPS/layout/paint/mémoire ni de mesure du délai d'ouverture du lecteur PDF intégré. Le gate E2E doit confirmer l'ouverture et l'interaction `< 2 s` sur les 71 articles et un devis multi-page représentatif.

## Preuves fraîches

| Contrôle | Résultat |
|---|---|
| `npm run benchmark:article-catalog` | **PASS**, lecture p95 `42,63 ms`, écriture p95 `60,92 ms` |
| microbenchmark PDF 1/40/200/500 lignes, 30 itérations | **PASS**, plafond p95 `27,59 ms`, max `29,29 ms` |
| `node --test tests/article-catalog.test.js` | **PASS, 5/5**, durée `555,70 ms` |
| `node --test tests/quotes.test.js` | **PASS, 50/50**, 0 échec |
| `node --check server.js` / `node --check app.js` | **PASS** |
| `git diff --check` | **PASS** avant rapport |

Empreintes SHA-256 du candidat :

```text
server.js                                      fe058707cb39cfac16face519ded6ebbaa83b8e06c85b0ce0cb4e931251a3a49
app.js                                         4bcb5fcb7669da6f8779e71973df95467ad27dde7e43ee3b002106adc6085bb1
referentials/article-catalog-sage-pricing-v2.json 8787dd307faca61d3bb12dbf05274ec742179e5bb4504bad475bbed35bc1e053
scripts/benchmark-article-catalog.js            797762d839a0331e53029df049a3fac03c005e38e1810fa885b725a06d971cb9
tests/article-catalog.test.js                   9773657dfe9ee9a9ac9d9f0436331881547332db80ce881a53f51eea1ebe5624
tests/quotes.test.js                            6a99884d758321269bb2d715e5b2e14d4a340ba017e6fe10d278423014ab7e9e
```

Gate PERFORMANCE Tarifs Articles + Éditeur/PDF Devis : **APPROVED** avec P2/P3 non bloquants. Fichier modifié : `docs/performance-report.md` uniquement; mise à jour de `docs/project-status.md` laissée à l'intégrateur conformément à l'ownership imposé.

Le P1 fonctionnel/sécurité `SEC-ARTICLE-QUOTE-01`, détecté en parallèle sur la recapture du snapshot Article lors d'un PATCH de ligne, bloque l'intégration globale sans invalider les mesures de coût ci-dessus. Son correctif modifiera toutefois le chemin d'écriture Devis et devra recevoir une revalidation PERFORMANCE d'impact avant réutilisation de ce verdict pour la release.

---

# Revalidation terminale PERFORMANCE — existence documentaire à la date de situation

Date : 2026-08-26

Candidat applicatif exact : `14d8ebea3019fa2a1d941eeefcb0ede24098ee38`

HEAD observé : `2631ee2b2023f8bbb9d4796d23b567e9d11fcf84` ; le commit postérieur au candidat est documentaire uniquement.

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 0 P2, 1 P3 sur le correctif terminal.**

L'impact est limité à deux prédicats constants dans le parcours documentaire déjà mesuré. La volumétrie, le nombre de parcours, les agrégats d'occupation, la taille de réponse et le DOM sont inchangés. La mesure représentative immédiatement précédente reste applicable différentiellement : 250 ressources, 10 000 réservations et 2 000 documents, p95 `20,41 ms`, très sous le seuil API `< 300 ms`.

## Analyse différentielle

- Le préfiltre remplace `taxDate || createdAt` par `createdAt || taxDate`. Il effectue toujours au plus deux lectures de propriété, un `cleanString(..., 10)` et une comparaison lexicographique par document : O(D), même allocation et même borne.
- `unconvertedBudgets` remplace `(range || status !== 'converted')` par `(asOf || range || status !== 'converted')`. Dans les trois appels du read-model, `asOf` est une chaîne non vide; le court-circuit s'arrête donc au premier opérande. Le coût est O(1) par Budget et légèrement inférieur au chemin consultant le statut.
- Les collections `documents`, `convertedBudgetIds`, `quotes`, `signed` et `budgets` ne changent ni de type ni de duplication. Aucun index, copie historique ou boucle imbriquée supplémentaire n'est ajouté.
- Occupation, cellules Planning, 24 options mensuelles, quatre cartes de comparaison, réponse JSON et backend HTTP restent byte-identiques. `app.js` est inchangé.
- Le test ciblé exerce maintenant simultanément existence future et réconciliation globale/comparaison sans créer de campagne ou fixture persistante supplémentaire.

## Référence représentative conservée

Campagne post-RC6 exécutée sur le candidat parent `db23552b…`, dont ce correctif ne change que les deux prédicats ci-dessus :

| Dataset / résultat | Valeur |
|---|---:|
| ressources / réservations / documents | `250 / 10 000 / 2 000` |
| itérations après warm-up | 30 |
| min / p50 / p95 / max | `14,83 / 15,95 / 20,41 / 25,98 ms` |
| réponse JSON | `117 358 octets` |
| historique remplacé | 167 acceptés observés/attendus, dont 56 `replaced` |

La marge au seuil de lecture API est supérieure à `279 ms`. Il n'existe aucun motif algorithmique permettant aux deux substitutions constantes de consommer cette marge.

## P3 et limites

**P3 — absence de nouvelle trace runtime/browser sur le commit terminal.** À la demande de finalisation, aucun benchmark supplémentaire ni nouvelle suite complète n'a été lancé après les preuves ciblées. Le verdict Performance repose sur l'analyse différentielle du diff de deux lignes et la campagne représentative du parent applicatif immédiat. Aucun navigateur n'a mesuré transfert, layout, paint, mémoire ou seuil UI `< 2 s`.

## Preuves et handoff

| Contrôle | Résultat |
|---|---|
| candidat applicatif | `14d8ebea3019fa2a1d941eeefcb0ede24098ee38` |
| diff | 2 substitutions de prédicat serveur; aucun changement UI/CSS/API |
| tests ciblés | **PASS, 87/87**, durée `7 294,46 ms` |
| benchmark parent représentatif | p95 `20,41 ms`, max `25,98 ms` |
| REVIEW / QA indépendantes | **APPROVED**, selon handoff intégrateur |

Hashes SHA-256 : `server.js` `4aea5ee9b9f89851f31c61a302800607e1e65da54438f01a68acf4c16ca10376`; `app.js` `bd08f1fd8f5711a1245c3084f0fad0f11f036962039b99690c84df74762da3e7`; test dashboard `7e4799d7729ec54758d53272ffb5f1f9924bc415f64c88f057f62e575eebdf8a`.

Gate PERFORMANCE terminal : **APPROVED**, avec la limite P3 explicitée. Fichier modifié : `docs/performance-report.md` uniquement ; statut projet laissé à l'intégrateur.

---

# Re-gate PERFORMANCE indépendant post-RC6 — cutoff et historique mensuel

Date : 2026-08-26

Candidat applicatif exact : `db23552b898bc7fc8c75bdae11b1916daba4df0a`

HEAD observé : `68f16f47201e21c16f9b5eefbf35ddd3bc657770` ; l'unique différence après le candidat est documentaire.

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 0 P2, 1 P3 sur le correctif post-RC6.**

Sur 250 ressources, 10 000 réservations et 2 000 documents, la Vue d'ensemble complète avec cutoff courant et historique `replaced` mesure `20,41 ms` p95, sous le seuil API `< 300 ms` avec plus de `279 ms` de marge. Le nouvel agrégat d'occupation courante ajoute un passage borné sur les cellules déjà construites; aucune lecture de persistance, requête réseau ou structure cumulative supplémentaire n'est introduite.

## Mesure fraîche représentative

Benchmark direct de `dashboardOverviewReadModel`, cinq warm-ups puis 30 itérations, situation `2026-08-25`, comparaison `2026-06` :

| Dataset / résultat | Valeur |
|---|---:|
| ressources | 250 |
| réservations | 10 000 |
| devis + budgets injectés | 2 000 |
| documents visibles à `asOf` | 1 964 |
| acceptés historiques juin | 167, dont 56 `replaced` |
| latence min / p50 / p95 / max | `14,83 / 15,95 / 20,41 / 25,98 ms` |
| réponse JSON | `117 358 octets` |

La campagne couvre six mois de documents et 180 jours de réservations distribuées sur les 250 salles, avec états `confirmed`, `completed` et `option`; les documents incluent devis brouillons/acceptés/remplacés, budgets confirmés et liens de conversion.

## Analyse du coût ajouté

- Les ressources, réservations, cellules et documents sont toujours produits une seule fois après scopes. `visibleAt` ajoute une comparaison de chaîne ISO O(1) par document.
- Le mois courant ne peut plus réutiliser `periods.month.global`, car sa disponibilité doit s'arrêter à `asOf`. Il exécute donc un agrégat `dashboardOverviewOccupancy` supplémentaire sur les 250 ressources et cellules déjà matérialisées. La mémoire de sortie reste constante.
- Le mois historique réutilise les mêmes documents; compter les devis remplacés repose sur `acceptedAt` et ne crée ni index, ni historique copié, ni boucle imbriquée additionnelle.
- Le correctif frontend de delta est une garde `null` O(1). Il n'ajoute aucun nœud, listener, observer, reflow ou requête.
- La campagne précédente sur `7b723b3` mesurait `16,68 ms` p95 sur le même volume nominal. Les campagnes ne sont pas un A/B isolé strict, mais le nouveau p95 `20,41 ms` reste du même ordre et très loin du seuil contractuel.

## P3 et limites

**P3 — profilage navigateur absent.** Aucun navigateur pilotable n'était disponible pour mesurer le temps interactif, layout/paint, mémoire ou FPS. Le HTML additionnel est inchangé par le correctif et le scripting UI ajouté est constant; l'E2E release devra néanmoins confirmer le seuil UI `< 2 s` sur une machine cible.

Le benchmark appelle le read-model en mémoire : parsing HTTP, lecture du fichier JSON, transfert des `114,6 KiB` et rendu navigateur ne sont pas inclus. La marge API observée demeure importante, mais le comportement au-delà de 2 000 documents n'a pas été extrapolé.

## Preuves fraîches et handoff

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| candidat applicatif | `db23552b898bc7fc8c75bdae11b1916daba4df0a` |
| benchmark 250/10 000/2 000, 30 itérations | **PASS**, p95 `20,41 ms`, max `25,98 ms` |
| `node --test tests/sprint8-dashboards.test.js tests/quotes.test.js tests/foundations.test.js` | **PASS, 87/87**, durée `3 556,73 ms` |
| `npm test` | **PASS, 355/355**, durée `8 382,89 ms` |
| `npm run lint` / `npm run build` | **PASS** |
| `git diff db23552^ db23552 --check` | **PASS** |

Hashes SHA-256 : `server.js` `f8fb1691fb1cd2fc172c8c8531d9682f2ffa53eaa1489c80993a517c88d5b78e`; `app.js` `bd08f1fd8f5711a1245c3084f0fad0f11f036962039b99690c84df74762da3e7`; `styles.css` `61e2a6dd342f18003d385443c22137fb1bafe926408bab3ddbf8732e2d6ee954`; OpenAPI `056bddd0703ac81a720b8d30905449a77d1e420a5604e8e1ffaf60e5ade8b116`.

Gate PERFORMANCE post-RC6 : **APPROVED**, avec la limite navigateur P3. Fichier modifié : `docs/performance-report.md` uniquement ; mise à jour de `docs/project-status.md` laissée à l'intégrateur.

---

# Gate PERFORMANCE indépendant — comparaison mensuelle Vue d'ensemble

Date : 2026-08-26

Candidat applicatif exact : `7b723b3ce6c43c9fb5ccc0ab9f016c2430429629`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 0 P2, 1 P3 sur le périmètre comparatif.**

Le mois supplémentaire réutilise les cellules Planning et les documents déjà scopés. Sur le jeu contractuel de 250 ressources et 10 000 réservations, complété par 2 000 documents commerciaux, le read-model complet reste à `16,68 ms` p95, très sous le seuil de lecture API `< 300 ms`. Le coût UI ajouté est borné à 24 options et quatre cartes ; aucune boucle proportionnelle au nombre de réservations n'est ajoutée au navigateur.

## Mesure fraîche représentative

Benchmark Node direct de `dashboardOverviewReadModel`, cinq warm-ups puis 30 itérations, `asOf=2026-08-25`, `comparisonMonth=2026-07` :

| Dataset / résultat | Valeur |
|---|---:|
| ressources actives | 250 |
| réservations visibles | 10 000 |
| devis + budgets injectés | 2 000 |
| documents visibles à `asOf` | 1 964 |
| latence min / p50 / p95 / max | `14,03 / 15,31 / 16,68 / 24,90 ms` |
| réponse JSON | `118 859 octets` |

Les réservations sont distribuées sur 180 jours et les 250 salles, avec états `confirmed`, `completed` et `option`; les documents couvrent six mois, devis brouillons/acceptés et budgets confirmés, avec liens de conversion. La mesure inclut jour, semaine, mois courant, tendance six mois, mois comparé et agrégats commerciaux.

## Coût algorithmique et UI

- Le read-model filtre une fois les ressources, réservations et documents. `planningCellIntervals` construit les cellules une fois; chaque agrégat parcourt ensuite les 250 lignes et les cellules visibles. Le mois comparé ajoute un appel d'occupation et deux agrégats commerciaux, sans seconde lecture de base ni mutation.
- La comparaison courante réutilise `periods.month.global`. Les structures de sortie supplémentaires sont constantes : deux périodes, deux blocs occupation, deux blocs commerciaux.
- L'interface propose exactement 24 mois passés et rend quatre cartes de comparaison. Un microbenchmark synthétique de l'assemblage de ces 28 éléments sur 10 000 répétitions donne `0,0033 ms` par assemblage. Cette mesure isole le scripting et ne prétend pas mesurer layout/paint.
- Les contrôles `comparisonMonth` sont O(1). Aucun nouvel appel réseau, listener de scroll, observer, intervalle ou stockage croissant n'est introduit.
- Le défaut de fidélité historique signalé par SECURITY modifie le verdict fonctionnel/sécurité, pas les coûts mesurés.

## P3 et limites

**P3 — profilage navigateur absent.** Aucun navigateur pilotable n'était disponible pour mesurer navigation, DOM, layout, paint, mémoire ou temps interactif réel. Le seuil UI `< 2 s` est donc étayé par la latence backend p95 `16,68 ms`, la réponse `116,1 KiB`, la taille DOM additionnelle constante et le microbenchmark de scripting, mais pas par une trace native. Une validation E2E navigateur reste recommandée avant release.

Le benchmark appelle le read-model en mémoire et n'inclut pas parsing HTTP, lecture du JSON persistant, transfert ni rendu. Ces coûts n'altèrent pas la marge de plus de `283 ms` au seuil API dans cette campagne, mais doivent rester surveillés si le volume documentaire dépasse 2 000 ou si l'historique dépasse 24 mois.

## Preuves fraîches et handoff

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `7b723b3ce6c43c9fb5ccc0ab9f016c2430429629` |
| benchmark 250/10 000/2 000, 30 itérations | **PASS**, p95 `16,68 ms`, max `24,90 ms` |
| `node --test tests/sprint8-dashboards.test.js tests/quotes.test.js tests/foundations.test.js` | **PASS, 86/86**, durée `3 618,10 ms` |
| `npm test` | **PASS, 354/354**, durée `8 598,51 ms` |
| `npm run lint` / `npm run build` | **PASS** |
| `git diff HEAD^ HEAD --check` | **PASS** |

Hashes SHA-256 : `server.js` `3f54a4e4b5e18601d10f5b5f6eb9492cf69edaabbf1a8b4b96f454e50635d0bb`; `app.js` `be0c9ff5c1e772b2e2f33ad6c7f800aa202c935ac6b9b8713a05f9ad085550f0`; `styles.css` `61e2a6dd342f18003d385443c22137fb1bafe926408bab3ddbf8732e2d6ee954`; OpenAPI `886adacddb00a96affbde2a9ac145d4941e73801657aa6ef60f484d4a6647518`.

Gate PERFORMANCE : **APPROVED** sur le candidat exact, sous réserve de la limite navigateur P3. Fichier modifié : `docs/performance-report.md` uniquement ; `docs/project-status.md` reste à consolider par l'intégrateur.

---

# Revalidation PERFORMANCE d'impact — validation couleur et ResizeObserver

Date : 2026-08-24

Candidat applicatif exact : `e39b9b0e2eecf7a0c9abeb0f20ec27650778b09f`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts, 2 P3.**

La validation couleur remplace une troncature constante par `trim().toUpperCase()` puis une regex sur une entrée déjà bornée par la taille maximale du body HTTP : coût O(longueur de la chaîne), négligeable face à l'écriture Client. Le `ResizeObserver` apporte un recalcul responsive O(1), sans modifier l'index Planning, les fenêtres virtuelles, le nombre de cartes ou les chemins backend mesurés.

## Analyse ResizeObserver et scroll responsive

- L'instance précédente est déconnectée avant chaque nouveau binding. Le nombre d'observers actifs est donc borné à un et le nombre de cibles à deux (`timeline`, `matrixShell`).
- Un lot de notification exécute deux lectures géométriques et un `style.setProperty`. La propriété ne change que la hauteur de `.planning-fixed-column`; le shell et la timeline observés ont une hauteur explicite. Aucun aller-retour géométrique attendu ne peut entretenir une boucle de resize.
- Le callback n'est pas installé dans `onscroll`; le scroll normal n'ajoute aucun calcul. Il s'active sur changement de dimensions (plein écran, viewport, disposition responsive) et laisse inchangés `scrollTop`, `scrollLeft`, les spacers et les seuils de virtualisation.
- Le style est réécrit même si la taille calculée est identique. Cela peut provoquer une invalidation de style superflue lors d'une rafale de resize, mais pas une croissance mémoire ni un coût dépendant des 10 000 réservations.
- Le Client drawer et le contrat OpenAPI sont sans impact runtime mesurable ; aucune dépendance ou requête réseau supplémentaire n'est ajoutée.

## Mesures et bornes réutilisées différentiellement

Le rendu couleur, l'index et le CSS sont byte-identiques au candidat `ea7863c` déjà mesuré : wrapper couleur p95 `1,47 ms` pour 390 cartes, `65,72 ms` pour 10 000 et `119,74 ms` pour 17 961. L'index long RC5 restait à `861,65 ms` p95 ; le chemin pré-DOM indicatif reste proche de `981,39 ms`, sous le budget UI `< 2 s`.

Ce diff ajoute seulement un callback O(1) aux redimensionnements. Aucun benchmark backend long n'a été répété : API Planning, Finance, Forecast, drill-down, persistance et SSE sont byte-identiques, à l'exception du validateur couleur hors chemins de lecture.

## P2/P3

1. **P2 hérité — DOM Planning long :** le plafond de 50 cartes reste local à chaque cellule et le stress long peut encore produire 17 961 cartes.
2. **P2 hérité — drill-down facturable :** dernière mesure RC5 `277,38 ms` p95, avec `22,62 ms` de marge au seuil `< 300 ms`; chemin non impacté.
3. **P3 — recherches couleur :** deux `find()` linéaires restent exécutés par carte ; les mesures passent mais des index par identifiant seraient préférables avant hausse de volumétrie.
4. **P3 — preuve navigateur/heap :** aucune trace native ResizeObserver, FPS, layout/paint, heap ou resize continu n'a été capturée. La déconnexion n'a pas été déplacée dans le chemin de logout, ce qui peut retenir un sous-arbre Planning unique jusqu'au prochain binding, sans accumulation à chaque rendu.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `e39b9b0e2eecf7a0c9abeb0f20ec27650778b09f` |
| Clients + Planning post-production | **PASS, 57/57**, durée `554,06 ms` |
| `npm test` | **PASS, 345/345**, durée `8 377,75 ms` |
| `npm run lint` / `npm run build` | **PASS** |
| `git diff --check HEAD^ HEAD` | **PASS** |
| benchmark couleur réutilisé, code inchangé | p95 `1,47 / 65,72 / 119,74 ms` pour `390 / 10 000 / 17 961` cartes |

Les preuves automatisées confirment installation/déconnexion structurelles, mais ne simulent pas l'algorithme de livraison d'un navigateur. Hashes : `app.js` `335de7ef6c0d039a8d692206b0d9e8f8c60e53681d9e529385ca90b8a91a72a3`; test Planning `ba73ce42df8468de4d6742448bd33f23fbebe527686c158870304a34766be363`; `planning.css` reste `b9cd0dda4f2b75b815b502aa5d07b6eb4cf73c331123a204d7daf8bd2b8de284`.

## Handoff

- Gate PERFORMANCE d'impact : **APPROVED** sur `e39b9b0`, 0 P0/0 P1/2 P2/2 P3.
- Aucun seuil contractuel n'est dépassé ; profilage navigateur responsive à reprendre en E2E.
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Gate PERFORMANCE indépendant post-RC5 — couleur Client et alignement du scroll Planning

Date : 2026-08-24

Candidat applicatif exact : `ea7863c20b5f148ddbd63f13afcdf211b0f008b1`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts, 2 P3.**

Le calcul d'alignement de la colonne fixe est O(1), exécuté une fois à chaque `bind()` du Planning et absent du handler de scroll. L'ajout couleur effectue deux recherches linéaires (`projects.find`, `clients.find`) par carte rendue ; sa mesure isolée reste négligeable sur la fenêtre contractuelle et sous 120 ms p95 même sur 17 961 cartes pré-DOM. Le formulaire Client ajoute un seul contrôle natif et aucune requête supplémentaire.

## Scroll, CSS et virtualisation

- `timeline.offsetHeight - timeline.clientHeight` lit deux métriques de layout puis écrit une custom property unique. Il peut provoquer une lecture synchronisée de layout par rendu, mais pas par événement `scroll`; aucune boucle, observer ou allocation cumulative n'est introduit.
- `.planning-fixed-column { height: calc(100% - var(--planning-scrollbar-size)) }` n'affecte que la composition de la colonne fixe. La piste, ses spacers, `scrollTop`, `scrollLeft`, `data-row-height` et les seuils de re-rendu virtualisé restent inchangés.
- Le liseré Client est un `box-shadow: inset` par carte. Il ne modifie ni taille intrinsèque, ni grille, ni nombre de nœuds ; son coût est limité au paint des cartes visibles.
- Les bornes antérieures restent : fenêtre verticale virtualisée, 92 colonnes maximum dans les vues longues, 50 cartes maximum par cellule, ligne globale `92 px` et ligne Projet plafonnée à `194 px`.

## Mesure fraîche du surcoût couleur

Microbenchmark Node reproduisant le wrapper exact (`find` Projet + Client, regex, deux `replace`) avec **2 000 Projets et 2 000 Clients**, trois warm-ups puis 30 itérations. Il mesure le scripting de génération de chaîne, pas l'insertion DOM/layout/paint.

| Cartes rendues | socle p95 | avec couleur p95 | coût total mesuré |
|---:|---:|---:|---:|
| fenêtre représentative `390` | `0,28 ms` | `1,47 ms` | `+1,19 ms` |
| stress `10 000` | `0,32 ms` | `65,72 ms` | `+65,40 ms` |

Campagne additionnelle du wrapper complet : `17 961` cartes, 10 itérations, médiane `118,37 ms`, p95/max `119,74 ms`. Ajouté au dernier index long frais RC5 (`861,65 ms` p95), le chemin pré-DOM reste proche de `981,39 ms`, sous le budget UI `< 2 s`; cette somme est indicative car les campagnes ne sont pas simultanées.

## P2/P3

1. **P2 hérité — DOM Planning long :** le plafond de 50 cartes est local à chaque cellule. Un stress de périodes longues peut toujours produire 17 961 cartes ; le liseré ne change pas la cardinalité mais ajoute un paint par carte.
2. **P2 hérité — drill-down facturable :** la dernière mesure RC5 `277,38 ms` p95 conserve seulement `22,62 ms` de marge au seuil `< 300 ms`; ce lot ne touche pas ce chemin.
3. **P3 — recherches répétées :** le wrapper couleur refait la recherche Projet déjà réalisée dans `event()` puis cherche le Client, soit O(R×(P+C)). Les mesures passent largement, mais des `Map` par identifiant éviteraient cette croissance avant une hausse des volumes.
4. **P3 — preuve navigateur :** aucune mesure fraîche DevTools de FPS, layout, paint, heap ou coût du Client drawer n'est disponible dans ce gate. La preuve E2E déjà indiquée dans le statut projet n'est pas revendiquée comme preuve indépendante ici.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `ea7863c20b5f148ddbd63f13afcdf211b0f008b1` |
| Clients + Planning post-production | **PASS, 57/57**, durée `538,11 ms` |
| `npm test` | **PASS, 345/345**, durée `8 452,48 ms` |
| `npm run lint` | **PASS** |
| `git diff --check HEAD^ HEAD` | **PASS** |
| benchmark couleur, 390 / 10 000 / 17 961 cartes | p95 `1,47 / 65,72 / 119,74 ms` |

Le coût CSS réel dépend du navigateur, du GPU, du facteur d'échelle et du nombre de cartes peintes. Hashes : `app.js` `1beae9dda81bab93b6079112727da792cbe6d39cffe580444309f8fb7ec71de8`; `planning.css` `b9cd0dda4f2b75b815b502aa5d07b6eb4cf73c331123a204d7daf8bd2b8de284`; test Planning `2f12e857bcce45c2ac7fab61010f47c9a6b9d1abf35921008ad9e012c5f26738`.

## Handoff

- Gate PERFORMANCE post-RC5 : **APPROVED** sur `ea7863c`, 0 P0/0 P1/2 P2/2 P3.
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation finale PERFORMANCE RC5 — moyenne directe occupancyGap

Date : 2026-08-24

Candidat exact : `4e094d589ae215f31152110d30f1163929ca1338`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts, 1 P3.**

Le correctif remplace un `reduce()` des valeurs planifiées suivi d'une soustraction par un `reduce()` direct des écarts. Nombre de parcours, cardinalité, allocations et complexité restent identiques : O(A) en temps et O(1) en mémoire additionnelle, avec A égal au nombre de périodes autorisées disposant d'un réalisé.

## Mesure ciblée fraîche

Dataset contractuel : 250 ressources, 10 000 réservations, 2 000 documents, 2 000 réalisés et 2 000 coûts Projet. Deux warm-ups puis 20 itérations, filtre Projet + Ressource, du 1er au 23 août 2026.

| Chemin | p50 | p95 | max | Parent `ace4048` p95 |
|---|---:|---:|---:|---:|
| dashboard Exploitation complet | `20,31 ms` | `20,92 ms` | `21,27 ms` | `20,97 ms` |
| drill-down `occupancyGap`, page 100 | `40,20 ms` | `41,21 ms` | `46,47 ms` | `42,15 ms` |

Les deux chemins restent très sous le seuil `< 300 ms` et ne montrent aucune régression. `app.js`, Planning, Forecast, exports et rendu Pilotage sont byte-identiques ; leurs mesures RC5 sont donc réutilisées différentiellement, sans campagne longue.

## P2/P3 hérités, sans aggravation

1. Cap Planning local à chaque cellule, avec risque DOM sur une vue longue artificiellement concentrée.
2. Marge réduite du drill-down montant facturable RC5 (`277,38 ms` p95), chemin indépendant d'Exploitation.
3. Preuve navigateur RC5 encore absente pour scroll/layout/focus ; aucun frontend n'est modifié ici.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `4e094d589ae215f31152110d30f1163929ca1338` |
| `node --test tests/sprint8-dashboards.test.js` | **PASS, 14/14**, durée `1 718,16 ms` |
| benchmark ciblé 20 itérations | résultats ci-dessus |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

La suite complète `345/345` du parent immédiat est une preuve différentielle, pas une exécution fraîche du candidat. Hashes : `server.js` `2f850f7f2e797b3228524b9e94d0566004e951f28126d9141b51cc0e6918aa20`; test dashboards `22fce8f6b77ea70572c9fd6bef0d87e4fce552f07d97c712761e6861a4cbc6ab`; `app.js` inchangé `0fc0dad429e78aa6aea63884f6d903939189e2793b6505b3d363d7e49cbc36cd`.

## Handoff

- Gate PERFORMANCE final RC5 : **APPROVED** sur `4e094d5`, 0 P0/0 P1/2 P2/1 P3 hérités.
- Fichier modifié : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation d'impact PERFORMANCE RC5 — réconciliation occupancyGap

Date : 2026-08-24

Candidat exact : `ace4048f20e3524b003c49df0f1ee42d01551ee8`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts, 1 P3.**

Le changement ajoute une seconde réduction linéaire sur `actualItems`, après le calcul déjà dominant de `financeOccupancy()`. Sur le dataset contractuel de 250 ressources, 10 000 réservations, 2 000 documents, 2 000 réalisés et 2 000 coûts Projet, le dashboard Exploitation termine à `20,97 ms` p95 et le drill-down `occupancyGap` à `42,15 ms`, très sous le seuil de lecture `< 300 ms`.

## Complexité et mesure ciblée

- `actualItems = occupancy.items.filter(...)` existait déjà ; `plannedActualBps` ajoute un seul `reduce()` O(A), où A est le nombre de périodes autorisées disposant d'un réalisé et A ≤ 10 000 par borne interne.
- La mémoire additionnelle est O(1) au-delà du tableau `actualItems` préexistant : un accumulateur numérique et une moyenne.
- Aucun calcul frontend, rendu DOM, export, écriture, index Planning ou requête supplémentaire n'est ajouté.

Deux warm-ups puis 20 itérations, filtre Projet + Ressource, période du 1er au 23 août 2026 :

| Chemin | p50 | p95 | max | Seuil |
|---|---:|---:|---:|---:|
| dashboard Exploitation complet | `20,26 ms` | `20,97 ms` | `22,40 ms` | `< 300 ms` |
| drill-down `occupancyGap`, page 100 | `40,13 ms` | `42,15 ms` | `45,57 ms` | `< 300 ms` |

La campagne longue Planning/Forecast n'a pas été rejouée, conformément au périmètre d'impact : `app.js`, `planning.css`, Forecast, exports et autres dashboards sont byte-identiques au candidat RC5 déjà mesuré.

## P2/P3 hérités, sans aggravation

1. Le cap Planning de 50 cartes reste local à la cellule ; les vues longues très concentrées peuvent encore produire un DOM important.
2. Le drill-down montant facturable RC5 avait une marge réduite au seuil (`277,38 ms` p95) ; il n'est pas appelé par Exploitation et ce correctif ne touche pas son chemin.
3. La limite P3 de preuve navigateur RC5 reste ouverte pour scroll/layout/focus ; aucun comportement UI n'est modifié ici.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `ace4048f20e3524b003c49df0f1ee42d01551ee8` |
| Dashboards + sécurité G8 ciblés | **PASS, 18/18**, durée `1 954,76 ms` |
| `npm test` | **PASS, 345/345**, durée `10 203,72 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Hashes : `server.js` `59fd6560e67a399887e49d4ec9495573c658285d48b7959c1da2406f62249a8f`; test dashboards `c376b650d59ce736b29ab2f20f2abea9494c09340470facba09afd900298a723`; `app.js` inchangé `0fc0dad429e78aa6aea63884f6d903939189e2793b6505b3d363d7e49cbc36cd`.

## Handoff

- Gate PERFORMANCE d'impact RC5 : **APPROVED** sur `ace4048`, 0 P0/0 P1/2 P2/1 P3 hérités.
- Fichier modifié : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Gate PERFORMANCE indépendant RC5 — Planning long, Pilotage et Forecast métier

Date : 2026-08-24

Candidat exact : `b715f4ba1453ed9a73db3fd2f32e996957a700d2`

Code Forecast inclus : `d96281e0caf86777cdc21eba3ece9ab516420ddf`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts, 1 P3.**

Les chemins affectés respectent les seuils contractuels. Sur 250 ressources, 10 000 réservations, 2 000 documents, 2 000 réalisés et 2 000 coûts Projet, Forecast termine à `71,37 ms` p95, le dashboard Direction complet à `256,64 ms`, Finance à `196,65 ms` et le drill-down Occupation réelle à `61,48 ms`. L'index Planning représentatif 20 salles × 92 jours termine à `32,86 ms` p95 ; le stress de 10 000 périodes longues reste à `861,65 ms` avant DOM.

## Planning long — mesures fraîches

Deux warm-ups ; 20 itérations représentatives/concentrées et 8 longues. Les 10 000 réservations représentatives sont distribuées sur 250 ressources et 180 jours ; la fenêtre monte 20 ressources et les 92 colonnes du trimestre.

| Scénario | Clés / entrées | Cartes bornées | p50 | p95 |
|---|---:|---:|---:|---:|
| représentatif 250 ressources / 180 jours, fenêtre 20 × 92 | `178 / 390`, max `3/cellule` | `390` | `32,24 ms` | `32,86 ms` |
| concentré 10 000 dans une cellule | `1 / 10 000`, max `10 000/cellule` | `50` | `33,22 ms` | `35,41 ms` |
| 10 000 périodes de 92 jours | `1 710 / 17 961`, max `21/cellule` | `17 961` | `828,42 ms` | `861,65 ms` |

- `planningColumnSlice(..., true)` monte exactement 92 colonnes pour Mois/3 mois ; leur largeur totale est bornée à `4 784 px` en Mois plein écran et `3 496 px` en trimestre.
- La virtualisation verticale reste active. À 20 lignes visibles, le socle est 1 840 cellules plus les cartes correspondantes ; au jeu représentatif, seulement 390 cartes sont produites.
- Jour et Semaine conservent la virtualisation horizontale. Les quatre vues sont donc bornées ; aucune croissance avec une période utilisateur arbitraire n'est ajoutée.

## Finance, Forecast et drill-down — dataset contractuel

`npm run benchmark:finance`, 8 itérations après warm-up :

| Lecture | p50 | p95 | seuil |
|---|---:|---:|---:|
| Forecast 30/60/90 | `67,89 ms` | `71,37 ms` | `< 300 ms` |
| Backlog | `59,77 ms` | `75,80 ms` | `< 300 ms` |
| Occupation journalière | `20,67 ms` | `25,16 ms` | `< 300 ms` |
| Drill-down montant facturable | `207,59 ms` | `277,38 ms` | `< 300 ms` |

Mesure additionnelle à 20 itérations sur le même dataset : Direction `193,29 / 256,64 ms` p50/p95 ; Finance `189,47 / 196,65 ms` ; drill-down Occupation réelle `58,03 / 61,48 ms`. Le rendu Forecast ajoute seulement trois cartes et deux sous-montants par horizon ; le détail modal rend au plus 100 lignes par page.

## P2 importants

1. Le cap de 50 cartes est local à chaque cellule. Les colonnes longues restent toutes montées pour stabiliser le scroll ; le stress artificiel produit encore 17 961 cartes visibles après indexation. Un plafond global ou une virtualisation DOM bidimensionnelle serait requis avant d'accepter des périodes longues fortement concentrées comme usage contractuel.
2. Le drill-down montant facturable a atteint `277,38 ms` p95, soit seulement `22,62 ms` de marge au seuil, même si une seconde exécution est descendue à `213,71 ms`. Surveiller ce chemin et indexer davantage les lignes Finance avant d'augmenter les volumes.

## P3 — limite de preuve UI

Aucun navigateur n'était connecté. Les mesures couvrent calcul, index et read-models, mais pas l'attachement DOM, layout, paint, FPS, focus modal ou fluidité du scroll réel. L'exploitabilité `< 2 s` est fortement soutenue sur le dataset représentatif, mais doit être confirmée par le smoke E2E RC5.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `b715f4ba1453ed9a73db3fd2f32e996957a700d2` |
| Planning + dashboards + sécurité G8 ciblés | **PASS, 63/63**, durée `1 986,44 ms` |
| `npm test` | **PASS, 344/344**, durée `8 387,39 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Hashes : `app.js` `0fc0dad429e78aa6aea63884f6d903939189e2793b6505b3d363d7e49cbc36cd`; `planning.css` `1e5227f04bb781756318676054242713664e07dee048dee4e664198dd3ed289b`; `server.js` `504ae0263fbe8674f1ab26f23863e7ebe206ef854ccb1b698e0b7bc9ff07ee13`; benchmark Finance `087702c7b9bf7d19c4f2a1042bd5318a234332f4863f7c3e571f34857d73e08e`.

## Handoff

- Gate PERFORMANCE RC5 : **APPROVED** sur `b715f4b`, 0 P0/0 P1/2 P2/1 P3.
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation d'impact PERFORMANCE indépendante — chevauchement demi-journée Planning RC3

Date : 2026-08-24

Candidat applicatif exact : `2fd37e212d19ecc507cfe12f077474f716ec0edd`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 ouvert, 1 P3.**

Le correctif ajoute exactement un contrôle de chevauchement O(1) par cellule candidate en vue demi-journée. L'index reste une passe sur les cellules rendues suivie de lectures O(1) par cellule visible. Le scénario frais le plus lourd, 10 000 périodes de 92 jours, termine à **1 064,73 ms p95 avant DOM**, sous le budget UI contractuel de 2 secondes.

## Benchmark frais — index demi-journée

Warm-up de deux passes ; 20 itérations distribuées/concentrées et 8 itérations longues. Fenêtre visible de 20 salles × 18 jours, 10 000 réservations :

| Scénario | Clés / entrées | Cartes bornées | p50 | p95 / max |
|---|---:|---:|---:|---:|
| distribué 20 × 18 / 10 000 | `180 / 10 000`, max `56/cellule` | `9 000` | `39,12 ms` | `40,63 ms` |
| concentré 1 cellule / 10 000 | `1 / 10 000`, max `10 000/cellule` | `50` | `38,75 ms` | `41,19 ms` |
| 10 000 périodes de 92 jours | `350 / 95 040`, max `500/cellule` | `17 500` | `1 042,62 ms` | `1 064,73 ms` |

Ces mesures appellent directement `planningCellEntriesBySlot(..., true, 'halfDay')`. Elles incluent la réplication des cellules et le nouveau contrôle, mais pas l'attachement DOM, le layout ni le paint.

## Complexité et bornes

- `planningSlotContainsBooking()` effectue des comparaisons numériques, sans parcourir de collection. Il n'est appelé que lorsqu'un slot candidat existe pour la date de la cellule.
- L'index reste O(cellules de réservation + slots + cellules visibles), sans rescan des 10 000 réservations par cellule visible.
- Les plafonds restent **50 cartes + un résumé par cellule**, ligne Projet **194 px**, ligne globale **92 px**, largeur horaire confinée et handler synchronisé sur `data-row-height` / `data-column-width`.
- Les périodes entièrement hors 09:00–18:00 sont désormais éliminées avant insertion dans la Map et avant rendu DOM.

## P2 important / limite de montée en charge

L'index conserve toutes les références d'une clé avant le `slice(0, 50)`. À 10 000 entrées concentrées, le p95 reste `41,19 ms`, mais `{count, first50}` réduirait la mémoire temporaire avant toute hausse de volumétrie. Le cap de 50 est local : le cas long peut encore produire 17 500 cartes sur l'ensemble de la fenêtre.

## P3 — limite de preuve navigateur

Le navigateur intégré est indisponible. Aucun profil frais scripting/DOM/layout/paint, FPS ou heap n'est revendiqué. Le pire index laisse environ 935 ms sur le budget de 2 secondes ; l'interactivité réelle du cas long reste à confirmer en E2E navigateur.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `2fd37e212d19ecc507cfe12f077474f716ec0edd` |
| benchmark ad hoc `planningCellEntriesBySlot` | résultats du tableau ci-dessus |
| Foundations + Planning post-production | **PASS, 61/61**, durée `320,47 ms` |
| `npm test` | **PASS, 341/341**, durée `8 514,32 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Hashes : `app.js` `d38593864538040fa829aa3ee24fd649199cb3f2b1ba5a81c683c12dd741c1f5`; test Planning `4cc26cb0461e93fba23ce88b62fb527403bf7220455d44a1c33e7c712dd4a3cf`; `planning.css` `c7904c3cfab77078997ba5efb7c9c34e24d17db2fc2abb8773351985881bfdb1`.

## Handoff

- Gate PERFORMANCE d'impact Planning RC3 : **APPROVED** sur `2fd37e2`, 0 P0/0 P1/1 P2/1 P3.
- `PERF-G8-09` reste fermé ; aucune reprise DEV bloquante n'est demandée.
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation terminale PERFORMANCE indépendante — borne de pile Planning RC3

Date : 2026-08-24

Candidat applicatif exact : `75a85cfdb3236ee1dcc63652d8a73fa578693ea5`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 ouvert, 1 P3.**

Le correctif ferme les quatre composantes de `PERF-G8-09` : vue globale à `92 px`, vue Projet plafonnée à **194 px**, DOM limité à **50 cartes + un résumé par cellule**, et collecte indexée en une seule passe par `planningCellEntriesBySlot()`. Le handler relit exactement `data-row-height` et `data-column-width`; les piles horaires sont confinées au créneau.

La même fenêtre distribuée 20 salles × 18 jours / 10 000 réservations passe de **11 298,67 ms** à **32,43 ms p95**. Le pire scénario mesuré — 10 000 périodes couvrant 92 jours — termine à **821,29 ms p95** avant DOM, sous le budget UI `< 2 s` avec une marge de 1,18 s.

## Mesures fraîches — index 250 ressources / 10 000 réservations / 92 jours

Warm-up de deux passes ; 20 itérations distribuées/concentrées/horaires et 8 itérations longues :

| Scénario indexé | Résultat | p50 | p95 / max |
|---|---:|---:|---:|
| distribué, fenêtre 20 salles × 18 jours | `168` entrées, max `1/cellule` | `31,66 ms` | `32,43 ms` |
| concentré, 1 salle × 18 jours | `10 000` entrées, `50` rendues, max `10 000/cellule` | `33,93 ms` | `35,32 ms` |
| 10 000 périodes de 92 jours, fenêtre 20 × 18 | `14 400` entrées/rendues, max `40/cellule` | `811,45 ms` | `821,29 ms` |
| demi-journée, 20 salles / 10 000 | `10 000` entrées, `1 000` rendues, max `500/cellule` | `37,56 ms` | `38,13 ms` |

La vue globale normale reste à `planningRowHeight(92, 1) = 92 px`. Les lignes Projet sont bornées à `194 px`; l'étendue virtuelle maximale de 250 lignes est `48 500 px`. Ces quatre lignes mesurent directement l'index pré-DOM, sans attachement DOM, layout ni paint.

## Fermeture de PERF-G8-09

- `planningCellEntriesBySlot()` parcourt les réservations/cellules une seule fois, élimine immédiatement les salles et dates hors fenêtre, puis range chaque entrée dans une `Map` `resourceId|slot.key`.
- Le rendu effectue ensuite une lecture O(1) par cellule visible ; l'ancien produit `cellules visibles × réservations × jours` disparaît. La complexité devient O(cellules de réservation + slots + cellules visibles).
- Hauteur globale (`92 px`), hauteur Projet (`194 px`), DOM local (`50 + résumé`) et largeur des piles horaires restent bornés. Un événement horaire isolé conserve son `span`.
- Les tests ciblés vérifient une indexation fonctionnelle, l'absence de `bookings.flatMap` dans la boucle visible, les caps et les sélecteurs timed/non-timed.

## P2 important / limite de montée en charge

L'index conserve encore toutes les références d'une clé avant que le rendu n'en prenne 50. À la volumétrie contractuelle, le concentré 10 000 reste à `35,32 ms` et une Map de 10 000 références. Avant d'augmenter la limite globale de réservations ou d'autoriser des périodes sensiblement plus longues, stocker `{count, first50}` par clé réduirait la mémoire temporaire. Le cas long visible produit également 14 400 cartes agrégées sur 360 cellules ; le cap est local et non global.

## P3 — limite de preuve navigateur

Le navigateur intégré est indisponible. Aucun profil frais scripting/DOM/layout/paint, FPS, heap ou test de scroll imbriqué n'est disponible. L'approbation repose sur l'index mesuré sous 0,83 s, les caps mathématiques et l'analyse DOM ; l'interactivité réelle `< 2 s` du cas long 14 400 cartes reste à confirmer en E2E.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `75a85cfdb3236ee1dcc63652d8a73fa578693ea5` |
| benchmark ad hoc `planningCellEntriesBySlot` | résultats du tableau ci-dessus |
| Foundations + Planning post-production | **PASS, 61/61**, durée `317,95 ms` |
| `npm test` | **PASS, 341/341**, durée `8 239,78 ms` hors sandbox |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

```text
app.js                               98f9740d54dbc2c460c77cc40958f27663c220f8df5043a445f5ea313a23f3df
planning.css                         c7904c3cfab77078997ba5efb7c9c34e24d17db2fc2abb8773351985881bfdb1
server.js                            b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
index.html                           419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
tests/planning-postproduction.test.js 6e7e9197bf8f26ff6a38f614a4ae6dd80e34e543551e4642ba700ff78654fd66
tests/foundations.test.js            81af03baa607a81fc66e210c3cda032f240b7e37abbe47c08606a3816db96abf
```

## Handoff

- Gate PERFORMANCE Planning RC3 : **APPROVED** sur `75a85cf`, 0 P0/0 P1/1 P2/1 P3.
- `PERF-G8-09` est fermé ; aucune reprise DEV bloquante demandée sur cet axe.
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

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

# Revalidation PERFORMANCE indépendante — hauteur dynamique Planning RC3

Date : 2026-08-24

Candidat applicatif exact : `e9752f4e791f42bfcd8ad584e898ce68e20a850f`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**REJECTED — 0 P0, 1 P1 ouvert, 0 nouveau P2, 1 P3.**

Le comportement nominal est rapide sur 250 ressources / 10 000 réservations courtes et distribuées, en vue classique comme horaire. En revanche, l'algorithme parcourt toutes les cellules rendues de chaque réservation avant virtualisation, et applique la profondeur maximale d'une seule cellule uniformément aux 250 lignes. Les durées longues et les accumulations historiques valides provoquent une amplification CPU et layout non bornée. Le critère UI exploitable `<2 s` n'est plus démontrable sur le contrat 10 000 sans contrainte de distribution.

## Mesures fraîches 250 / 10 000

30 itérations après warm-up :

| Scénario | Résultat | p95 |
|---|---:|---:|
| non horaire, 10 000 réservations courtes distribuées sur 250 salles/92 jours | profondeur `1` | `76,90 ms` |
| horaire, 10 000 réservations distribuées sur 250 salles/48 slots | profondeur `2` | `44,94 ms` |
| 10 000 réservations concentrées dans une cellule | profondeur `10 000` | `36,58 ms` calcul CPU, mais hauteur `620 008 px` |
| 10 000 réservations valides couvrant 92 jours | profondeur `40` | `1 064,18–1 068,64 ms` sur seulement deux mesures |

Ces temps couvrent uniquement `planningMaxCellStack()`, avant le rendu des cellules, le DOM, le layout et le paint existants.

## P1 — PERF-G8-09 — amplification globale non bornée

1. **Complexité CPU :** non horaire, le coût est proportionnel au total des cellules matérialisées par `bookingRenderedCells`; horaire, chaque cellule ajoute un `slots.find`, donc jusqu'à O(cellules × slots). Dix mille périodes de 92 jours matérialisent environ 920 000 cellules et dépassent déjà une seconde hors DOM.
2. **Amplification layout :** `planningRowHeight()` vaut `62 × profondeur + 8` et la valeur maximale globale est appliquée à chaque ressource. Une seule cellule dense agrandit les 250 lignes.
3. **Virtualisation compromise :** à profondeur 10 000, le scroll théorique atteint 155 002 000 px. Les moteurs navigateur plafonnent couramment les dimensions de scroll ; même avant ce plafond, chaque ligne devient presque inutilisable et les calculs de fenêtre supposent une hauteur uniforme gigantesque.
4. **Données légitimes :** les réservations annulées restent visibles/comptées et peuvent s'accumuler sans capacité consommée. Le cas ne dépend donc pas d'une corruption de données.

Correction attendue avant re-gate : exclure/compacter les statuts historiques du calcul visuel, plafonner la pile avec un résumé `+N`, ou gérer des hauteurs par ressource avec une virtualisation adaptée ; pré-indexer les cellules par ressource/date/slot pour éviter les recomputations et `slots.find`. Ajouter une preuve 250/10 000 incluant périodes longues et cellule dense avec borne explicite de hauteur/temps.

## Timed/non-timed, axes et paint

- Les formules horaires et demi-journée classent correctement une réservation dans son slot de départ ; la largeur `span` demeure inchangée.
- Inclure `rowHeight` dans `virtualKey` réinitialise correctement les fenêtres lorsque la profondeur change, mais remet aussi le scroll au sommet à chaque variation de pile.
- Les axes et spacers utilisent tous la même hauteur, ce qui conserve l'alignement mathématique tant que la dimension reste supportée par le navigateur.
- Le paint augmente directement avec la hauteur des cellules visibles ; la virtualisation réduit le nombre de lignes DOM, pas la dimension extrême d'une ligne.

## P3 — limite navigateur

Le navigateur intégré est indisponible. Aucune mesure réelle de scrollHeight maximal, FPS, layout ou paint n'a été capturée ; cette limite renforce la nécessité de borner mathématiquement la hauteur avant validation.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `e9752f4e791f42bfcd8ad584e898ce68e20a850f` |
| Foundations + Planning post-production | **PASS, 61/61**, durée `318,96 ms` |
| `npm test` | **PASS, 341/341**, durée `8 885,81 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |
| benchmark ad hoc `planningMaxCellStack` | mesures ci-dessus, processus Node local sans DOM |

```text
app.js                              4a8427df94b98677a16e99e5795c6aabfff0ea6a0e3e42880ce1e9781f8d2005
planning.css                        48a8ad5bec9e86c56d3444812632506a022be837eef82418f6db1b962d9bec36
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/planning-postproduction.test.js 927dee2c88297b4457c381f42e399db65edfa3f888f1116b790754989266ecee
```

## Handoff

- Gate PERFORMANCE hauteur dynamique : **REJECTED** sur `e9752f4`, 0 P0/1 P1 (`PERF-G8-09`)/0 nouveau P2/1 P3.
- Retour DEV puis re-gate Performance requis avant validation RC3.
- Fichier modifié par cet axe : `docs/performance-report.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation finale PERFORMANCE — hiérarchie sticky Planning RC2

Date : 2026-08-24

Candidat applicatif exact : `56b9f456734de9389c1f4ab6623a378448fe2b67`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 0 nouveau P2, 1 P3.**

`PERF-G8-08` est fermé. Le header dates `10` domine désormais toutes les réservations, y compris le focus `9`; la colonne fixe `11` et son coin `12` dominent la timeline lors des raccords. Les niveaux ne changent aucune dimension, position sticky, overflow, grille ou fenêtre virtualisée.

## Paint, layout, axes et virtualisation

- Les éléments concernés étaient déjà positionnés avec `z-index` non automatique : aucun nouveau contexte d'empilement ni nouvelle géométrie n'est créé.
- Aucun reflow structurel : seules trois valeurs numériques de paint order changent.
- Axe horizontal : `.planning-matrix-scroll` conserve `overflow:auto`, le header dates reste sticky en haut et le contenu virtuel garde ses paddings gauche/droite.
- Axe vertical : la timeline et `.planning-fixed-column` conservent leur synchronisation `scrollTop`; les spacers haut/bas et hauteurs de lignes sont inchangés.
- Les recalculs de fenêtre `requestAnimationFrame`, `scrollLeft`, `scrollTop`, viewport et seuils ne changent pas.
- Les niveaux `10/11/12` restent sous les overlays globaux et ne génèrent pas de compositing massif dépendant des 10 000 réservations ; seules les dates rendues dans la fenêtre sont présentes.

## P3 — limite navigateur

Le navigateur intégré est indisponible : aucune trace FPS, paint/compositing ou vérification visuelle des deux axes n'a été capturée. Les tests prouvent les contrats de scroll/virtualisation et l'analyse du diff exclut un coût layout, mais une recette visuelle reste souhaitable.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `56b9f456734de9389c1f4ab6623a378448fe2b67` |
| diff depuis `d4c7fcf` | trois niveaux CSS corrigés + assertion ; aucun JS/backend |
| Foundations + Planning post-production | **PASS, 60/60**, durée `316,68 ms` |
| `npm test` | **PASS, 340/340**, durée `8 487,34 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

```text
planning.css                        48a8ad5bec9e86c56d3444812632506a022be837eef82418f6db1b962d9bec36
styles.css                          8f14b1483f6bb58522df36a3841e318099ca9a0fc32b82f8b9b6fde1fd07c196
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
tests/foundations.test.js           81af03baa607a81fc66e210c3cda032f240b7e37abbe47c08606a3816db96abf
tests/planning-postproduction.test.js 9c5721e024c6e25161916c1a256202f1a289a80a86ae62e6b967764a714e061f
```

## Handoff

- Gate PERFORMANCE Planning scroll final : **APPROVED** sur `56b9f45`, 0 P0/0 P1/0 nouveau P2/1 P3.
- `PERF-G8-08` est fermé.
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
## Gate PERFORMANCE indépendant — Catalogue articles SAGE — 2026-08-26

Candidat observé : HEAD `231abf5aaf8641dad1229bb98db3a451c05bf694`, avec lot Catalogue articles SAGE non commité identifié par les empreintes ci-dessous.

Reviewer : agent indépendant `article_performance`.

### Verdict

**APPROVED sur l’état mesuré — 0 P0, 0 P1, 0 P2 performance, 1 P3.**

Deux campagnes HTTP fraîches sur 10 071 articles respectent largement les seuils contractuels : lecture/recherche p95 maximal observé `41,93 ms` pour un seuil `< 300 ms`, mutation versionnée avec persistance p95 maximal `56,06 ms` pour un seuil `< 250 ms`. Le P1 fonctionnel/sécurité signalé en parallèle sur le wrapper `finance.read` ne modifie pas ces chemins, mais son correctif DEV exigera une revalidation d’impact avant de réutiliser ce verdict pour la release.

### Méthodologie et résultats frais

Commande : `npm run benchmark:article-catalog`, exécutée deux fois sur macOS arm64, Node `v26.6.0`. Chaque campagne crée un fichier isolé dans le répertoire temporaire, démarre un serveur HTTP sur loopback puis supprime automatiquement le jeu et ses fichiers associés.

Jeu : 10 000 articles synthétiques auxquels s’ajoutent les 71 articles SAGE migrés ; 50 recherches HTTP authentifiées `q=benchmark&pageSize=100`, chacune vérifiant un total de 10 000 résultats ; 20 `PATCH` HTTP successifs sur le même article avec version optimiste, idempotence, audit, révision et écriture atomique du fichier JSON.

| Campagne | Échantillons lecture | p95 lecture | Échantillons écriture | p95 écriture |
|---|---:|---:|---:|---:|
| 2026-08-26 10:06:24 UTC | 50 | `41,93 ms` | 20 | `56,06 ms` |
| 2026-08-26 10:06:44 UTC | 50 | `40,21 ms` | 20 | `51,94 ms` |

La lecture filtre puis trie les correspondances avant pagination : coût O(N log N) dans le pire cas de recherche large, mesuré ici sur 10 000 correspondances. L’écriture met à jour l’article, ajoute audit/révision puis sérialise atomiquement la base locale : coût O(N) sur ce backend JSON. Les marges minimales observées sont de `258,07 ms` en lecture et `193,94 ms` en écriture.

### Impact UI et limites

Le chargement métier actuel demande une page API de 500 éléments au maximum et rend cette page côté navigateur ; le catalogue réel approuvé contient 71 lignes. La recherche ensuite effectuée dans la page est linéaire sur les éléments chargés et un rendu recrée les lignes filtrées. Aucun polling, listener par ligne, dépendance externe ou accès réseau supplémentaire n’est introduit.

**P3 — mesure UI interrompue et non revendiquée.** Le serveur utilisateur sur 8080 était arrêté. Une instance temporaire isolée a été démarrée sur 8230, mais la tentative de mesure navigateur a été interrompue avant navigation et ne constitue aucune preuve. Le seuil UI exploitable `< 2 s` reste donc à confirmer en E2E sur les 71 lignes réelles. Le comportement DOM à 500 lignes n’a pas été profilé ; au-delà de 500 articles, l’interface actuelle ne propose pas de pagination vers les pages suivantes.

Le benchmark n’isole pas min/p50/max, débit concurrent, consommation mémoire, croissance sur plusieurs milliers de révisions ni contention de deux écritures simultanées. Les p95 incluent toutefois HTTP, auth de session, validation, filtrage/tri, sérialisation de réponse et, pour les mutations, persistance atomique.

### Empreintes et handoff

| Fichier mesuré | SHA-256 |
|---|---|
| `server.js` | `e80a84366429127c2cd4ec8190159ff238aaa3896b5ce780d4986ccbac6f58fd` |
| `app.js` | `ea6f0fbc933690cb771802d31ddb274445321c4784d88a4c258f87c2ede1f705` |
| `scripts/benchmark-article-catalog.js` | `797762d839a0331e53029df049a3fac03c005e38e1810fa885b725a06d971cb9` |
| `tests/article-catalog.test.js` | `748bdb364a2b7ae5bd1e642ddf3f52c70b74667cbca6e491e6e1d96aa60ceb2b` |

Gate PERFORMANCE Catalogue articles SAGE : **APPROVED sur cette empreinte**, avec limite UI P3 et revalidation d’impact obligatoire après le correctif P1 parallèle. Fichier modifié : `docs/performance-report.md` uniquement ; consolidation de `docs/project-status.md` laissée à l’intégrateur.

---

## Re-gate PERFORMANCE indépendant — Catalogue articles SAGE corrigé et gelé — 2026-08-26

Candidat observé : HEAD `231abf5aaf8641dad1229bb98db3a451c05bf694`, lot non commité gelé identifié par les empreintes de fichiers ci-dessous.

Reviewer : agent indépendant `article_performance`.

### Verdict

**APPROVED sur l’empreinte finale mesurée — 0 P0, 0 P1, 1 P2 de montée en charge UI, 1 P3.**

La campagne HTTP fraîche sur 10 071 articles mesure un p95 lecture de `39,33 ms` (`< 300 ms`) et un p95 écriture de `70,22 ms` (`< 250 ms`). Les correctifs fonctionnels postérieurs au premier gate n’ont donc pas dégradé les seuils serveur. Le chargement exhaustif `apiAll` corrige la complétude fonctionnelle et la pagination d’affichage borne le DOM à 100 lignes ; sa stratégie séquentielle doit toutefois être surveillée si le catalogue croît de 71 à plusieurs milliers d’articles.

### Preuve serveur fraîche

Environnement : macOS arm64, Node `v26.6.0`.

Commande : `npm run benchmark:article-catalog`.

| Date UTC | Jeu | Lecture | Écriture |
|---|---:|---:|---:|
| 2026-08-26 10:32:26 | 10 000 synthétiques + 71 SAGE | 50 échantillons, p95 `39,33 ms` | 20 échantillons, p95 `70,22 ms` |

Chaque lecture est un GET HTTP authentifié avec recherche large sur 10 000 résultats et page de 100 lignes. Chaque écriture est un PATCH HTTP versionné avec contrôle optimiste, idempotence, audit, révision et persistance atomique. Les marges sont de `260,67 ms` en lecture et `179,78 ms` en écriture.

### Analyse `apiAll` et pagination UI

- `apiAll` demande des pages de 200 lignes, séquentiellement, jusqu’au total annoncé ou 100 pages. Pour les 71 articles réels, une seule requête suffit. Pour 10 071 articles, 51 requêtes sont nécessaires ; chacune refiltre et retrie actuellement la collection complète côté serveur.
- Une extrapolation prudente à partir du p95 unitaire `39,33 ms` donne environ `2 006 ms` pour 51 pages, avant parsing, assemblage et rendu. Ce n’est pas une mesure bout-en-bout et ne constitue pas un dépassement observé, mais montre que le seuil UI `< 2 s` n’est pas garanti à 10 071 articles avec ce protocole.
- Le DOM est désormais borné à 100 lignes par `articleCatalogModule.pageSize`. Les boutons Précédent/Suivant ne déclenchent pas d’appel réseau et rendent uniquement la tranche locale.
- La recherche locale reste O(N) sur tous les éléments chargés. Le calcul des codes SAGE partagés utilise un `filter` avec `findIndex`, donc O(N²) dans le pire cas, même si seules 100 lignes sont rendues.
- Microbenchmark reproductible du calcul exact des doublons, cinq passages : 71 éléments `0,06 ms` p50, `0,16 ms` max ; 10 071 éléments `33,47 ms` p50, `107,86 ms` max. Ce coût est faible au volume métier actuel, mais évitable avec un comptage O(N).
- Le listener SSE est unique et le rechargement est temporisé à 250 ms. Il n’ajoute pas de polling ni de travail proportionnel au nombre de lignes entre deux invalidations.

**P2 — montée en charge du chargement exhaustif.** À 10k articles, les 51 requêtes séquentielles et le recalcul O(N²) des doublons risquent de dépasser le budget interactif, même si le DOM reste borné. Avant d’approcher ce volume, paginer/rechercher côté serveur ou fournir un endpoint de catalogue compact, et calculer les doublons en O(N).

**P3 — absence de trace navigateur bout-en-bout.** Aucun temps vers contenu visible, layout, paint, mémoire ou interaction n’a été capturé sur l’état final. Le seuil UI `< 2 s` reste à confirmer en E2E sur le catalogue métier de 71 lignes. Les mesures Node du calcul local n’incluent pas le DOM.

### Empreinte finale et handoff

| Fichier mesuré | SHA-256 |
|---|---|
| `server.js` | `a9260004c8132404d0bc1dd58c8da89a1b915d8a21fc99b9ae7e9eb6199673e6` |
| `app.js` | `6d13b444eb0b16082df366b1900773e9fa33d735577be2fb8d6510f9e0943860` |
| `scripts/benchmark-article-catalog.js` | `797762d839a0331e53029df049a3fac03c005e38e1810fa885b725a06d971cb9` |
| `tests/article-catalog.test.js` | `428dabf11a95bb328268c837c26c150d9d9a3b220ad05103601dc262a13ff2ad` |

Gate PERFORMANCE final Catalogue articles SAGE : **APPROVED sur cette empreinte**, avec P2 de scalabilité UI et P3 navigateur explicités. Toute modification ultérieure de ces quatre fichiers impose une nouvelle analyse d’impact. Fichier modifié : `docs/performance-report.md` uniquement ; consolidation de `docs/project-status.md` laissée à l’intégrateur.

---

## Re-PERFORMANCE différentielle — synchronisation du shell Articles SAGE — 2026-08-26

Empreinte applicative corrigée : `app.js` SHA-256 `4e827ab58f77d412fe62740956a12cfe032b448c911cd52593e103192657d8c5`.

Reviewer : agent indépendant `article_performance`.

### Verdict

**APPROVED — 0 P0, 0 P1, 0 nouveau P2, limites P2/P3 antérieures maintenues.**

Le correctif ajoute uniquement `syncAuthenticatedSurfaces(true)` au chemin direct du wrapper `render` lorsque la route est `#articles` et qu’une session existe. Il restaure la visibilité du shell avant le rendu du catalogue, sans requête, boucle dépendante des données, création de nœud, listener, timer ni recalcul du catalogue.

### Analyse d’impact exacte

Sur l’argument constant `true`, `syncAuthenticatedSurfaces` :

- récupère `#appShell`, affecte `hidden=false`, `aria-hidden="false"` et `inert=false` ;
- parcourt une liste fixe de trois overlays (`modalBackdrop`, `commandPalette`, `stockDrawerBackdrop`) et affecte seulement `inert=false` ;
- n’exécute pas les branches `overlay.hidden=true` ni `app.replaceChildren()`, réservées à l’état non authentifié ;
- ne contient aucun appel à `api`, `apiAll`, `fetch`, `EventSource`, `render`, `articleCatalogPage` ou `loadArticleCatalog`.

Le coût est donc O(1) : quatre `getElementById`, trois propriétés sur le shell et trois propriétés sur les overlays. L’appel s’exécute une fois par rendu de la route Articles, y compris recherche et pagination, mais reste indépendant des 71 articles métier, des 100 lignes DOM affichées et du cas de stress 10 071 articles. Les écritures `hidden`/`inert` peuvent invalider un style, sans lecture géométrique synchrone ni boucle susceptible de provoquer du layout thrashing.

`server.js` et `scripts/benchmark-article-catalog.js` restent bit-identiques à l’empreinte du gate précédent. Les mesures serveur approuvées restent donc applicables : lecture p95 `39,33 ms` (`< 300 ms`) et écriture p95 `70,22 ms` (`< 250 ms`) sur 10 071 articles.

### Preuves proportionnées

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| inspection statique du wrapper `#articles` et de `syncAuthenticatedSurfaces` | appel constant, aucune requête/loop data/rendu lourd supplémentaire |
| `node --test tests/article-catalog.test.js` | **PASS, 5/5**, durée `524,24 ms` |
| contrat de non-régression ciblé | présence de `syncAuthenticatedSurfaces(true)` sur le chemin direct Articles vérifiée |
| `git diff --check -- app.js docs/performance-report.md` avant rapport | **PASS** |

Empreintes : `server.js` `a9260004c8132404d0bc1dd58c8da89a1b915d8a21fc99b9ae7e9eb6199673e6`; benchmark `797762d839a0331e53029df049a3fac03c005e38e1810fa885b725a06d971cb9`; test Catalogue après correctif `b0438e085c278b890b4514f8a445c8d6985c89514dfe3c5f251853e8d966b4b7`.

### Limites maintenues

- **P2 hérité :** `apiAll` reste séquentiel à forte volumétrie et le calcul des codes SAGE partagés reste O(N²). Ce correctif ne touche ni ces fonctions ni leur coût.
- **P3 hérité :** aucune trace navigateur de layout/paint ou temps interactif `< 2 s` n’est ajoutée. Le correctif est constant et ne change pas la nécessité du smoke E2E navigateur sur 71 articles.

Gate PERFORMANCE différentiel du correctif E2E : **APPROVED sur l’empreinte `app.js` `4e827ab…`**. Fichier modifié : `docs/performance-report.md` uniquement ; mise à jour de `docs/project-status.md` laissée à l’intégrateur.
