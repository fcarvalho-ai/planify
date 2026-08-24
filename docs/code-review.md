# Re-REVIEW terminale post-RC5 — recalcul responsive et contrat Client

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat exact : `e39b9b0e2eecf7a0c9abeb0f20ec27650778b09f` (`fix: recalculer le planning et documenter la couleur client`)

Correctif contrôlé : `ea7863c20b5f148ddbd63f13afcdf211b0f008b1..e39b9b0e2eecf7a0c9abeb0f20ec27650778b09f`

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert.**

Les deux constats bloquants `REV-POST-RC5-01` et `REV-POST-RC5-02` sont fermés. La compensation de scrollbar suit désormais les changements de géométrie responsive avec un observateur unique et nettoyé, et l'API documente les lectures/mutations Client ainsi que la commande de mise à jour incluant `version` et `color`. La validation serveur rejette également les suffixes ajoutés à une couleur pourtant préfixée par un hexadécimal valide.

## Fermeture de REV-POST-RC5-01 — géométrie responsive

- `planningScrollbarResizeObserver` possède une seule référence globale. Chaque passage dans `bind()` déconnecte explicitement l'instance précédente avant toute nouvelle observation, y compris lorsque la route suivante ne contient plus de planning.
- `syncPlanningScrollbarSize()` mesure la géométrie native `offsetHeight - clientHeight` et met à jour la variable du shell après le rendu initial.
- Le `ResizeObserver` observe la timeline, dont la boîte de contenu varie quand une scrollbar horizontale apparaît ou disparaît, ainsi que le shell qui porte la géométrie responsive. Le même callback recalcule donc la compensation sans recréer la grille.
- L'écriture de la variable ne modifie que la hauteur de la colonne fixe ; elle ne redimensionne ni la timeline ni le shell observés et ne crée pas de boucle de notifications.
- La synchronisation `scrollTop`, la restauration des deux axes et la fenêtre virtuelle continuent de lire la timeline comme autorité. Aucun nouveau handler de scroll ni rerendu coûteux n'est ajouté.
- En environnement sans `ResizeObserver`, le calcul initial reste appliqué et le garde empêche toute erreur d'exécution ; les navigateurs cibles modernes bénéficient du recalcul responsive.

## Fermeture de REV-POST-RC5-02 — contrat Client et validation couleur

- OpenAPI expose maintenant `GET /clients/{clientId}` et `PATCH /clients/{clientId}` avec paramètre de chemin, clé d'idempotence pour la mutation, réponses stables `200/403/404/409/422` et `ClientUpdateCommand`.
- `ClientUpdateCommand` exige `version`, refuse les propriétés inconnues et documente `color` avec le motif ancré `^#[0-9A-Fa-f]{6}$`; les autres propriétés modifiables correspondent aux champs acceptés par `clientInput`.
- Le serveur retire `color` avant la validation commune, puis valide séparément la valeur complète après normalisation de casse. L'expression régulière ancrée refuse aussi bien une déclaration CSS qu'un suffixe après six chiffres hexadécimaux.
- Les valeurs invalides n'altèrent pas la couleur persistée. Les mutations valides restent couvertes par le contrôle optimiste, l'isolation tenant, l'audit, l'idempotence et le SSE existants.
- Le consommateur UI continue d'utiliser la réponse Client, de résoudre réservation → projet → client et de conserver le nom du client dans le libellé accessible ; la couleur n'est pas l'unique porteur d'un statut.

## Observations non bloquantes

- **P2 — couverture de géométrie principalement structurelle :** le test Planning vérifie la création, l'observation et la déconnexion du `ResizeObserver`, mais pas une transition DOM réelle avec apparition/disparition de scrollbar. La logique inspectée ferme le défaut ; une future infrastructure navigateur pourrait pérenniser le scénario visuel complet.
- **P2 — schémas de réponse Client génériques :** les réponses des nouveaux chemins utilisent encore `type: object`, comme la création Client existante, au lieu d'un DTO Client réutilisable explicitant notamment `color`, `contacts` et `rateCards`. La commande de mutation et les statuts HTTP sont désormais contractés, mais un schéma de sortie typé améliorerait les consommateurs générés.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` → `e39b9b0e2eecf7a0c9abeb0f20ec27650778b09f`.
- Inspection ciblée du diff, du cycle `bind()`/`render()`, des handlers de scroll/virtualisation, des routes Client, de `clientInput` et du contrat OpenAPI → **conforme**.
- `node --test tests/clients.test.js` → **PASS, 11/11**, 0 échec/cancelled/skip/todo, 558,615 ms.
- `node --test tests/planning-postproduction.test.js` → **PASS, 46/46**, 0 échec/cancelled/skip/todo, 132,685 ms.
- `npm test` → **PASS, 345/345**, 0 échec/cancelled/skip/todo, 10,194 s.
- `npm run lint` → **PASS**.
- `npm run build` → **PASS**, 5 actifs runtime vérifiés.
- `git diff --check ea7863c20b5f148ddbd63f13afcdf211b0f008b1..e39b9b0e2eecf7a0c9abeb0f20ec27650778b09f` → **PASS**.
- Test négatif frais : `red; background:url(x)` et `#123456;background:red` retournent tous deux `422`; la valeur persistée demeure `#2A7F62`.

Empreintes SHA-256 contrôlées :

- `app.js` : `335de7ef6c0d039a8d692206b0d9e8f8c60e53681d9e529385ca90b8a91a72a3`
- `server.js` : `5961d3d6cd53f382b7977d284c6523d146134b7cc47bbf117031fe6f5ee1f367`
- `planning.css` : `b9cd0dda4f2b75b815b502aa5d07b6eb4cf73c331123a204d7daf8bd2b8de284`
- `docs/api/openapi-v1.yaml` : `1f51be70a4411c88d5b8bb61fb3f903e8189f20de0cf5812b823e43f6b2428f4`
- `tests/clients.test.js` : `f73c4681226f1aa1b096ff0ad066d2abe3093e1a5baf82cf80cf44d65c7c2814`
- `tests/planning-postproduction.test.js` : `ba73ce42df8468de4d6742448bd33f23fbebe527686c158870304a34766be363`

## Sortie de gate

- Le gate REVIEW est **APPROVED** pour le candidat exact ci-dessus.
- Aucun code, test, rapport QA/Sécurité/Performance ni `docs/project-status.md` n'a été modifié par cette relecture.
- L'intégrateur reste responsable de figer tous les gates sur le même hash candidat.

---

# Gate REVIEW indépendant post-RC5 — scroll vertical et couleur Client

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat exact : `ea7863c20b5f148ddbd63f13afcdf211b0f008b1` (`fix: stabiliser le scroll vertical et colorer les clients`)

Base comparée : `d9f32cc` / tag `v0.5.0-rc5`

## Verdict

**REJECTED — 0 P0, 2 P1 ouverts.**

Les validations serveur, la persistance et l'usage visuel de la couleur Client sont cohérents, et la géométrie du planning est correcte au moment du rendu. Le candidat ne peut toutefois pas être approuvé : la compensation de scrollbar n'est pas recalculée lors d'un redimensionnement responsive sans nouveau rendu, et le contrat OpenAPI ne documente pas la mutation de couleur réellement consommée par l'interface.

## Constats bloquants

### REV-POST-RC5-01 — P1 — La géométrie de la colonne fixe redevient désynchronisée après un changement responsive

- `app.js` mesure `timeline.offsetHeight - timeline.clientHeight` une seule fois dans `bind()` et écrit `--planning-scrollbar-size`.
- Aucun `ResizeObserver`, gestionnaire `window.resize` ou mécanisme équivalent ne recalcule cette valeur lorsque la géométrie native du conteneur change sans nouveau rendu applicatif.
- Cas limite concret : la vue Jour peut ne pas avoir de scrollbar horizontale sur une largeur bureau, puis en acquérir une après réduction de la fenêtre. La hauteur cliente de la timeline diminue alors de l'épaisseur de la scrollbar, tandis que `.planning-fixed-column` conserve la valeur CSS calculée avant le redimensionnement. Les dernières lignes des deux axes ne sont plus alignées.
- La synchronisation bidirectionnelle de `scrollTop` et la virtualisation utilisent correctement la timeline, mais ne mettent pas à jour cette variable géométrique ; elles ne ferment donc pas ce cas responsive.
- Le test ajouté ne vérifie que la présence lexicale du setter et de la formule CSS. Il ne simule ni changement de `offsetHeight/clientHeight`, ni apparition/disparition de scrollbar.

Correction attendue : observer la taille effective de la timeline/matrice (avec nettoyage à chaque rerendu), ou utiliser une composition CSS qui réserve intrinsèquement la gouttière ; ajouter une preuve reproduisant l'apparition puis la disparition de la scrollbar horizontale et vérifiant l'alignement final.

### REV-POST-RC5-02 — P1 — Le contrat OpenAPI ne décrit pas l'édition de la couleur Client utilisée par l'UI

- Le serveur accepte et persiste `color` à la création **et** lors du `PATCH` Client ; l'éditeur UI expose le champ et envoie la mutation par ce chemin.
- `docs/api/openapi-v1.yaml` ajoute uniquement `color` à `ClientCreateCommand`. Aucun chemin `/clients/{clientId}` ni schéma de mise à jour Client ne décrit la mutation, son contrôle de version ou sa réponse.
- Le consommateur navigateur dépend donc d'un comportement mutable absent du contrat public. Une implémentation ou validation générée depuis l'OpenAPI ne peut pas reproduire l'édition affichée par Planify.
- Les tests API couvrent la création, la persistance et le rejet d'une couleur invalide, mais pas la conformité documentée du `PATCH` couleur et de sa réponse.

Correction attendue : documenter le chemin de mise à jour Client, sa commande incluant `version` et `color`, ses réponses/erreurs stables et la couleur dans le DTO retourné ; ajouter une preuve de contrat couvrant la modification valide et le rejet invalide.

## Points conformes vérifiés

- La validation serveur impose strictement `#RRGGBB`, normalise en majuscules et fournit `#6C5CE7` aux anciennes données sans couleur ; une valeur CSS injectée est rejetée.
- La couleur traverse les mutations atomiques existantes avec contrôle de version, isolation, audit et émission SSE après succès. La liste Client retournée à l'UI conserve la propriété.
- L'interface met à jour son état Client après sauvegarde, puis résout réservation → projet → client pour appliquer le liseré. Le nom du client est aussi ajouté au libellé accessible : la couleur reste une information complémentaire, et les statuts ne reposent pas sur elle seule.
- À géométrie inchangée après rendu, la variable mesurée aligne la hauteur de la colonne fixe sur `clientHeight`; la synchronisation verticale bidirectionnelle, la fenêtre virtualisée et le défilement horizontal existants restent intacts dans les suites automatisées.
- Aucun secret, actif distant, dépendance ou migration de données n'est introduit par le diff examiné.

## Preuves fraîches

Environnement : macOS, Node.js conforme au projet, état `HEAD` exact et worktree propre avant rédaction du présent rapport.

- `git rev-parse HEAD` → `ea7863c20b5f148ddbd63f13afcdf211b0f008b1`.
- `node --test tests/clients.test.js` → **PASS, 11/11**, 0 échec/skip/todo, 887,790 ms.
- `node --test tests/planning-postproduction.test.js` → **PASS, 46/46**, 0 échec/skip/todo, 145,500 ms.
- `npm test` → **PASS, 345/345**, 0 échec/cancelled/skip/todo, 8,402 s.
- `npm run lint` → **PASS**.
- `npm run build` → **PASS**, 5 actifs runtime validés.
- `git diff --check d9f32cc..ea7863c20b5f148ddbd63f13afcdf211b0f008b1` → **PASS**.
- Recherche ciblée dans `app.js` → aucun `ResizeObserver`, `window.resize` ou `onresize` assurant la réévaluation responsive.
- Recherche ciblée dans `docs/api/openapi-v1.yaml` → `color` présent dans `ClientCreateCommand`, aucun chemin `/clients/{clientId}` ni schéma `ClientPatch`/`ClientUpdate`.
- Empreintes SHA-256 examinées : `app.js` `1beae9dda81bab93b6079112727da792cbe6d39cffe580444309f8fb7ec71de8`; `server.js` `71be96cacba53ac5eff416fb5156ce166cacd28d1454faa561fb7197d2fbea60`; `planning.css` `b9cd0dda4f2b75b815b502aa5d07b6eb4cf73c331123a204d7daf8bd2b8de284`; OpenAPI `195c7afd049eb1cfe7373202b1b77494a6eaed0edf2da8d1aafdf34795b6d152`.

## Limites et sortie de gate

- Les tests ciblés et complets sont verts, mais ils ne reproduisent pas la transition responsive de géométrie ni la conformité contractuelle du `PATCH` Client.
- Conformément à l'ownership demandé, aucun code, test ni `docs/project-status.md` n'a été modifié.
- Le gate REVIEW devra être rejoué sur le commit correctif exact ; les gates aval déjà rendus ne couvrent pas ce futur état.

---

# Re-REVIEW finale RC5 — arrondi unique `occupancyGap`

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat exact : `4e094d589ae215f31152110d30f1163929ca1338` (`fix: round occupancy gap after aggregation`)

Correctif contrôlé : `ace4048f20e3524b003c49df0f1ee42d01551ee8..4e094d589ae215f31152110d30f1163929ca1338`

Nature : revue indépendante seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert.**

`REV-RC5-01` est fermé. Le KPI `occupancyGap` et son drill-down utilisent le même sous-ensemble de périodes disposant d'un réalisé, la carte additionne désormais directement les écarts journaliers `actualOccupancyBps - plannedOccupancyBps`, puis applique un unique `Math.round` après division. La valeur de carte est donc exactement la moyenne arrondie des lignes du détail.

## Exactitude et consommateurs

- Sans période réalisée, `actualItems` est vide et `occupancyGapBps` reste `null`, conformément à l'état indisponible historique.
- Avec une seule période réalisée parmi deux périodes planifiées 1 h/8 h, la période sans réalisé est exclue des deux surfaces et carte/détail valent `0 bps`.
- Avec deux périodes réalisées, planifiées 1 h puis 3 h et réalisées 1 h puis 1 h, les lignes sont `[0, -833]` et l'arrondi unique donne `-416 bps` sur la carte comme dans le détail.
- `sourceCount` reste `actualItems.length`, donc nombre, ensemble et valeur sont alignés.
- La définition affichée décrit maintenant explicitement une « moyenne des écarts » sur les périodes disposant d'un réalisé ; `pilotageValue()` conserve la conversion bps en pourcentage français sans recalcul métier.
- `actualOccupancy` continue d'exposer sa propre moyenne et `plannedOccupancy` continue de couvrir toutes les périodes planifiées : le correctif ne modifie pas leurs contrats.
- Aucun changement d'API, permission, scope, pagination, Forecast ou Planning n'est introduit par ce lot minimal.

## Couverture de non-régression

Le test pérenne couvre désormais les deux défauts successifs : exclusion d'une période sans réalisé et divergence d'un point de base due au double arrondi. Il compare `sourceCount`, `total`, les valeurs exactes des lignes, leur moyenne arrondie et la carte (`0`, puis `-416`). Le cas aurait échoué sur les deux candidats précédents.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` : `4e094d589ae215f31152110d30f1163929ca1338`.
- Inspection du diff, de `dashboardReadModel()`, `dashboardDrilldownReadModel()` et du consommateur Pilotage : **conforme**.
- `node --test tests/sprint8-dashboards.test.js` : **PASS, 14/14**, 0 échec/skip/todo, durée `2,476 s`.
- `node --test tests/planning-postproduction.test.js` : **PASS, 46/46**, 0 échec/skip/todo, durée `210,913 ms`.
- `npm test` : **PASS, 345/345**, 0 échec/cancelled/skip/todo, durée `9,261 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check ace4048f20e3524b003c49df0f1ee42d01551ee8..4e094d589ae215f31152110d30f1163929ca1338` : **PASS**.

Empreintes contrôlées :

```text
server.js                        2f850f7f2e797b3228524b9e94d0566004e951f28126d9141b51cc0e6918aa20
tests/sprint8-dashboards.test.js 22fce8f6b77ea70572c9fd6bef0d87e4fce552f07d97c712761e6861a4cbc6ab
app.js                           0fc0dad429e78aa6aea63884f6d903939189e2793b6505b3d363d7e49cbc36cd
planning.css                     1e5227f04bb781756318676054242713664e07dee048dee4e664198dd3ed289b
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW RC5 ciblé est **APPROVED** sur `4e094d589ae215f31152110d30f1163929ca1338` : 0 P0, 0 P1. L'intégrateur reste responsable de la mise à jour du statut et des gates aval impactés sur ce même hash.

---

# Re-REVIEW RC5 ciblée — réconciliation `occupancyGap`

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat exact : `ace4048f20e3524b003c49df0f1ee42d01551ee8` (`fix: reconcile occupancy gap with its detail`)

Correctif contrôlé : `b715f4ba1453ed9a73db3fd2f32e996957a700d2..ace4048f20e3524b003c49df0f1ee42d01551ee8`

Nature : revue indépendante seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**REJECTED — 0 P0, 1 P1 ouvert.**

Le P1 initial est fortement réduit : la carte et le drill-down utilisent désormais le même sous-ensemble `actualItems`, et le scénario demandé « 1 h / 8 h, une seule période réalisée » restitue bien `0 bps` des deux côtés. La réconciliation n'est cependant pas exacte pour plusieurs périodes réalisées, car la carte arrondit séparément les deux moyennes avant soustraction, tandis que le détail expose les écarts ligne par ligne.

## P1 — double arrondi résiduel entre la carte et le drill-down

Le candidat calcule :

```text
carte = round(moyenne(actualOccupancyBps))
      - round(moyenne(plannedOccupancyBps))
```

Le drill-down expose chaque `actualOccupancyBps - plannedOccupancyBps`; sa réconciliation naturelle est donc :

```text
round(moyenne(actualOccupancyBps - plannedOccupancyBps))
```

Ces deux expressions peuvent différer d'un point de base. Sonde fraîche avec deux périodes toutes deux réalisées : planifié `1 h` puis `3 h`, réel `1 h` puis `1 h`. Les taux journaliers sont planifiés `[417, 1250]` et réels `[417, 417]` :

```text
carte occupancyGap       = -417 bps
sourceCount carte        = 2
total drill-down         = 2
valeurs drill-down       = [0, -833] bps
moyenne arrondie détail  = -416 bps
```

Le compteur et le sous-ensemble sont identiques, mais la valeur reste non reconstructible exactement depuis ses lignes, contrairement au contrat Sprint 8. La correction minimale est de calculer directement la moyenne des écarts sur `actualItems` puis d'arrondir une seule fois. Le test doit inclure au moins deux périodes réalisées provoquant des moyennes demi-entières ; le test ajouté avec une seule ligne ne peut pas détecter ce défaut.

## Contrôles conformes

- `actualItems` est désormais la source commune de `actualBps`, de la composante planifiée du KPI, de `sourceCount` et des lignes du drill-down.
- Les périodes sans réalisé restent exclues du détail et n'ajoutent plus de fausse valeur `null`.
- La définition utilisateur a été précisée : « sur les périodes disposant d'un réalisé ».
- Le KPI `plannedOccupancy` conserve volontairement sa moyenne sur toutes les périodes ; les autres dashboards, permissions, filtres et consommateurs UI ne sont pas modifiés.
- Le scénario de non-régression imposé, avec une seule période réalisée parmi deux périodes planifiées 1 h/8 h, est présent et vert.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` : `ace4048f20e3524b003c49df0f1ee42d01551ee8`.
- Sonde imposée 1 h/8 h avec une seule période réalisée : **PASS**, carte = détail = `0 bps`.
- Sonde multi-périodes réalisées 1 h/3 h planifiées et 1 h/1 h réelles : **ÉCHEC**, carte `-417 bps`, détail moyen `-416 bps`.
- `node --test tests/sprint8-dashboards.test.js` : **PASS, 14/14**, 0 échec/skip/todo, durée `2,586 s`.
- `node --test tests/planning-postproduction.test.js` : **PASS, 46/46**, 0 échec/skip/todo, durée `160,890 ms`.
- `npm test` : **PASS, 345/345**, 0 échec/cancelled/skip/todo, durée `8,743 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check b715f4ba1453ed9a73db3fd2f32e996957a700d2..ace4048f20e3524b003c49df0f1ee42d01551ee8` : **PASS**.

Empreintes contrôlées :

```text
server.js                       59fd6560e67a399887e49d4ec9495573c658285d48b7959c1da2406f62249a8f
tests/sprint8-dashboards.test.js c376b650d59ce736b29ab2f20f2abea9494c09340470facba09afd900298a723
app.js                          0fc0dad429e78aa6aea63884f6d903939189e2793b6505b3d363d7e49cbc36cd
planning.css                    1e5227f04bb781756318676054242713664e07dee048dee4e664198dd3ed289b
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le candidat `ace4048f20e3524b003c49df0f1ee42d01551ee8` est **REJECTED** avec 0 P0 et 1 P1 résiduel. Retour DEV minimal requis pour moyenner les écarts avant arrondi, ajouter le cas à deux périodes réalisées, puis relancer la re-REVIEW et les gates aval impactés.

---

# Impact re-REVIEW — filtrage des créneaux demi-journée

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `2fd37e212d19ecc507cfe12f077474f716ec0edd` (`fix(planning): preserve half-day overlap filtering`)

Correctif contrôlé : `75a85cfdb3236ee1dcc63652d8a73fa578693ea5..2fd37e212d19ecc507cfe12f077474f716ec0edd`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert ; 1 P2 non bloquant hérité.**

Le correctif ferme l'écart QA demi-journée sans réouvrir `PERF-G8-09`. Après sélection sémantique AM/PM par l'heure de début, le candidat n'est indexé que si `planningSlotContainsBooking()` confirme un chevauchement réel. Les réservations `06:00–08:00` et `19:00–20:00`, extérieures aux colonnes affichées `09:00–13:00` et `13:00–18:00`, ne produisent donc plus de carte fantôme.

## Équivalence et cas limites

- L'ancien rendu appliquait d'abord le chevauchement avec le slot puis conservait uniquement l'index AM/PM correspondant à l'heure de début. Le nouveau code choisit ce même index puis applique le même prédicat de chevauchement : pour les deux slots complets de la vue demi-journée, les ensembles produits sont équivalents.
- Une preuve exhaustive par pas de 30 minutes a comparé les deux formulations pour les `1 176` intervalles positifs possibles sur une journée : aucune divergence.
- Les bornes sont semi-ouvertes comme auparavant : une fin à `09:00` n'entre pas dans AM, un début à `13:00` entre dans PM, une fin à `13:00` reste dans AM et un début à `18:00` n'entre pas dans PM.
- Les périodes traversant 13 h restent attribuées à leur colonne de départ, conformément au comportement historique et au span visuel ; elles ne sont pas dupliquées dans les deux colonnes.
- L'index heure est inchangé et continue de retenir exactement le slot contenant l'instant de début. Le chemin non temporisé est inchangé et conserve l'ordre des réservations.
- Les exceptions quotidiennes et déplacements continuent de passer par `bookingRenderedCells()` avant l'indexation ; les clés cible restent donc exactes.

## Performance, densité et accessibilité

- La modification ajoute un contrôle constant sur le seul candidat demi-journée. Elle ne réintroduit ni scan des réservations par case ni construction DOM avant la borne.
- `planningCellEntriesBySlot()` conserve sa passe unique sur réservations/cellules visibles et la matrice conserve sa lecture `Map.get()` par cellule.
- Le cap de rendu à 50, le compteur exact du surplus, le résumé `role="status"`, les opérations sur les cartes visibles et les données complètes restent inchangés.
- Les correctifs antérieurs de pile Projet, confinement temporisé, hauteurs virtuelles, scroll sur les deux axes et couches sticky ne sont pas touchés.

## P2 — limite non bloquante héritée

1. La suite pérenne couvre désormais directement les deux cas négatifs demi-journée, mais elle ne contient toujours pas une table exhaustive heure/demi-journée, une exception déplacée et 51 cartes. La preuve exhaustive et les assertions multi-granularité ont été rejouées pendant cette revue ; leur pérennisation reste souhaitable sans bloquer ce correctif minimal.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` et `git rev-parse 2fd37e212d19ecc507cfe12f077474f716ec0edd` : `2fd37e212d19ecc507cfe12f077474f716ec0edd`.
- Inspection du diff et comparaison avec le pipeline historique `planningSlotContainsBooking → index AM/PM` : **conforme**.
- Assertion exhaustive demi-journée par pas de 30 minutes : **PASS, 1 176/1 176** ; assertion heure sur fenêtre virtuelle : **PASS, 1 entrée unique au créneau 09:00**.
- `node --test tests/planning-postproduction.test.js` : **PASS, 44/44**, 0 échec/skip/todo, durée `133,332 ms`.
- `npm test` : **PASS, 341/341**, 0 échec/cancelled/skip/todo, durée `8,306 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `node --check app.js` : **PASS**.
- `git diff --check 75a85cfdb3236ee1dcc63652d8a73fa578693ea5..2fd37e212d19ecc507cfe12f077474f716ec0edd` : **PASS**.

Empreintes contrôlées :

```text
app.js                                 d38593864538040fa829aa3ee24fd649199cb3f2b1ba5a81c683c12dd741c1f5
planning.css                           c7904c3cfab77078997ba5efb7c9c34e24d17db2fc2abb8773351985881bfdb1
tests/planning-postproduction.test.js  4cc26cb0461e93fba23ce88b62fb527403bf7220455d44a1c33e7c712dd4a3cf
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW d'impact est **APPROVED** sur `2fd37e212d19ecc507cfe12f077474f716ec0edd` : 0 P0, 0 P1, 1 P2 non bloquant hérité. L'intégrateur reste responsable du statut et des gates aval sur ce même candidat.

---

# Re-REVIEW terminalissime — index pré-DOM du Planning

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `75a85cfdb3236ee1dcc63652d8a73fa578693ea5` (`perf(planning): index visible booking cells`)

Correctif contrôlé : `9543ecc38be2e504ba6dcfeb0779692391064a88..75a85cfdb3236ee1dcc63652d8a73fa578693ea5`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert ; 1 P2 non bloquant.**

`PERF-G8-09` est désormais fermé aussi avant construction du DOM. `planningCellEntriesBySlot()` parcourt une fois les réservations et leurs cellules rendues, écarte immédiatement les ressources et dates hors fenêtre virtuelle, puis indexe les entrées par `resourceId|slot.key`. La matrice effectue ensuite une lecture `Map.get()` par cellule visible : l'ancien `bookings.flatMap(...bookingRenderedCells...)` répété pour chaque case n'existe plus.

## Exactitude de l'index

- Hors vue temporisée, chaque date possède un seul slot et la clé `ressource|date` restitue les mêmes cellules, dans le même ordre réservation/cellule que l'ancien `flatMap`.
- En vue heure, la cellule est affectée au créneau contenant son instant de début, comme le filtre final historique. Une fenêtre horizontale ne reçoit que les cellules dont le créneau de départ est visible ; le span CSS continue de représenter la durée sans dupliquer la réservation dans les demi-heures suivantes.
- En demi-journée, le seuil historique de 13 h (`780` minutes) est conservé. Cette vue ne possède que deux colonnes et l'overscan de cinq colonnes les maintient ensemble dans la fenêtre virtuelle ; les index AM/PM restent donc stables.
- `bookingRenderedCells()` reste l'unique source des cellules quotidiennes et des exceptions : une cellule déplacée est indexée sur sa `targetDate` et sa `targetResourceId`, tout en conservant `sourceDate/sourceResourceId` pour les opérations.
- Le filtre `roomIds` limite le travail aux lignes virtuelles visibles ; `slotsByDate` limite les cellules aux dates/créneaux de la fenêtre horizontale. Le déplacement vertical ou horizontal reconstruit l'index avec la nouvelle fenêtre, sans perte dans `state.bookings`.
- Les doublons métier éventuels ne sont ni fusionnés ni réordonnés : chaque couple `{ booking, cell }` est ajouté à la liste de sa clé.

## Densité, accessibilité et anciens P1

- La borne `PLANNING_CELL_RENDER_LIMIT=50`, `visibleCells`, `hiddenCellCount` et le résumé `role="status"` restent calculés après la lecture de la liste complète de la case. Le compteur et le nom accessible annoncent donc le surplus exact, tandis que les données demeurent intactes.
- Les 50 cartes visibles suivent toujours `event()` et conservent focus, sélection, déplacement, redimensionnement et opérations commerciales selon les permissions.
- Le cap de profondeur à trois et `planningMaxCellStack()` sont inchangés ; les lignes Projet gardent leurs hauteurs bornées de 58 px par carte et leur débordement local.
- Les piles temporisées restent confinées à la largeur du créneau avec scroll vertical local ; une réservation isolée conserve son span normal.
- Les correctifs sticky (jour `z-index:10`, colonne fixe `11`, coin réel `12`), la lecture dynamique de `data-row-height/data-column-width`, la propagation `compact` et la virtualisation sur les deux axes ne sont pas réouverts.

## P2 — limite de couverture non bloquante

1. Le test ajouté couvre directement l'ordre et la clé non temporisés, puis vérifie lexicalement l'emploi de la `Map` et l'absence de l'ancien `flatMap` par case. Il ne fige pas encore automatiquement les variantes heure, demi-journée, exception quotidienne, fenêtre horizontale partielle et scénario de 51 cartes. Ces variantes ont été exercées fraîchement par assertion Node pendant la revue, mais gagneraient à rejoindre la suite pérenne.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` : `75a85cfdb3236ee1dcc63652d8a73fa578693ea5`.
- Inspection du diff, de `planningMatrix()`, `planningTimelineSlots()`, `planningCellInterval()`, `bookingRenderedCells()`, `planningMaxCellStack()` et des consommateurs d'opérations : **conforme**.
- Assertion Node dédiée non temporisé/heure/demi-journée/override/fenêtre : **PASS** ; clés observées `r1|2026-08-17-am`, `r1|2026-08-17-pm`, `r1|2026-08-17T09:00@2026-08-17T07:00:00.000Z`, `r2|2026-08-18`.
- `node --test tests/planning-postproduction.test.js` : **PASS, 44/44**, 0 échec/skip/todo, durée `167,645 ms`.
- `npm test` : **PASS, 341/341**, 0 échec/cancelled/skip/todo, durée `8,248 s` (relance hors sandbox requise uniquement parce que les tests ouvrent des ports loopback éphémères).
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check 9543ecc38be2e504ba6dcfeb0779692391064a88..75a85cfdb3236ee1dcc63652d8a73fa578693ea5` : **PASS**.
- Limite : aucun benchmark navigateur ou lecteur d'écran frais n'est revendiqué dans cette re-review de code.

Empreintes contrôlées :

```text
app.js                                 98f9740d54dbc2c460c77cc40958f27663c220f8df5043a445f5ea313a23f3df
planning.css                           c7904c3cfab77078997ba5efb7c9c34e24d17db2fc2abb8773351985881bfdb1
tests/planning-postproduction.test.js  6e7e9197bf8f26ff6a38f614a4ae6dd80e34e543551e4642ba700ff78654fd66
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW du correctif pré-DOM Planning est **APPROVED** sur `75a85cfdb3236ee1dcc63652d8a73fa578693ea5` : 0 P0, 0 P1, 1 P2 non bloquant. L'intégrateur reste responsable de la mise à jour de statut et des gates aval sur ce même candidat.

---

# Re-REVIEW ultime — rendu borné des cellules Planning denses

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `9543ecc38be2e504ba6dcfeb0779692391064a88` (`fix(planning): bound dense cell rendering`)

Correctif contrôlé : `b95493cffd9a6d23b5b7a9bf4614170696189445..9543ecc38be2e504ba6dcfeb0779692391064a88`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert ; 2 P2 non bloquants.**

Le constat performance `PERF-G8-09` est fermé au niveau du DOM : chaque cellule rend au plus 50 cartes, dans l'ordre déjà produit par le filtre métier. Les réservations excédentaires restent présentes dans `state.bookings` et dans les calculs de densité ; seul leur HTML est différé. Le surplus est annoncé visuellement, dans le nom accessible de la cellule et par un statut demandant d'affiner les filtres.

## Borne, ordre et intégrité des données

- `PLANNING_CELL_RENDER_LIMIT` est une constante locale fixée à `50`.
- `visibleCells=cells.slice(0,PLANNING_CELL_RENDER_LIMIT)` préserve exactement l'ordre de `cells` et ne trie, ne mute ni ne retire aucune réservation de la source.
- `hiddenCellCount=cells.length-visibleCells.length` est calculé sur la collection complète après les mêmes règles salle/date/créneau que le rendu historique.
- `stacked` dépend toujours de `cells.length`, pas de la tranche ; la hauteur, le compactage et le confinement restent donc fondés sur la densité réelle.
- `planningMaxCellStack()` s'exécute avant le rendu borné et continue de voir toutes les réservations, avec son cap de profondeur à trois. Les données persistées, l'API et les mutations restent intactes.

## Accessibilité du surplus

- Le résumé visible indique `+ N autre(s) · affinez les filtres` et porte `role="status"`; il n'est pas codé uniquement par couleur.
- Le `aria-label` de la cellule ajoute `N réservations supplémentaires non affichées`, ce qui expose l'information même si le statut sticky n'est pas parcouru séparément.
- Le texte explique l'action disponible : affiner les filtres Projet, salle, métier ou statut pour ramener les cartes masquées dans la tranche rendue.
- La carte de résumé est sticky en bas du scroller local, avec fond et bordure explicites, et ne remplace aucune carte visible.

## Opérations sur les cartes visibles

- Les 50 cartes visibles passent toujours par la chaîne complète `event()` : libellé accessible, sélection commerciale, focus, déplacement et poignées de redimensionnement selon permissions/statut.
- Les bindings DOM parcourent uniquement les éléments rendus ; aucune opération ne peut cibler accidentellement une carte masquée depuis un identifiant absent du DOM.
- Les opérations de groupe basées sur les filtres ou l'état restent inchangées. Une carte masquée redevient opérable dès qu'un filtre la place dans les 50 premières de sa cellule.
- La tranche ne duplique pas d'identifiant et conserve l'association réservation/cellule source utilisée par copier-coller, déplacement et redimensionnement.

## Vues temporisées et non temporisées

- Hors grille temporisée, la cellule conserve son scroll vertical local, ses cartes compactes de 58 px, le cap de piste à trois et désormais le résumé après la 50e carte.
- En heure et demi-journée, les 50 wrappers restent confinés à la largeur du créneau source et la cellule empilée conserve `overflow-y:auto`; le résumé fait partie du même flux vertical local.
- Une réservation temporisée isolée n'est ni compactée ni tranchée et conserve son span de durée historique.
- Les anciens P1 de hauteur dynamique, propagation des wrappers, cap de pile, sticky headers et confinement temporisé ne sont pas réouverts.

## P2 — limites non bloquantes

1. La borne porte sur les nœuds rendus, pas sur la construction de `cells` : le code continue de parcourir toutes les réservations et d'appeler `bookingRenderedCells()` avant `slice(0,50)`. C'est cohérent avec l'exigence d'un compteur exact, mais une indexation salle/date/créneau serait nécessaire si le calcul CPU devenait le prochain goulot.
2. Le test reste lexical et ne construit pas 51 cartes réelles. Il ne vérifie donc pas automatiquement le nombre de nœuds, l'ordre du 50e élément, le texte singulier/pluriel, l'annonce du statut ou les opérations après filtrage. Une recette DOM/navigation assistée demeure souhaitable.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` et `git rev-parse 9543ecc38be2e504ba6dcfeb0779692391064a88` : `9543ecc38be2e504ba6dcfeb0779692391064a88`.
- Inspection du flux complet `cells → visibleCells/hiddenCellCount → event()/summary`, des bindings d'opérations et de la cascade timed/non-timed : **conforme**.
- `node --test tests/planning-postproduction.test.js` : **PASS, 44/44**, 0 échec/skip/todo, durée `598,099 ms`.
- `npm test` : **PASS, 341/341**, 0 échec/cancelled/skip/todo, durée `11,339 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check b95493cffd9a6d23b5b7a9bf4614170696189445..9543ecc38be2e504ba6dcfeb0779692391064a88` : **PASS**.
- Limite : aucun smoke navigateur ou lecteur d'écran frais n'est revendiqué dans cette re-review.

Empreintes contrôlées :

```text
app.js                              c63782771df62be98a0e5ca484f766f5bf903f680aea9668e8639387e249fc39
planning.css                        c7904c3cfab77078997ba5efb7c9c34e24d17db2fc2abb8773351985881bfdb1
tests/planning-postproduction.test.js 089dc0012d73faa6652475219631ac5be0104c44a77b9ce05c8d7c07aec78ee4
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW du correctif de densité Planning est **APPROVED** sur `9543ecc38be2e504ba6dcfeb0779692391064a88` : 0 P0, 0 P1, 2 P2 non bloquants. L'intégrateur doit faire porter les gates aval sur ce même état applicatif.

---

# Re-REVIEW terminale — confinement des piles temporisées

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `b95493cffd9a6d23b5b7a9bf4614170696189445` (`fix(planning): confine timed booking stacks`)

Correctif contrôlé : `4d067719358d92b452a8888f8cc8dfe757e3aa86..b95493cffd9a6d23b5b7a9bf4614170696189445`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert ; 1 P2 non bloquant.**

Le P1 `REV-RC3-PROJECT-03` est fermé. Une cellule horaire ou demi-journée empilée remplace désormais l'`overflow:visible` historique par un confinement horizontal et un scroll vertical local. Ses cartes temporisées sont ramenées à la largeur du créneau source. Une réservation isolée ne reçoit ni `.is-stacked` ni ces overrides et conserve donc sa largeur calculée sur toute sa durée.

## Fermeture du P1 temporisé

- La règle `.planning-matrix-shell.is-timed-grid .planning-cell.is-time-slot.is-stacked` est plus spécifique et plus tardive que la règle historique `.planning-cell.is-time-slot{overflow:visible}`. `overflow-x:hidden;overflow-y:auto` gagne effectivement la cascade.
- L'override descendant sur `.planning-timed-event` fixe la largeur à `calc(var(--planning-day-width) - 8px)`, identique à la largeur minimale d'un créneau. Les cartes empilées ne débordent donc plus horizontalement dans les créneaux suivants.
- Le rendu ajoute `.is-stacked` uniquement lorsque `cells.length > 1`. Une réservation temporisée isolée conserve la règle originale `width:calc(var(--planning-event-span)*var(--planning-day-width) - 8px)` et continue de représenter sa durée.
- Deux cartes empilées sont compactées à 58 px chacune. Avec filtre Projet, la piste vaut 132 px et contient les 130 px nécessaires ; sans filtre Projet, la piste reste bornée à 104 px et le surplus est disponible par le scroll local.
- À partir de quatre cartes, la profondeur Projet demeure plafonnée à trois et la piste à 194 px ; les 254 px de contenu sont contenus dans la cellule et accessibles verticalement. Le même contrat vaut pour les granularités heure et demi-journée.
- Les cellules non temporisées conservent leur règle `overflow-y:auto` existante et leurs pistes `92/132/194 px`. Aucun comportement de largeur n'y est modifié.

## Wrappers, virtualisation et axes

- Les deux wrappers `event` continuent de propager `compact`; sélection, déplacement et poignées restent présents.
- `data-row-height` et `data-column-width` restent la source commune du handler de scroll. CSS, spacers, découpage initial et seuils de re-rendu utilisent les mêmes dimensions.
- Le correctif est exclusivement CSS hors test/statut : aucune mutation des calculs de créneau, de l'overscan, du `scrollTop`/`scrollLeft`, des synchronisations ou de la restauration.
- Le scroll local est borné à la cellule ; `overscroll-behavior:contain` évite de transférer involontairement sa fin de course au scroller principal.

## Accessibilité et non-régression

- Les cartes compactes conservent leur `aria-label` complet, y compris statut, décision, projet, période et présence. Le badge visible conserve la présence, la décision ou le statut selon la priorité prévue.
- Les cartes et poignées restent focalisables selon les mêmes permissions. Le focus successif permet au navigateur de révéler les cartes situées dans la partie scrollée de la cellule.
- Les statuts ne reposent pas uniquement sur la couleur et aucun ordre DOM n'est modifié.
- Sticky headers, filtres Projet, API, données, RBAC et opérations Planning sont inchangés.

## P2 — preuve de layout encore statique

Les assertions ajoutées vérifient les sélecteurs et valeurs CSS, mais ne rendent pas deux ou quatre cartes dans un moteur de layout et ne mesurent pas l'overflow calculé. Le DOM et la cascade actuels ferment le défaut, mais une recette navigateur heure/demi-journée reste recommandée pour protéger visuellement le scrollbar local, le focus et les poignées de redimensionnement.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` et `git rev-parse b95493cffd9a6d23b5b7a9bf4614170696189445` : `b95493cffd9a6d23b5b7a9bf4614170696189445`.
- Inspection du DOM produit et de la cascade `is-time-slot`/`is-stacked`/`planning-timed-event` : confinement actif uniquement pour les piles ; span normal préservé pour une carte isolée.
- `node --test tests/planning-postproduction.test.js` : **PASS, 44/44**, 0 échec/skip/todo, durée `153,761 ms`.
- `npm test` : **PASS, 341/341**, 0 échec/cancelled/skip/todo, durée `8,760 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check 4d067719358d92b452a8888f8cc8dfe757e3aa86..b95493cffd9a6d23b5b7a9bf4614170696189445` : **PASS**.
- Limite : aucun smoke navigateur frais n'est revendiqué dans cette re-review.

Empreintes contrôlées :

```text
app.js                              eaa823db9d7e5f98363025b3fce209490f68db1f76639886a97cbab24335520f
planning.css                        0a46eb6422be59c393e7cd188a4be1171e58f190b0b552c3d19b70ced1e24dd8
tests/planning-postproduction.test.js 1a0686dfb520e265bf2ced2331f06154dc629271f344281e90343e9cd14b388c
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW du correctif Projet vers Planning est **APPROVED** sur `b95493cffd9a6d23b5b7a9bf4614170696189445` : 0 P0, 0 P1, 1 P2 non bloquant. L'intégrateur doit faire porter les gates visuels aval sur ce même état applicatif.

---

# Re-REVIEW finale — Projet vers Planning, lignes empilées bornées

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `4d067719358d92b452a8888f8cc8dfe757e3aa86` (`fix(planning): bound stacked project rows`)

Correctif contrôlé : `e9752f4e791f42bfcd8ad584e898ce68e20a850f..4d067719358d92b452a8888f8cc8dfe757e3aa86`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 1 P1 ouvert, 1 P2.**

Les deux P1 du candidat `e9752f4` sont fermés pour les cellules non temporisées : le handler relit désormais exactement `data-row-height` et `data-column-width`, tous les wrappers `event` propagent le mode compact, et une carte empilée est réellement bornée à 58 px. Le cap à trois produit des pistes cohérentes de `92/132/194 px` et le surplus obtient un scroll local. En revanche, ce dernier mécanisme exclut explicitement les cellules horaires/demi-journée, qui conservent `overflow:visible`. Plus de trois cartes dans un même créneau temporisé débordent donc encore sur la ligne suivante, y compris en vue Projet.

## Fermetures confirmées des anciens P1

### Virtualisation et axes

- `planningMatrix()` publie `data-row-height="${rowHeight}"` et `data-column-width="${columnWidth}"` sur la matrice.
- `timeline.onscroll` relit ces deux valeurs depuis le même nœud avant `planningVirtualWindowNeedsRender()`. La création de fenêtre, les variables CSS, les spacers, les seuils de re-rendu et la restauration utilisent désormais la même hauteur.
- Les fallbacks `92/104` ne s'appliquent qu'en absence anormale de données ; le rendu normal fournit toujours les attributs.
- Les synchronisations verticales et horizontales, la molette, le scrollbar dédié et le `requestAnimationFrame` restent inchangés.

### Cartes compactes et consommateurs

- Le mode compact remplace les lignes option, présence et période par un badge unique priorisé, tout en conservant le détail complet dans `aria-label` et `title`.
- Les deux wrappers successifs — sélection commerciale puis opérations de déplacement/redimensionnement — acceptent et transmettent `compact`. Aucun autre wrapper de `event` n'est présent.
- `.planning-event.is-compact-stack` possède `box-sizing:border-box`, `height:58px`, `max-height:58px` et `overflow:hidden` dans une règle finale suffisamment spécifique. Les poignées restent dans cette boîte et leurs libellés accessibles sont conservés.
- La formule de piste correspond au layout : padding cellule 10 px + `n × 58 px` + `(n−1) × 4 px`; deux cartes occupent 130 px dans 132, trois 192 px dans 194.
- La profondeur n'agrandit les lignes que lorsque `filters.project` est renseigné. Elle est plafonnée à trois avec sortie anticipée, évitant une croissance globale non bornée.

## P1 — REV-RC3-PROJECT-03 — absence d'overflow local en grille temporisée

La nouvelle règle limite le scroll local à :

```css
.planning-cell.is-stacked:not(.is-time-slot) { overflow-y: auto }
```

Les cellules Jour horaires ou demi-journée portent `.is-time-slot` et restent couvertes par la règle historique plus spécifique :

```css
.planning-matrix-shell.is-timed-grid .planning-cell.is-time-slot { overflow: visible }
```

Le calcul de profondeur est pourtant plafonné à trois pour ces vues aussi, et `timelineRows` rend toutes les cartes réelles, sans tronquer la liste. À partir de quatre réservations dans la même salle et le même créneau de départ, la piste reste à `194 px` tandis que les quatre cartes compactes demandent 254 px avec padding et gaps. Sans `overflow-y:auto`, la quatrième carte se peint au-delà de la cellule et recouvre la ressource suivante. Hors filtre Projet, deux cartes temporisées sont compactées dans la hauteur de base `104 px` mais demandent 130 px, produisant déjà le même défaut.

Ce comportement échoue précisément l'exigence de parité temporisée/non temporisée et le contrat « cap 3 + overflow local ». La correction doit préserver le débordement horizontal nécessaire aux cartes couvrant plusieurs créneaux tout en bornant verticalement la pile — par exemple via un conteneur vertical interne dédié — puis recevoir un test DOM/CSS sur quatre cartes horaires et demi-journée.

## P2 — couverture de test incomplète

Le test ajouté vérifie les nombres, les chaînes source et la règle de hauteur, mais aucun cas temporisé, aucun style calculé et aucun overflow réel. Il ne détecte donc pas l'exclusion `:not(.is-time-slot)`. Un smoke navigateur doit couvrir deux et quatre cartes en Jour heure/demi-journée, en plus du parcours Projet non temporisé.

## Accessibilité et non-régression

- Les informations retirées visuellement en compact restent présentes dans `aria-label`; le badge montre au moins présence, décision ou statut, par ordre de priorité.
- Les cartes et poignées conservent focus, raccourcis et noms accessibles. Dans les cellules non temporisées, la navigation vers un enfant focalisable peut révéler les éléments du scroller local.
- Les filtres, API, données, permissions, sticky headers et mutations Planning sont inchangés.
- `planningMaxCellStack()` reste exact pour les clés jour, demi-journée et heure ; sa recherche de créneau est bornée par la petite fenêtre Jour et sort dès le cap atteint.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` et `git rev-parse 4d067719358d92b452a8888f8cc8dfe757e3aa86` : `4d067719358d92b452a8888f8cc8dfe757e3aa86`.
- Inspection de tous les wrappers `event`, des attributs de dimensions, du handler de scroll et de la cascade `is-stacked`/`is-time-slot` : anciens P1 fermés, P1 temporisé reproduit structurellement.
- `node --test tests/planning-postproduction.test.js` : **PASS, 44/44**, 0 échec/skip/todo, durée `142,389 ms`.
- `npm test` : **PASS, 341/341**, 0 échec/cancelled/skip/todo, durée `8,404 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check e9752f4..4d067719358d92b452a8888f8cc8dfe757e3aa86` : **PASS**.
- Limite : aucun navigateur/layout engine frais n'est revendiqué ; le défaut restant découle directement des sélecteurs mutuellement exclusifs et des dimensions exactes.

Empreintes contrôlées :

```text
app.js                              eaa823db9d7e5f98363025b3fce209490f68db1f76639886a97cbab24335520f
planning.css                        4aaf3b966ef952ddaaece54c90058aa58569becbacd07a6ca3d4fc48d55dad9a
tests/planning-postproduction.test.js e40ddc06ec226d906b930a4e89aff0e3bea12c17e2371db36c8c758e8a602fb5
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW du correctif Projet vers Planning est **CHANGES REQUIRED** sur `4d067719358d92b452a8888f8cc8dfe757e3aa86` : 0 P0, 1 P1 (`REV-RC3-PROJECT-03`), 1 P2. Retour DEV requis, puis re-REVIEW indépendante et preuve navigateur des piles temporisées et non temporisées.

---

# Re-REVIEW indépendante — densité de la vue Projet Planning

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `e9752f4e791f42bfcd8ad584e898ce68e20a850f` (`fix(planning): fit stacked project bookings`)

Correctif contrôlé : `6c59402..e9752f4e791f42bfcd8ad584e898ce68e20a850f`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 2 P1 ouverts, 2 P2.**

Le regroupement `planningMaxCellStack()` reproduit correctement les clés de cellule utilisées par le rendu journalier, horaire et demi-journée, et la nouvelle hauteur alimente bien la variable CSS ainsi que la création initiale de la fenêtre virtuelle. Deux consommateurs bloquants restent toutefois incohérents : le handler de scroll continue de recalculer les seuils virtuels avec les anciennes hauteurs fixes, et la formule `planningRowHeight()` suppose une hauteur constante de 58 px par carte alors que le composant rendu possède un nombre de lignes variable. Le cas testé prouve seulement `2 → 132 px`, sans démontrer que deux cartes réelles tiennent dans ces 132 px.

## P1 — REV-RC3-PROJECT-01 — le scroll virtuel ignore la hauteur dynamique

`planningMatrix()` calcule désormais `rowHeight`, l'utilise dans `planningVirtualSlice()`, l'injecte dans `--planning-row-height` et l'ajoute à la clé virtuelle. En revanche, `timeline.onscroll` conserve ce calcul historique :

```js
rowHeight = planningFullscreen && compactView ? 64 : compactView ? 74 : 92
```

Ce second consumer n'utilise ni `matrix.style --planning-row-height`, ni une donnée `data-row-height`, ni `planningRowHeight()`. Avec deux cartes, le DOM et les spacers progressent par `132 px`, mais `planningVirtualWindowNeedsRender()` décide encore les limites visibles par pas de `92 px` hors vue compacte. Le décalage augmente à chaque ligne : après dix lignes, le seuil logique dérive déjà de 400 px. Selon la position, la fenêtre peut être reconstruite trop tôt ou trop tard, avec lignes vides, saut de contenu ou restauration instable du `scrollTop`.

Le même chemin oublie aussi le `baseRowHeight=104` d'une grille Jour temporisée. Le correctif étend donc une incohérence existante au parcours précis qu'il cherche à réparer. Tous les consommateurs de la virtualisation doivent utiliser la même hauteur résolue.

## P1 — REV-RC3-PROJECT-02 — 58 px par carte ne couvre pas les cartes réellement rendues

La formule est :

```js
12 + depth * 58 + (depth - 1) * 4
```

Elle donne `132 px` pour deux cartes. Or `event()` rend toujours titre, projet/horaire et badge de statut, puis peut ajouter une ligne de décision d'option, une présence avec `white-space:normal`, et une ligne supplémentaire pour toute réservation multi-jour. Les cellules ont 10 px de padding vertical et 4 px de gap. Aucune règle ne fixe une hauteur de carte à 58 px et aucun plafond ne garantit que ces variantes y tiennent.

Le test utilise justement une réservation multi-jour, mais n'appelle jamais `event()`, ne construit aucun DOM et n'évalue aucune hauteur calculée. Il valide uniquement le nombre `132`. Deux cartes multi-jour, deux doubles options ou deux cartes avec présence peuvent donc dépasser la piste CSS ; le contenu déborde vers la ligne suivante ou est rogné par l'`overflow:hidden` interne. Cela contredit le critère « multi-cartes sans overflow » et peut masquer des libellés accessibles visuellement utiles.

Correction attendue : soit imposer et tester une carte compacte de hauteur réellement bornée avec traitement accessible du contenu, soit mesurer/modéliser toutes les variantes rendues et dimensionner la piste en conséquence. Une preuve DOM sur au minimum deux cartes multi-jour, option et présence est requise.

## Exactitude du comptage

- Hors grille temporisée, la clé `resourceId|date` correspond à la cellule qui rend les cartes.
- En demi-journée, la partition avant/après 13 h reprend le même choix que le filtre de rendu.
- En horaire, la recherche du créneau contenant le début de l'intervalle correspond à la condition qui rend une carte uniquement dans son créneau initial ; la largeur continue de porter sa durée.
- Les cellules déplacées et allocations sont prises via `bookingRenderedCells()`, comme le rendu. Les filtres salle et dates empêchent de surcompter hors matrice.
- Le maximum global rend volontairement toutes les lignes uniformes, ce qui maintient le modèle de virtualisation à taille constante.

## P2 — complexité et ergonomie

1. En horaire, chaque cellule de réservation exécute `slots.find()`. Le coût ajouté est `O(cellules de réservation × créneaux)` avant le rendu déjà coûteux. Le nombre de créneaux Jour borne actuellement l'impact, mais une indexation des créneaux éviterait une régression si la granularité ou la fenêtre s'élargit.
2. Une seule cellule très dense agrandit toutes les lignes de toutes les salles sur toute la période chargée. C'est compatible avec la virtualisation uniforme, mais peut fortement réduire la densité et la navigation clavier/visuelle d'une grande vue Projet. Aucune borne ni stratégie de repli n'est documentée.

## Accessibilité et consommateurs inchangés

- Les cartes conservent leur article, libellé `aria-label`, focus, raccourcis clavier et statuts textuels ; aucune permission ni action n'est changée.
- L'injection de `rowHeight` est numérique et issue de données comptées, sans nouveau contenu HTML utilisateur.
- Les API, données persistées, filtres Projet, sticky headers et synchronisation des axes ne changent pas dans ce diff.
- L'augmentation de piste est correctement transmise aux cellules, ressources et spacers CSS initiaux via `--planning-row-height`, mais pas au consumer de seuils lors du scroll, objet du P1 principal.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` et `git rev-parse e9752f4` : `e9752f4e791f42bfcd8ad584e898ce68e20a850f`.
- Inspection de `planningMaxCellStack`, `planningRowHeight`, `planningMatrix`, du handler `timeline.onscroll`, du HTML `event()` et des règles CSS de cellules/cartes : deux divergences P1 reproduites structurellement.
- `node --test tests/planning-postproduction.test.js` : **PASS, 44/44**, 0 échec/skip/todo, durée `142,964 ms`.
- `npm test` : **PASS, 341/341**, 0 échec/cancelled/skip/todo, durée `11,620 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check 6c59402..e9752f4` : **PASS**.
- Limite : aucun navigateur/layout engine frais n'est revendiqué ; les tests ajoutés sont purement fonctionnels et ne rendent pas les cartes.

Empreintes contrôlées :

```text
app.js                              4a8427df94b98677a16e99e5795c6aabfff0ea6a0e3e42880ce1e9781f8d2005
planning.css                        48a8ad5bec9e86c56d3444812632506a022be837eef82418f6db1b962d9bec36
tests/planning-postproduction.test.js 927dee2c88297b4457c381f42e399db65edfa3f888f1116b790754989266ecee
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW du correctif vue Projet est **CHANGES REQUIRED** sur `e9752f4e791f42bfcd8ad584e898ce68e20a850f` : 0 P0, 2 P1 (`REV-RC3-PROJECT-01`, `REV-RC3-PROJECT-02`), 2 P2. Retour DEV requis, puis re-REVIEW indépendante et preuve navigateur de cartes empilées avec scroll/virtualisation.

---

# Re-REVIEW finale — hiérarchie sticky du Planning

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `56b9f456734de9389c1f4ab6623a378448fe2b67` (`fix(planning): complete sticky header hierarchy`)

Correctif contrôlé : `d4c7fcfbe423940ff57fbeca541ef0e873d12c15..56b9f456734de9389c1f4ab6623a378448fe2b67`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert ; 1 P2 non bloquant.**

Le P1 `REV-RC2-SCROLL-01` est fermé. Les trois sélecteurs finaux correspondent maintenant aux branches réelles du DOM et établissent une hiérarchie cohérente : dates `10`, colonne fixe `11`, angle `12`. Les en-têtes restent donc au-dessus des événements temporisés `4` et des cartes focalisées `9`, tandis que l'angle demeure au-dessus des ressources et du bandeau de dates.

## Fermeture de REV-RC2-SCROLL-01

- `.planning-matrix-scroll .matrix-day{z-index:10}` cible réellement les dates rendues dans `.postprod-matrix`, descendante du scroller de chronologie.
- `.planning-fixed-column{z-index:11}` cible la branche sœur contenant l'angle et les libellés Ressources. Cette règle gagne sur la déclaration historique du même sélecteur à `7` par ordre source.
- `.planning-fixed-column .matrix-corner{z-index:12}` cible réellement l'angle sticky. Sa spécificité supérieure et sa position finale remplacent l'ancien `z-index:6` de `.matrix-corner`.
- La colonne fixe est déjà `position:relative` et l'angle `position:sticky;top:0` : leurs `z-index` sont opérants et créent les contextes attendus.
- Les événements temporisés restent contenus dans `.planning-timed-event{position:relative;z-index:4}`. Leur enfant focalisé à `z-index:9` ne peut sortir de ce contexte `4`. Les événements non temporisés focalisés à `9` restent également sous les dates à `10`.
- La hiérarchie effective est donc `angle 12` dans `colonne fixe 11` > `dates 10` > `événement focalisé 9` > `événement temporisé 4`.

## Scroll, virtualisation et accessibilité

- Le diff ne change aucune géométrie, dimension de ligne/colonne, règle d'overflow, scrollbar ou gestionnaire d'événement.
- Le scroll vertical natif de la chronologie, sa synchronisation vers la colonne fixe, le scroll horizontal natif et le scrollbar horizontal dédié restent inchangés.
- La restauration `scrollTop`/`scrollLeft`, le tampon d'overscan, les fenêtres lignes/colonnes et les spacers de virtualisation restent identiques ; les tests de découpage et de restauration des deux axes passent.
- Les dates restent focalisables et activables au clavier ; la région Planning conserve `role="region"`, `tabindex="0"` et son nom accessible. Le focus visible des réservations est inchangé ; seule leur priorité de peinture par rapport au bandeau sticky est bornée.
- Les fonds opaques des dates et de l'angle évitent que les événements restent visibles par transparence lors du défilement.

## P2 — protection encore lexicale

Le test Foundations protège maintenant les trois bons sélecteurs et valeurs, mais reste une assertion textuelle : il ne calcule pas les styles, ne contrôle pas les contextes d'empilement et ne déroule pas un scroll réel. Ce risque est non bloquant sur le candidat inspecté, dont le DOM, la cascade et les propriétés de positionnement ont été vérifiés directement. Un smoke navigateur de croisement vertical/horizontal reste souhaitable au gate QA/E2E.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` et `git rev-parse 56b9f45` : `56b9f456734de9389c1f4ab6623a378448fe2b67`.
- Inspection du DOM produit, des règles historiques et de l'override final : les trois sélecteurs correspondent et gagnent la cascade ; **conforme**.
- `node --test tests/foundations.test.js tests/planning-postproduction.test.js` : **PASS, 60/60**, 0 échec/skip/todo, durée `369,017 ms`.
- `npm test` : **PASS, 340/340**, 0 échec/cancelled/skip/todo, durée `11,166 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check d4c7fcf..56b9f45` : **PASS**.
- Limite : aucun smoke navigateur frais n'est revendiqué dans cette re-review ; il reste du ressort du gate visuel aval.

Empreintes contrôlées :

```text
planning.css                        48a8ad5bec9e86c56d3444812632506a022be837eef82418f6db1b962d9bec36
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
tests/foundations.test.js           81af03baa607a81fc66e210c3cda032f240b7e37abbe47c08606a3816db96abf
tests/planning-postproduction.test.js 9c5721e024c6e25161916c1a256202f1a289a80a86ae62e6b967764a714e061f
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW du correctif Planning est **APPROVED** sur `56b9f456734de9389c1f4ab6623a378448fe2b67` : 0 P0, 0 P1, 1 P2 non bloquant. L'intégrateur doit faire porter les gates visuels aval sur ce même état applicatif.

---

# Re-REVIEW indépendante — correctif de scroll Planning post-RC2

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `d4c7fcfbe423940ff57fbeca541ef0e873d12c15` (`fix(planning): keep date header above bookings`)

Correctif contrôlé : `d564cca..d4c7fcfbe423940ff57fbeca541ef0e873d12c15`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 1 P1 ouvert, 1 P2.**

Le correctif ferme la collision principale entre les dates sticky et les réservations temporisées : la règle finale porte effectivement les `.matrix-day` à `z-index:8`, au-dessus du contexte `.planning-timed-event` à `z-index:4`. En revanche, la partie annoncée pour l'angle Ressources/dates ne s'applique jamais au DOM réel : `.matrix-corner` n'est pas un descendant de `.planning-matrix-scroll`. L'angle reste donc à sa couche historique `6` dans une colonne fixe de couche `7`, et non à `10`. Le test ajouté valide seulement le texte CSS et produit un faux positif sur cette moitié du contrat.

## P1 — REV-RC2-SCROLL-01 — sélecteur de l'angle sans cible réelle

La règle ajoutée en fin de `planning.css` est :

```css
.planning-matrix-scroll .matrix-day { z-index: 8 }
.planning-matrix-scroll .matrix-corner { z-index: 10 }
```

Or le rendu de `app.js` construit deux branches sœurs sous `.planning-matrix-shell` :

```text
.planning-fixed-column
  .matrix-corner
  .planning-fixed-resources
.planning-matrix-scroll
  .postprod-matrix
    .matrix-day
    .planning-cell / .planning-timed-event
```

Ainsi, la première règle correspond aux en-têtes de dates, mais la seconde ne peut correspondre à aucun élément. La cascade effective demeure `.matrix-corner{z-index:6}` à l'intérieur de `.planning-fixed-column{position:relative;z-index:7}`. La documentation de statut affirmant un angle à `10` et l'assertion Foundations ne décrivent donc pas le comportement livré.

Ce défaut bloque la revue car la hiérarchie explicitement demandée `corner 10 > date header 8 > events 4` n'est pas établie. Il laisse aussi la jonction des deux scrollers dépendre de deux contextes d'empilement différents lors du sticky et des synchronisations d'axes. Correction attendue : cibler l'angle dans sa branche réelle, puis tester la structure/correspondance ou le style calculé, pas seulement la présence d'une chaîne CSS.

## Comportements conformes et non-régressions

- `.matrix-day` est sticky (`position:sticky;top:0`) avec fond opaque et reçoit effectivement `z-index:8` par une règle finale plus spécifique que la règle historique à `4`.
- Les réservations temporisées restent dans `.planning-timed-event{position:relative;z-index:4}`. Le focus interne à `z-index:9` reste contenu dans ce contexte d'empilement parent à `4` et ne repasse pas devant le bandeau de dates.
- La colonne Ressources demeure sticky/synchronisée verticalement ; la chronologie conserve son scroll natif vertical et horizontal, son scrollbar horizontal dédié et sa gestion clavier.
- Le correctif CSS ne modifie ni les handlers `scrollLeft`/`scrollTop`, ni la synchronisation par `requestAnimationFrame`, ni le routage de la molette, ni les dimensions des vues.
- La virtualisation lignes/colonnes, ses spacers, son overscan et la restauration des deux axes sont inchangés. Les tests fonctionnels existants de découpage virtuel restent verts.
- Les dates restent focalisables et activables au clavier ; la région Planning garde `tabindex="0"`, `role="region"` et son libellé accessible. Aucun statut ou contenu accessible n'est changé par ce diff.

## P2 — test de hiérarchie uniquement lexical

Le test ajouté cherche exactement la chaîne contenant les deux déclarations. Il ne vérifie ni que les sélecteurs correspondent au DOM généré, ni les contextes d'empilement, ni la valeur calculée, ni un scroll réel. C'est précisément pourquoi l'angle inexistant à `10` passe au vert. Une preuve DOM/style calculé ou un smoke navigateur avec croisement vertical/horizontal est nécessaire pour protéger durablement ce correctif visuel.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` et `git rev-parse d4c7fcf` : `d4c7fcfbe423940ff57fbeca541ef0e873d12c15`.
- Inspection de la cascade et du DOM produit dans `app.js` : `.matrix-day` correspond à la nouvelle règle ; `.matrix-corner` n'est pas descendant de `.planning-matrix-scroll` et n'y correspond pas.
- `node --test tests/foundations.test.js tests/planning-postproduction.test.js` : **PASS, 60/60**, 0 échec/skip/todo, durée `529,138 ms`.
- `npm test` : **PASS, 340/340**, 0 échec/cancelled/skip/todo, durée `8,500 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check d564cca..d4c7fcf` : **PASS**.
- Limite : aucun smoke de scroll navigateur frais n'est revendiqué ; l'analyse structurelle suffit à démontrer que le sélecteur de l'angle a zéro correspondance dans le rendu.

Empreintes contrôlées :

```text
planning.css                        acde3c58dfde5cc7a2d5614594eb20bca82610ae4067369a69936614a514629c
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
tests/foundations.test.js           a9063cc60fd43b94784f3725b5682ac1d243819885fb2cd9468e6bb247dc7906
tests/planning-postproduction.test.js 9c5721e024c6e25161916c1a256202f1a289a80a86ae62e6b967764a714e061f
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW du correctif Planning est **CHANGES REQUIRED** sur `d4c7fcfbe423940ff57fbeca541ef0e873d12c15` : 0 P0, 1 P1 (`REV-RC2-SCROLL-01`), 1 P2. Retour DEV requis, puis re-REVIEW indépendante et contrôle visuel du scroll sur le même candidat corrigé.

---

# Re-REVIEW ultime RC2 — indicateur de focus Pilotage

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `34a9d7883dcf22cad517bf45393848eaa60d48d8` (`fix(a11y): strengthen pilotage focus ring`)

Correctif contrôlé : `fce292974c933358bbfd980c8344cc38e5a923ed..34a9d7883dcf22cad517bf45393848eaa60d48d8`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert ; 1 P2 non bloquant.**

Le P1 `REV-RC2-UI-01` est fermé. L'override final remplace effectivement l'outline translucide par `3px solid var(--primary)` sur les onglets et boutons KPI Pilotage. La couleur résolue `#6c5ce7` atteint **4,8584:1** sur blanc, au-dessus du minimum `3:1` pour un indicateur de focus. L'épaisseur et l'offset restent inchangés.

## Fermeture de REV-RC2-UI-01

- La nouvelle règle reprend exactement le même sélecteur que la règle historique : `.pilotage-tabs button:focus-visible,.pilotage-kpi button:focus-visible`.
- Les deux règles ont donc la même spécificité. La règle opaque est déclarée après la règle translucide, après le bloc responsive et en dernière position de `planning.css` : l'ordre source la fait gagner sans `!important`.
- Aucun sélecteur ultérieur ne réécrit `outline` ou `outline-color` pour ces contrôles.
- `--primary` se résout dans `styles.css` en `var(--purple)`, puis `#6c5ce7`. La règle effective ne dépend plus de `color-mix()` et conserve un rendu explicite dans les navigateurs supportant les variables CSS.
- Le ratio calculé `#6c5ce7` / `#ffffff` est `4,8584211597:1`. L'`outline-offset:2px` préserve une séparation visible avec le bouton, y compris lorsque l'onglet sélectionné possède lui-même un fond primaire.
- Le changement est strictement CSS hors test/statut : aucune incidence sur la mise en page, les contrats API, les données, les permissions ou les moteurs G8.

## P2 — couverture statique de la cascade

Le nouveau test Foundations vérifie la présence textuelle de la règle opaque, mais pas qu'elle reste la dernière déclaration gagnante ni que la valeur résolue respecte automatiquement le seuil de contraste. Une future règle plus tardive ou une modification de `--purple` pourrait donc échapper à ce test. Ce point n'est pas bloquant sur le candidat présent, dont la cascade et la valeur résolue ont été contrôlées directement.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` : `34a9d7883dcf22cad517bf45393848eaa60d48d8`.
- Inspection du diff et de la fin de `planning.css` : override opaque en dernière position, même sélecteur et même spécificité ; **conforme**.
- Sonde WCAG locale sur les valeurs exactes : `#6c5ce7` / `#ffffff` = **4,8584211597:1**.
- `node --check app.js` : **PASS**.
- `node --test tests/foundations.test.js` : **PASS, 17/17**, 0 échec/skip/todo, durée `327,788 ms`.
- `npm test` : **PASS, 340/340**, 0 échec/cancelled/skip/todo, durée `9,474 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check fce292974c933358bbfd980c8344cc38e5a923ed..34a9d7883dcf22cad517bf45393848eaa60d48d8` : **PASS**.
- Limite : aucun smoke visuel navigateur ou lecteur d'écran frais n'est revendiqué ; le verdict repose sur la cascade exacte, la mesure de contraste et les tests automatisés.

Empreintes contrôlées :

```text
planning.css                        2c4bea06db6d29e0fa6ad8febdd78cb24e553e02ecfeb33f8cd4db666145897b
styles.css                          8f14b1483f6bb58522df36a3841e318099ca9a0fc32b82f8b9b6fde1fd07c196
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
tests/foundations.test.js           aaa49dde1f59c94bf7b4fc292e25852f52a638745f3adc932d7d43b71ce185e3
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW ultime RC2 est **APPROVED** sur le candidat exact `34a9d7883dcf22cad517bf45393848eaa60d48d8` : 0 P0, 0 P1, 1 P2 non bloquant. L'intégrateur doit reporter ce verdict et faire porter les gates aval sur ce même état applicatif.

---

# Re-REVIEW indépendante — correctif visuel post-release G8

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `fce292974c933358bbfd980c8344cc38e5a923ed` (`fix(ui): define semantic design tokens`)

Correctif contrôlé : `9c3f958..fce292974c933358bbfd980c8344cc38e5a923ed`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 1 P1 ouvert, 2 P2.**

Les cinq tokens sémantiques sont bien définis et résolvent les déclarations auparavant invalides dans Pilotage, Réalisations et Finance. Les contrastes du texte principal et de l'onglet Pilotage sélectionné sont conformes. En revanche, l'activation de `--primary` rend aussi effectif un indicateur de focus Pilotage mélangé à seulement 35 % de violet : son contraste calculé sur la surface blanche est `1,62:1`, très inférieur au minimum `3:1`. Le candidat ne peut donc pas précéder RC2 en l'état.

## P1 — REV-RC2-UI-01 — focus Pilotage nouvellement actif mais insuffisamment contrasté

`planning.css:168` applique aux onglets Pilotage et aux boutons de KPI :

```css
outline: 3px solid color-mix(in srgb, var(--primary) 35%, transparent)
```

Avec `--primary → --purple → #6c5ce7` et une surface blanche, le mélange transparent se compose visuellement en environ `#ccc6f7`. La formule de luminance relative WCAG donne un contraste de **1,6169:1** contre `#ffffff`, sous le seuil **3:1** exigé pour qu'un indicateur de focus soit perceptible par rapport aux couleurs adjacentes.

Avant ce commit, `--primary` était indéfini et la déclaration auteur entière était invalide ; le navigateur pouvait conserver son focus par défaut. Le correctif active donc explicitement un outline peu visible et constitue une régression d'accessibilité sur les contrôles clavier centraux du module Pilotage.

Correction attendue : utiliser une couleur d'outline opaque atteignant au moins `3:1` sur les surfaces possibles, par exemple `var(--primary)` lui-même (`4,8584:1` sur blanc), conserver les 3 px et l'offset, puis ajouter un test qui valide la valeur résolue ou son contraste. Rejouer au clavier les onglets et « Voir le détail ».

## P2 — importants, non bloquants isolément

1. Le test Foundations vérifie uniquement que les cinq alias contiennent `var(--...)`. Il ne vérifie ni leurs cibles exactes, ni leur résolution, ni leurs usages, ni leurs contrastes. Une inversion, une référence circulaire ou une valeur trop claire resterait verte.
2. `color-mix()` ne possède aucun fallback auteur dans la règle de focus Pilotage. Les navigateurs qui ne supportent pas cette fonction ignorent la déclaration ; un outline simple avant la variante moderne préserverait une compatibilité explicite. Ce point devient secondaire si la correction P1 remplace directement le mélange par une couleur opaque.

## Éléments conformes

- Les cinq alias demandés existent dans `:root` : `--primary`, `--surface`, `--surface-soft`, `--text`, `--border`.
- Leur chaîne de résolution est déterministe : `primary=#6c5ce7`, `surface=#ffffff`, `surface-soft=#eeebff`, `text=#151823`, `border=#e6e8ed`.
- L'ordre de chargement `styles.css` puis `planning.css` rend les alias disponibles à tous les consommateurs sans changer la cascade locale.
- Pilotage utilise les cinq tokens : onglets, état sélectionné, cartes indisponibles, sources et focus.
- Réalisations et Finance utilisent `--border` pour leurs sections, listes, dialogues et tableaux ; leurs focus dédiés `#8068f2` conservent environ `4,05:1` sur blanc et `3,79:1` sur `#f7f7fb`.
- Le texte blanc sur `--primary` atteint `4,8584:1` ; `--text` sur `--surface` atteint `17,6945:1`. Les libellés sélectionnés et le texte principal passent AA.
- Le changement est CSS-only hors test/statut : aucun impact API, données, RBAC, exports, calculs G8 ou SSE.

`--border` sur blanc n'atteint que `1,2259:1`. Il est utilisé surtout comme séparateur décoratif de lignes, mais l'onglet Pilotage inactif repose aussi sur cette bordure très claire. Le libellé sombre, la forme et le groupement restent perceptibles ; ce point n'est pas classé P1 sur ce diff minimal, mais mérite une vérification visuelle avec les utilisateurs malvoyants.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` et `git rev-parse fce2929` : `fce292974c933358bbfd980c8344cc38e5a923ed` au début de la revue.
- Inspection des définitions et de tous les usages `var(--primary|surface|surface-soft|text|border)` : **5 alias présents**, consommateurs Pilotage/Réalisations/Finance identifiés.
- Sonde WCAG locale : blanc/primary `4,8584:1`, blanc/text `17,6945:1`, blanc/border `1,2259:1`, blanc/focus composite 35 % `1,6169:1`, blanc/focus Réalisations-Finance `4,0540:1`.
- `node --check app.js` : **PASS**.
- `node --test tests/foundations.test.js` : **PASS, 17/17**, 0 échec/skip/todo, durée `324,01 ms`.
- `npm test` : **PASS, 340/340**, 0 échec/skip/todo, durée `9,197 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check 9c3f958..fce2929` : **PASS**.
- Limite : aucun audit visuel navigateur automatisé ou lecteur d'écran n'a été exécuté ; les ratios sont calculés à partir des valeurs CSS exactes du candidat.

Empreintes contrôlées :

```text
styles.css                          8f14b1483f6bb58522df36a3841e318099ca9a0fc32b82f8b9b6fde1fd07c196
planning.css                        51b38d7ed0eef30e085725777bc293c6e2c435dc87e07056913dbc116608197d
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
tests/foundations.test.js           3708ad8c6e611e871d83fe16d5cf7acd08730d46fc277269a32ff3cd79e7fea4
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW post-release G8 est **CHANGES REQUIRED** sur `fce292974c933358bbfd980c8344cc38e5a923ed` : 0 P0, 1 P1 (`REV-RC2-UI-01`), 2 P2. Retour DEV requis avant RC2, puis re-REVIEW indépendante et gates aval visuels/accessibilité impactés.

---

# Re-REVIEW terminale G8 — composition finale du rendu authentifié

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `68489b1fc0575706ecbf13c191ab033dc1981d63` (`fix(auth): synchronize shell across composed routes`)

Correctif contrôlé : `08595fc2e643490c416117210e1b8dd8ddf34ed2..68489b1fc0575706ecbf13c191ab033dc1981d63`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert ; 2 P2 antérieurs restent suivis.**

Le correctif ferme le défaut de composition du rendu final. La synchronisation du shell et des overlays est maintenant exécutée par le wrapper terminal avant toute délégation vers une route spécialisée. Les routes Stock, Organisation, Finance, Commercial, Clients, Actuals et Pilotage ne peuvent donc plus court-circuiter `syncAuthenticatedSurfaces()` lorsqu'elles rendent directement leur page authentifiée.

## Vérification de la composition

- Le wrapper terminal est défini après tous les wrappers de route : `renderSprint8ExportsBase` capture le rendu composé incluant Pilotage, Actuals, Clients, Commercial, Finance, Organisation, Stock et le rendu de base.
- Sa première instruction est `syncAuthenticatedSurfaces(Boolean(state.user))`, avant l'appel à `renderSprint8ExportsBase()`. La synchronisation ne dépend donc plus du fait qu'un consommateur spécialisé délègue ou non au rendu de base.
- Aucun `render=function` n'est défini après ce wrapper. Les ajouts suivants composent Planning, ressources avancées et personnel sans remplacer le rendu terminal.
- Sur les routes génériques, la synchronisation peut être rejouée une seconde fois par le rendu de base ; l'opération est idempotente et bornée à quatre éléments et à la purge déjà vide hors session.

## Transitions de session

- **Démarrage** : le premier rendu, exécuté avant les derniers modules, atteint déjà le rendu de base avec `state.user=null` et conserve le document fail-closed. Le rendu terminal est ensuite en place pour toutes les actions utilisateur et asynchrones.
- **Login** : le gestionnaire appelle la variable globale `render` après hydratation ; il utilise donc le wrapper terminal, réactive shell/overlays, puis la route spécialisée masque la connexion et construit uniquement la page autorisée.
- **Logout** : après `state.user=null`, le wrapper terminal masque et rend inertes shell et overlays, purge `#app`, puis le rendu de base affiche la connexion et restaure son focus.
- **Expiration `401`** : `api()` appelle `endSession()`, qui utilise également le rendu global terminal. La fermeture est identique au logout, y compris sur Finance, Clients, Actuals ou Pilotage.
- **Reconnexion** : la synchronisation enlève `inert` du shell et des overlays sans rouvrir ces derniers ; le consommateur courant reconstruit ensuite la route avec le nouveau contexte et les permissions de session.

## Consommateurs et non-régression

- Les wrappers spécialisés continuent de gérer leurs permissions, chargements et bindings sans modification de contrat.
- Le wrapper Export Planning délègue toujours avant d'ajouter ses deux liens et retourne sans effet hors session, hors Planning ou sans `planning.read`.
- Serveur, OpenAPI, données, moteurs Dashboard/Finance, exports, Actuals, RBAC, idempotence et SSE sont inchangés par le correctif.
- Aucun nouvel appel réseau, écouteur, fallback ou dépendance n'est introduit.

## P2 suivis, non bloquants

1. Le contrôle Foundations reste statique et n'exécute pas réellement la matrice routes spécialisées × login/logout/401/reconnexion dans un DOM navigateur.
2. La purge continue de viser `#app`, sans vider tous les sous-contenus cachés des overlays ni tous les read-models JavaScript. Ils restent cependant fermés/inertes et leurs chemins publics d'ouverture reconstruisent le contexte courant ; aucune réexposition automatique n'a été trouvée.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` et `git rev-parse 68489b1` : `68489b1fc0575706ecbf13c191ab033dc1981d63` au début de la revue.
- Inspection de tous les `render=function`, du wrapper terminal et des chemins démarrage/login/logout/`401`/reconnexion : **conforme**.
- `node --check app.js` : **PASS**.
- `node --test tests/foundations.test.js` : **PASS, 16/16**, 0 échec/skip/todo, durée `310,28 ms`.
- `npm test` : **PASS, 339/339**, 0 échec/skip/todo, durée `7,790 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check 08595fc..68489b1` : **PASS**.
- Limite : aucun smoke navigateur frais n'est revendiqué ; la preuve de composition repose sur l'ordre d'évaluation explicite, l'inspection de tous les consommateurs et les tests automatisés.

Empreintes contrôlées :

```text
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
styles.css                          b26952fc8f08d8c3798c0764a7da2286acb35a53f5abcd03114545c869d6b8a1
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/foundations.test.js           1b8a66d2e062c31287bedfce6bcf82ae88fb2da63f1648c128749163d726d8e0
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW G8 est **APPROVED** sur le candidat exact `68489b1fc0575706ecbf13c191ab033dc1981d63` : 0 P0, 0 P1, 2 P2 suivis. L'intégrateur doit reporter ce verdict et faire porter les gates aval sur ce même état applicatif.

---

# Re-REVIEW terminale G8 — fermeture des overlays à la fin de session

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `08595fc2e643490c416117210e1b8dd8ddf34ed2` (`fix(auth): close overlays when sessions end`)

Correctif contrôlé : `593d392cd1b29b7d6fe6e92db857f9922b4ee34a..08595fc2e643490c416117210e1b8dd8ddf34ed2`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert ; 2 P2 suivis, non bloquants.**

Le P1 `REV-G8-UI-01` est fermé. La transition hors session est maintenant centralisée dans `syncAuthenticatedSurfaces()` : shell, modal de réservation, palette de recherche et tiroir Stock sont neutralisés avant l'affichage de la connexion. Le contenu principal est purgé, le focus quitte une surface authentifiée et revient au formulaire de connexion, et une connexion réussie enlève correctement `inert` avant le rendu de l'espace autorisé.

## Fermeture du P1 REV-G8-UI-01

### Shell et overlays hors session

- `#appShell` conserve son état initial fail-closed `hidden aria-hidden="true"` dans le document et sa règle CSS prioritaire.
- À chaque `render()`, `syncAuthenticatedSurfaces(Boolean(state.user))` synchronise le shell avec `hidden`, `aria-hidden` et `inert`.
- La même fonction parcourt explicitement `modalBackdrop`, `commandPalette` et `stockDrawerBackdrop`. Hors session, chaque overlay reçoit `inert=true` puis `hidden=true`, couvrant le logout explicite, toute réponse API `401` via `endSession()`, le démarrage et la synchronisation du prototype.
- `app.replaceChildren()` supprime immédiatement la page métier rendue. Aucun tableau Dashboard/Finance, projet, devis ou planning ne subsiste dans `#app` après la fin de session.

### Focus et accessibilité

- Le login est rendu visible avant le transfert de focus.
- Si le focus n'est pas déjà dans la connexion, l'adresse email reçoit le focus avec `preventScroll:true`. Un contrôle situé dans un overlay ou dans le shell caché n'est donc pas laissé actif.
- `hidden` retire les quatre surfaces de l'affichage et de l'arbre d'accessibilité ; `inert` interdit en plus interaction et navigation clavier, y compris pendant les transitions.

### Réactivation après connexion

- Quand `state.user` redevient défini, `syncAuthenticatedSurfaces(true)` enlève `hidden`/`aria-hidden`/`inert` du shell et enlève `inert` des overlays, qui restent fermés grâce à leur `hidden=true` jusqu'à une action autorisée.
- La modal de réservation réinitialise et repeuple son formulaire à l'ouverture ; le tiroir Stock reconstruit son corps depuis le contexte courant ; la recherche vide sa saisie et ses résultats avant de s'afficher. Aucune ancienne vue cachée n'est rouverte automatiquement après reconnexion.
- Les wrappers Finance, Pilotage, Actuals, Clients, Commercial, Organisation et Stock continuent de déléguer au rendu de base sans utilisateur. Ils ne contournent donc pas la neutralisation centralisée.

## P2 suivis, non bloquants

1. `tests/foundations.test.js` reste un contrôle statique de chaînes. Il vérifie désormais shell, liste des trois overlays, `hidden`, `inert`, purge de `#app` et focus, mais ne simule pas réellement login → overlay → logout/401 → reconnexion. Un test DOM/E2E de ces transitions demeure souhaitable.
2. La purge couvre `#app`, pas les sous-contenus des overlays ni tous les read-models JavaScript. Ils sont cachés et inertes hors session, puis chaque ouverture publique les réinitialise/reconstruit ; aucun chemin de réexposition automatique n'a été trouvé. Une purge mémoire/DOM plus large réduirait néanmoins la rémanence locale, notamment pour un import de fichier interrompu.

## Absence de régression G8

- Le correctif est limité à `app.js`, au contrôle Foundations et au statut ; serveur, OpenAPI, RBAC, Dashboard/Finance, exports XLSX/PDF, Actuals, idempotence et SSE ne changent pas.
- Le rendu authentifié conserve son ordre : réactivation des surfaces, masquage du login, sélection de route puis composition/binding des modules.
- Aucun nouvel appel API, écouteur, fallback, accès réseau ou dépendance n'est ajouté.
- La suite complète reste verte sur le candidat exact.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` et `git rev-parse 08595fc` : `08595fc2e643490c416117210e1b8dd8ddf34ed2` au début de la revue.
- Inspection du diff `593d392..08595fc`, des chemins `endSession()`, logout, login, démarrage, des wrappers de rendu, et des trois fonctions d'ouverture d'overlay : **conforme**.
- `node --check app.js` : **PASS**.
- `node --test tests/foundations.test.js` : **PASS, 16/16**, 0 échec/skip/todo, durée `329,76 ms`.
- `npm test` : **PASS, 339/339**, 0 échec/skip/todo, durée `11,207 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check 593d392..08595fc` : **PASS**.
- Limite : le navigateur contrôlable local n'était pas disponible pour ce re-gate ; aucun résultat visuel ou de navigation clavier n'est affirmé au-delà de l'analyse DOM/flux et des tests automatisés.

Empreintes contrôlées :

```text
app.js                              24a00f070b3677cf920a2d802a16721c7f25d4dd42d72d3fbea14b6fdd6cbddc
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
styles.css                          b26952fc8f08d8c3798c0764a7da2286acb35a53f5abcd03114545c869d6b8a1
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/foundations.test.js           0a09c42af8028fa4676ec9f984c8aa01cb1a4854494b3f55a52674ed14288b80
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW G8 post-E2E est **APPROVED** sur le candidat exact `08595fc2e643490c416117210e1b8dd8ddf34ed2` : 0 P0, 0 P1, 2 P2. L'intégrateur doit reporter ce verdict dans `docs/project-status.md` et rejouer les gates aval impactés sur ce même état applicatif.

---

# Re-REVIEW indépendante G8 — correctif UI post-E2E du shell authentifié

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat applicatif exact : `593d392cd1b29b7d6fe6e92db857f9922b4ee34a` (`fix(ui): hide authenticated shell outside sessions`)

Diff applicatif contrôlé : `5f2b7d13dc034735f26c9c54dcead2a51fc20d6f..593d392cd1b29b7d6fe6e92db857f9922b4ee34a`

Nature : revue seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 1 P1 ouvert, 1 P2.**

Le correctif ferme correctement le flash du shell principal hors session : le document livre `#appShell` avec `hidden` et `aria-hidden="true"`, la règle CSS garantit `display:none!important`, et le rendu synchronise `hidden`, `aria-hidden` et `inert` avant de retourner vers l'écran de connexion. La connexion réactive le shell ; le logout et un `401` passent bien par un nouveau rendu sans utilisateur.

La fermeture reste toutefois incomplète. Trois surfaces authentifiées sont placées hors de `#appShell` et ne sont ni fermées ni neutralisées lors d'un logout ou d'une expiration. Le candidat ne satisfait donc pas encore le critère « interface authentifiée inaccessible hors session » et ne peut pas être approuvé.

## P1 — REV-G8-UI-01 — les overlays authentifiés survivent à la fin de session

`index.html:53`, `index.html:78` et `index.html:82` placent respectivement `#modalBackdrop`, `#commandPalette` et `#stockDrawerBackdrop` après la fermeture de `#appShell`. Ces surfaces peuvent contenir des données de réservation/projet, des résultats de recherche, ou des informations Stock/Maintenance.

`endSession()` (`app.js:39`) invalide le jeton CSRF et le SSE puis appelle `render()`. Le logout (`app.js:172`) met également `state.user=null` puis appelle `render()`. Or le rendu hors session (`app.js:167`) ne modifie que `#appShell`, `#loginScreen` et le message d'expiration : aucun de ces deux chemins ne masque, ne vide ou ne rend inerte les trois overlays.

Conséquence : si une fenêtre métier est ouverte lorsqu'une requête reçoit `401`, elle conserve `hidden=false`, son contenu déjà rendu et ses contrôles focalisables au-dessus de la connexion. Le shell latéral est bien caché, mais des données authentifiées et un dialogue `aria-modal` restent exposés hors session. Le même défaut peut se produire au logout si celui-ci est déclenché par un autre contexte pendant qu'un overlay est ouvert.

Correction attendue : soit inclure toutes les surfaces authentifiées dans un conteneur commun neutralisé hors session, soit centraliser la fin de session pour fermer, rendre inertes et purger explicitement tous les overlays. Le chemin doit aussi restituer le focus à un contrôle de connexion. Ajouter un test de transition réel : connexion, ouverture de chacun des trois overlays, logout puis expiration `401`, vérification que shell et overlays sont cachés/inertes, que la connexion est visible et que le focus y est transféré.

## P2 — REV-G8-UI-02 — le test ajouté est statique et ne couvre aucune transition

`tests/foundations.test.js` vérifie uniquement la présence de chaînes dans HTML/CSS/JavaScript. Il ne démontre ni la transition connexion → application, ni logout/expiration → connexion, ni l'état des overlays, ni le focus et l'arbre d'accessibilité. Ce manque a permis au P1 ci-dessus de rester vert dans les 339 tests. Après correction, une preuve DOM ou E2E doit exercer les deux fins de session, dont un `401` reçu pendant une fenêtre ouverte.

## Contrôles favorables et absence de régression G8

- Le HTML initial masque le shell avant l'exécution JavaScript : aucune navigation authentifiée n'est peinte pendant l'initialisation.
- `render()` réactive de façon cohérente le shell après une connexion valide et masque l'erreur de connexion précédente.
- Les wrappers de rendu Finance, Pilotage, Actuals, Clients, Commercial, Organisation et Stock délèguent vers le rendu de base lorsqu'il n'y a pas d'utilisateur ; le correctif n'est pas court-circuité par ces consommateurs.
- `server.js`, OpenAPI, moteurs Dashboard/Finance, exports XLSX/PDF, réconciliation Actuals, RBAC, idempotence et SSE sont inchangés depuis le candidat G8 approuvé ; la suite complète confirme leur non-régression automatisée.
- Aucun nouveau fallback, accès réseau ou dépendance n'est introduit.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse 593d392` : `593d392cd1b29b7d6fe6e92db857f9922b4ee34a`.
- Inspection du diff `5f2b7d13..593d392`, de `index.html:10-89`, `app.js:37-41`, `app.js:167-172` et des wrappers de rendu : P1 reproduit par le graphe d'état explicite ci-dessus.
- `node --check app.js` : **PASS**.
- `node --test tests/foundations.test.js` : **PASS, 16/16**, 0 échec/skip/todo, durée `319,44 ms`.
- `npm test` : **PASS, 339/339**, 0 échec/skip/todo, durée `8,807 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check 593d392^..593d392` : **PASS**.
- Limite : le navigateur contrôlable local n'était pas disponible ; aucune preuve visuelle ou de navigation clavier n'est revendiquée. Le P1 est déterministe dans la structure DOM et les chemins de fin de session, et doit recevoir un smoke navigateur après correction.

Empreintes contrôlées :

```text
app.js                              cfc158f6d2d9cf8f0d5aa82a83810eb4ac4899f84785a3662ec03d39da48b738
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
styles.css                          b26952fc8f08d8c3798c0764a7da2286acb35a53f5abcd03114545c869d6b8a1
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/foundations.test.js           6b47b94a2b09c3fd116a03a527fb6096265c8142716d3b39b4bdfb9c003578cc
```

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW G8 post-E2E est **CHANGES REQUIRED** sur le candidat exact `593d392cd1b29b7d6fe6e92db857f9922b4ee34a` : 0 P0, 1 P1 (`REV-G8-UI-01`) et 1 P2 (`REV-G8-UI-02`). Retour DEV requis, puis re-REVIEW indépendante et gates aval impactés. L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Gate re-REVIEW ultime indépendante G7-D — options et axe Prestation

Date : 2026-08-24

Reviewer : agent indépendant `g7d_review`

Candidat Git exact : `7051fe4ff4849b1e9849e81b8266d73fa6c2fda6` (`fix(finance): close g7 d analytics gates`)

Diff correctif contrôlé : `5701450..7051fe4`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert ; 3 P2 suivis, non bloquants.**

Les deux blocages restants de la re-review précédente sont fermés. Les sept P1 du candidat G7-D initial sont désormais résolus sur ce candidat exact, sans régression détectée par les preuves ciblées et la suite complète.

## Fermeture des deux P1

### REV-S7D-01 — FERMÉ : options perdues et canonicalisation après autorisation

`financeOccupancy()` construit d’abord `visibleReservations` en appliquant société et `reservationSnapshotAllowed()`, puis canonicalise les groupes uniquement sur ce sous-ensemble autorisé. Les options portant `optionDecision.state === 'lost'` sont exclues à la sélection comme à l’agrégation.

Les régressions couvrent les deux erreurs précédentes :

- gagnant confirmé de 8 h + perdant conservé à l’état `lost` = **8 h planifiées**, sans double comptage ;
- option prioritaire hors scope + option secondaire visible = **8 h visibles**, sans masquage par une réservation inaccessible.

### REV-S7D-03 — FERMÉ : rattachement Prestation des dépenses Projet

La projection des `ProjectCost` propage maintenant `cost.serviceOfferingId || null`. Une dépense Projet de `1 200 EUR` liée à `offering_occ` apparaît dans la dimension `serviceOfferingId` correspondante avec `actualCost=1200`, au lieu de `unmapped`.

## P2 suivis, non bloquants

1. `financeUnbilledOverages()` peut encore exposer des tableaux `actualRecordIds` et `reservationIds` non bornés à l’intérieur d’un item paginé ; un fan-out extrême peut produire une réponse volumineuse.
2. L’UI consomme la première page des read-models sans contrôles de pagination visibles ; l’API permet la navigation, mais pas encore cette surface utilisateur.
3. OpenAPI utilise encore un `FinanceAnalyticsResponse` générique à propriétés libres pour plusieurs réponses métier ; les contrats détaillés gagneraient à être typés séparément.

Limite de couverture inchangée : aucun test S7-D dédié ne rejoue le rollback Occupation byte-exact ni un item non-facturé à très grand fan-out. Aucun de ces points ne constitue un P0/P1 sur ce candidat.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `node --test tests/sprint7-occupancy.test.js` : **8/8 réussis**, 0 échec, durée `91,68 ms`.
- `npm test` hors sandbox : **312/312 réussis**, 0 échec, durée `10,7415 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check 5701450..7051fe4` : **PASS**.
- Sonde option décidée : `plannedCapacityMs=28800000`, soit 8 h.
- Sonde axe Prestation : `dimensionId='offering_occ'`, `actualCost=1200`.
- Empreintes : `server.js` `6f633bd876977b2a05f6e6e09e0236dfd55f89da04ea38afe86a17ced2e2d575`; `app.js` `bd6bfb8fdc7e468e09c37a2eef5fe92c82e4988355976ab35fddaaf29b8b5641`; OpenAPI `9d2410c871f59d7f77aca5b902f1bd77e911c5ad333aad340629e3987283f565`; test S7-D `92c3c4215649220691f2cebb33320adeb22c2973d12e935d87050199e9252598`; test API `69ee260835eae2051ebd40e05162cb6a62e0979621749feae6bc9c39faf2886e`.

## Handoff

Seul `docs/code-review.md` est modifié par cette re-review. Le gate REVIEW G7-D est **APPROVED** sur le candidat exact `7051fe4ff4849b1e9849e81b8266d73fa6c2fda6`. L’intégrateur doit reporter ce verdict dans `docs/project-status.md` et s’assurer que les gates aval portent sur le même état applicatif.

---

# Gate re-REVIEW indépendante G7-D — correctifs occupation et rentabilité

Date : 2026-08-24

Reviewer : agent indépendant `g7d_review`

Candidat Git exact : `57014500241b512eda1c202475f6793a9be213eb` (`fix(finance): reconcile g7 d analytics`)

Diff correctif contrôlé : `5f61fd4..5701450`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 2 P1 ouverts, 3 P2.**

Les corrections ferment cinq des sept P1 initiaux et une partie des deux autres. Le candidat reste cependant bloqué : l’occupation des doubles options est encore fausse après décision et en scope restreint, et une dépense Projet explicitement liée à une prestation reste perdue dans l’axe de rentabilité Prestation.

## P1 encore ouverts

### REV-S7D-01 — double option : perdant décidé et scope courant restent mal réconciliés

La nouvelle sélection canonique choisit une option par `optionGroupId` et priorité, mais elle est construite sur toutes les options de la société avant `reservationSnapshotAllowed()` (`server.js:3706-3710`). Deux erreurs en résultent :

1. Après confirmation du gagnant, celui-ci devient `confirmed` et perd ses métadonnées de groupe, tandis que le perdant reste `option` avec `optionDecision.state='lost'`. Le code choisit alors ce perdant comme seule option canonique et additionne gagnant et perdant. Sonde fraîche : deux créneaux de 8 h produisent `plannedCapacityMs=57 600 000` (16 h), au lieu de `28 800 000`.
2. Une option de priorité supérieure située hors Site/scope peut être choisie comme canonique, puis être rejetée lors du parcours autorisé ; l’option visible de priorité inférieure est néanmoins supprimée. Sonde fraîche : l’acteur limité au Site visible reçoit `plannedCapacityMs=0` au lieu de 8 h.

La canonicalisation doit ignorer les décisions perdues et s’exécuter sur le sous-ensemble autorisé avant agrégation. Des tests doivent couvrir le couple gagnant confirmé/perdant conservé et un groupe traversant deux scopes.

### REV-S7D-03 — la dimension Prestation ignore encore le rattachement des dépenses Projet

Les `ProjectCost` sont désormais ajoutés aux lignes de rentabilité, ce qui ferme les axes Projet, Client et Site. Cependant, leur projection force `serviceOfferingId:null` (`server.js:1552`) même lorsque le modèle persistant porte `cost.serviceOfferingId` et que `projectCostAllowed()` a validé cette prestation.

Sonde fraîche : une dépense de `1200` liée à `serviceOfferingId='offering_occ'` apparaît uniquement sous `dimensionId='unmapped'` dans `financeProfitability(..., dimension:'serviceOfferingId')`. L’axe obligatoire « prestation » de `US-091` reste donc incorrect.

## P1 initiaux fermés

- **REV-S7D-02 — FERMÉ.** `financeMargins()` exclut les révisions dont la fin est postérieure à `asOf`; le test avant/après confirme coût réel `0`, puis `5200` après réalisé et dépense.
- **REV-S7D-04 — FERMÉ.** Le seuil Société exige désormais `organizationScope`; le replay global revalide la même autorité. Le test HTTP confirme `403 ORGANIZATION_SCOPE_REQUIRED` avant seuil, marqueur idempotent ou audit.
- **REV-S7D-05 — FERMÉ.** Le non-facturé expose `reservationIds`, `actualRecordIds` et `suggestedAction:'createComplementaryQuote'`; l’UI affiche les réservations et l’action sans inclure la valeur au CA signé/facturé.
- **REV-S7D-06 — FERMÉ.** L’analyse tarifaire publie remise et marge pondérées. Une référence catalogue absente produit désormais `catalogueReferenceStatus:'unavailable'` et des valeurs catalogue/remise `null`, sans repli trompeur.
- **REV-S7D-07 — FERMÉ pour les collections.** Les quatre read-models exposent `page`, `pageSize`, `pageCount` et `itemCount`; les limites sont documentées et le test récupère correctement une deuxième page de 50 éléments.

## P2 — importants, non bloquants isolément

1. Les collections sont paginées, mais `financeUnbilledOverages()` ne borne plus `actualRecordIds` ni `reservationIds` à l’intérieur d’un même item. Une ligne commerciale avec un grand nombre de réalisés peut donc produire une réponse volumineuse malgré `pageSize`; un `sourceCount` avec tranche bornée, comme pour la rentabilité, serait préférable.
2. L’UI charge uniquement la première page des nouveaux read-models et n’offre aucun contrôle page suivante. L’API permet désormais de récupérer toute la collection, mais la surface de contrôle n’expose pas encore ce parcours.
3. OpenAPI conserve un schéma générique `FinanceAnalyticsResponse` à propriétés libres pour quatre réponses métier différentes. Pagination et filtre Projet sont maintenant documentés, mais les unités, statuts, seuils, provenance et actions ne sont toujours pas validables sémantiquement.

## P2 initial SSE — fermé

`startEvents()` reconnaît maintenant `occupancyThreshold.*` et recharge Finance comme pour les tarifs de coût et dépenses Projet. La fraîcheur inter-session du seuil est donc raccordée au SSE existant.

## Migration, rollback et compatibilité

- Aucun changement de migration/rollback dans ce correctif ; la migration additive, son marqueur/digest, la sauvegarde privée et l’export obligatoire du rollback restent conformes à la revue initiale.
- Le runtime reste local CommonJS/JSON, sans dépendance ni accès réseau ajouté.
- Les règles `finance.read`, `finance.cost.manage`, CSRF, société/Site et SSE après commit restent centralisées.
- La limite de couverture déjà notée demeure : aucun test S7-D dédié ne rejoue le rollback Occupation byte-exact ni un item non-facturé à très grand fan-out.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `node --test tests/sprint7-occupancy.test.js` : **7/7 réussis**, 0 échec, durée `90,91 ms`.
- `npm test` hors sandbox : **311/311 réussis**, 0 échec, durée `8,247 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check 7fc17d5..5701450` : **PASS**.
- Sonde option décidée : gagnant confirmé + perdant `optionDecision.state=lost` donnent 16 h au lieu de 8 h.
- Sonde scope : option prioritaire hors Site + option secondaire visible donnent 0 h au lieu de 8 h dans le périmètre visible.
- Sonde Prestation : dépense liée à `offering_occ` agrégée sous `unmapped`.
- Empreintes : `server.js` `de8a479429e02a664ddcd24eaf06219c9c53cfb78e27fee8f4b84f433500da51`; `app.js` `bd6bfb8fdc7e468e09c37a2eef5fe92c82e4988355976ab35fddaaf29b8b5641`; OpenAPI `9d2410c871f59d7f77aca5b902f1bd77e911c5ad333aad340629e3987283f565`; test S7-D `4ad258132ac40e7d450a257882651341f9517515e7477be9cd4658a74c390c85`; test API `69ee260835eae2051ebd40e05162cb6a62e0979621749feae6bc9c39faf2886e`.

## Handoff

Seul `docs/code-review.md` a été modifié. Le candidat retourne en DEV pour les deux P1 ci-dessus, puis doit repasser une re-REVIEW indépendante et les gates aval impactés. L’intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Gate REVIEW indépendante G7-D — occupation et rentabilité

Date : 2026-08-23

Reviewer : agent indépendant `g7d_review`

Candidat applicatif exact : `5f61fd4` (`feat(finance): add occupancy profitability analytics`)

HEAD documentaire contrôlé : `5dcbd7a` (`docs(status): record sprint 7 d candidate`)

Diff fonctionnel : `c556024..5f61fd4`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 7 P1 ouverts, 3 P2.**

Le candidat ne peut pas être approuvé. Les tests existants sont verts, mais plusieurs critères explicites de `US-089` à `US-093` ne sont pas implémentés ou produisent des agrégats incorrects. Les constats ci-dessous imposent un retour en DEV, puis une nouvelle REVIEW indépendante et la reprise des gates aval impactés.

## P1 — bloquants

### REV-S7D-01 — les doubles options sont comptées plusieurs fois

`financeOccupancy()` additionne chaque réservation `option` sans regrouper `optionGroupId` ni appliquer `optionPriority` (`server.js:3704-3708`). Cela contredit directement la règle de la spécification : « Les doubles options ne sont comptées qu’une fois selon leur groupe/priorité canonique. »

Une sonde fraîche construite à partir de la fixture S7-D, avec deux options de 8 h sur la même ressource et le même groupe, retourne `plannedCapacityMs=57 600 000` (16 h), au lieu de `28 800 000` (8 h). Le taux d’occupation et les alertes `US-089/090` sont donc faux dans un cas métier déjà supporté par le Planning.

### REV-S7D-02 — la rentabilité à date inclut des coûts réalisés futurs

`financeProfitability()` délègue à `financeMargins()` (`server.js:3714`), dont la boucle des réalisés ne borne ni `revision.endsAt` ni `confirmedAt` par `asOf` (`server.js:1548-1552`). Une requête historique peut ainsi inclure un coût réel postérieur à sa date de situation.

Sonde fraîche : sur la fixture S7-D, `asOf=2026-08-31` retourne `actualCostMinor=4000` alors que la révision réalisée commence et se termine le 1er septembre. `US-091` n’est donc pas historiquement réconciliable.

### REV-S7D-03 — les dépenses Projet disparaissent des axes de rentabilité

`financeMargins()` ajoute les `ProjectCost` confirmés uniquement à ses totaux globaux (`server.js:1552-1554`) et ne les ventile jamais dans `items`. Or `financeProfitability()` agrège exclusivement ces `items`. Même l’axe obligatoire `projectId` omet donc les dépenses Projet, tandis que le total de marge de la source peut les inclure. Les axes Projet/Site/Prestation de `US-091` ne réconcilient pas les mêmes revenus et coûts que les formules Finance publiées.

### REV-S7D-04 — un acteur limité à un Site peut modifier le seuil global Société

La mutation `/api/v1/finance/occupancy-thresholds` exige bien `finance.cost.manage`, mais accepte `siteId=null` sans exiger `organizationScope` (`server.js:2808`). Le contrôle de scope n’est exécuté que lorsque `siteId` est non nul. Un gestionnaire Finance limité à un seul Site peut donc créer ou remplacer le seuil global appliqué à tous les Sites de la société. Le rejeu idempotent conserve le même défaut avec `(!item.siteId || siteAllowed(...))`.

Il faut refuser le scope global à tout acteur non organisationnel et ajouter un test HTTP négatif vérifiant absence d’écriture, d’audit et de SSE.

### REV-S7D-05 — le non-facturé n’est pas drillable jusqu’à la réservation et n’est pas actionnable

La réponse `financeUnbilledOverages()` expose Devis, version, ligne et `actualRecordIds`, mais omet le `reservationId` pourtant présent sur chaque `ActualRecord`, et n’expose aucune action commerciale suggérée (`server.js:3715`). `accountingStatus:'unbilled'` décrit un état, pas l’action prévue par la spécification.

`US-092` exige explicitement « Devis/ligne/réservation sources et action commerciale suggérée ». L’interface affiche seulement Projet, Devis/ligne, quantité, valeur et statut (`app.js:362`) ; elle ne permet donc pas le drill-down demandé.

### REV-S7D-06 — l’analyse tarifaire ne livre pas la marge moyenne et peut inventer une référence catalogue

`financeRateDiscounts()` calcule uniquement `weightedDiscountBps`; aucun coût/marge ni moyenne de marge pondérée n’est renvoyé (`server.js:3716`). La moitié « remise et marge moyennes » de `US-093` est absente.

De plus, en l’absence de tarif catalogue applicable, `reference` se replie sur `appliedRateSnapshot.resolvedSaleUnitMinor`, puis sur le prix réel. La réponse présente alors cette valeur comme `catalogueUnitPriceMinor` avec `catalogueRateId:null`, au lieu d’un état explicite `unavailable`. Une grille Client/Projet peut ainsi être faussement qualifiée de catalogue et produire une remise trompeuse.

### REV-S7D-07 — les listes bornées sont tronquées sans pagination exploitable

Les quatre read-models effectuent des `slice` fixes (`1000`, `200`, `500`, `500`) tout en n’acceptant ni `page/pageSize` ni curseur. Au-delà de la limite, `itemCount` annonce davantage d’éléments mais le consommateur ne peut jamais récupérer la suite. Cela viole le contrat S7 « listes paginées et filtres bornés » et rend incomplets les contrôles d’occupation, de sources de rentabilité et de non-facturé sur les volumes de référence.

## P2 — importants, non bloquants isolément

1. Le frontend reçoit `occupancyThreshold.updated.v1`, mais `startEvents()` ne recharge Finance que pour `costRate|projectCost`; une modification de seuil par une autre session reste donc obsolète jusqu’à un rechargement manuel (`app.js:54`).
2. OpenAPI décrit les quatre réponses avec un objet générique `FinanceAnalyticsResponse` à `additionalProperties:true`. Les unités, statuts, seuils, identifiants sources et formules ne sont pas contractuels ; `/analytics/rate-discounts` omet même le filtre `projectId` accepté par le runtime.
3. Les quatre tests S7-D appellent surtout les fonctions exportées. Aucun test HTTP dédié ne couvre RBAC, scope global/Site, CSRF, idempotence/version/audit/SSE de seuil, pagination, migration réelle ou rollback byte-exact. Le rollback existe et exige un export, mais sa preuve automatisée manque sur ce lot.

## Éléments conformes observés

- La migration est additive, ordonnée après S7 Finance, conserve une sauvegarde privée et vérifie marqueur/digest/état au rejeu ; le rollback exige un export distinct avant restauration.
- Les maintenances/indisponibilités superposées sont fusionnées par ressource avec capacité bornée ; la capacité disponible ne devient pas négative.
- La période d’occupation est bornée à 366 jours et le dénominateur nul produit des taux `null` avec statut textuel `unavailable`.
- Les routes de lecture exigent `finance.read`; les agrégations filtrent société, Site, Projet, Client, Devis, Ressource et Réalisé via les helpers centraux avant les totaux.
- Le non-facturé reste explicitement hors CA signé et hors CA facturé ; aucune mutation commerciale automatique n’est déclenchée.
- L’UI échappe les valeurs, expose des régions tabulaires focusables et complète la couleur par des libellés textuels.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `node --test tests/sprint7-occupancy.test.js` : **4/4 réussis**, 0 échec.
- `npm test` hors sandbox, après un premier essai limité par `listen EPERM` : **307/307 réussis**, 0 échec, durée `8,701 s`.
- `node --check server.js` et `node --check app.js` : **PASS**.
- `git diff --check` avant rédaction : **PASS**.
- Sonde double option : deux options du même groupe de 8 h donnent `plannedCapacityMs=57 600 000` au lieu de `28 800 000`.
- Sonde temporelle : `financeProfitability(..., asOf:'2026-08-31')` inclut `actualCostMinor=4000` provenant d’un réalisé du 1er septembre.
- Empreintes contrôlées : `server.js` `4ae25134dfff067b8e438204f168cf6faf04c84d06b44453f1be44199aa02d93`; `app.js` `bc53201ac1e56619ea9ea3212b0c488e54fd73e1255c34c1eed4d51d3100eaca`; OpenAPI `f677c159e2e412e966dd6eb421132f7a788ee08a36ef6053c69f15b1a32f413d`; test S7-D `8b5bfcc8387c25385a83c869621ddc2e4ea892b522a6686b8b1bce25b69669d0`.

## Handoff

Seul `docs/code-review.md` a été modifié. L’intégrateur doit reporter le verdict bloquant dans `docs/project-status.md`. Toute correction du code, des tests ou de l’OpenAPI invalidera cette revue et exigera une re-REVIEW indépendante sur les nouvelles empreintes.

---

# Gate re-REVIEW indépendante S7-C — réconciliation temporelle et compléments

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review`

Candidat Git exact : `05f65c54851701e2ada724d22fed7987edfeef08` (`fix(finance): reconcile forecast sources`)

Diff correctif contrôlé : `43bea95f74ad6d6bcb602254c25deff7e9f1205e..05f65c54851701e2ada724d22fed7987edfeef08`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert. Quatre P2 restent suivis.**

Les quatre P1 de la REVIEW précédente sont fermés. Les read-models utilisent maintenant la date de situation pour les réalisés, conservent les montants lors de la ventilation, portent la version commerciale dans des schémas structurés et répartissent le dépassement principal sur les compléments acceptés visibles avant de calculer le billable.

## Fermetures confirmées

### REV-S7C-01 — date de situation et attribution par source : FERMÉ

- `financeFlowLineRows()` exclut une révision dont la date de fin est postérieure à `asOf`; les tests vérifient le même réalisé absent au 31 août puis présent au 30 septembre.
- `financeFlowAnalyticRows()` ne date plus une ligne agrégée sur une source arbitraire. `sourceRows()` ventile séparément chaque réservation sur `startsAt` et chaque réalisé/billable sur `endsAt`, tout en conservant exactement le montant cible sur la dernière tranche.
- Les filtres `from/to` de `revenueChain()` s'appliquent donc après une attribution temporelle par source, et non après écrasement sur première/dernière date.

### REV-S7C-02 — conservation des arrondis : FERMÉ

- Le forecast initialise un budget monétaire avec `backlogMinor`, borne chaque tranche arrondie par le solde disponible et affecte le reliquat exact à `unscheduledMinor`.
- Par construction, les tranches consommées et le reste ne peuvent ni dépasser ni perdre le backlog de la ligne. La ventilation analytique utilise également le reliquat sur sa dernière source.
- Le test de montant indivisible vérifie la borne de conservation et la cohérence fenêtre/drill-down.

### REV-S7C-03 — version du Devis et OpenAPI : FERMÉ

- Chaque ligne capture `revenueRecognition.quoteVersionId`, avec repli sur `currentVersionId` pour les documents compatibles existants.
- Backlog et forecast propagent `quoteVersionId`; les deux tests nominaux le vérifient.
- OpenAPI remplace les objets libres par `FinanceBacklogItem` et `FinanceForecastItem`, avec `quoteId`, `quoteVersionId`, `quoteLineId` et les montants/quantités structurés.

### REV-S7C-04 — principal et compléments acceptés : FERMÉ

- Le regroupement s'effectue après construction des seules lignes autorisées. Un complément hors scope n'entre donc ni dans la capacité vendue visible ni dans le transfert des sources.
- `moveOverflowToComplements()` conserve sur la ligne principale sa capacité vendue, transfère ensuite les fractions de réservations/réalisés vers les compléments visibles jusqu'à leur capacité, puis laisse uniquement le surplus non couvert sur la principale.
- Toutes les quantités et valeurs backlog/earned/billable sont recalculées après cette répartition. Le cas principal 10 + complément 2 + réalisé 12 donne CA signé/produit 120, backlog 0 et billable 0.

## Compatibilité et consommateurs

- Aucun changement de persistance, migration ou rollback : S7-C reste un read-model à la demande.
- Les permissions `finance.read`, scopes Société/Site/Client/Projet/Devis/Ressource et filtrages avant agrégation sont conservés.
- L'UI et le SSE sont inchangés par le correctif ; le format ajouté reste compatible avec les consommateurs existants et enrichit le drill-down.
- Les stages `invoiced` et `collected` restent indisponibles ; aucun billable n'est ajouté au CA signé.

## P2 importants / limites

1. Aucun test négatif dédié ne combine explicitement un principal visible avec un complément hors scope. La construction à partir des seules `rows` autorisées ferme le canal, mais cette invariance mérite une non-régression directe.
2. Plusieurs compléments sont ordonnés par identifiant opaque. C'est déterministe, mais une règle métier explicite (séquence/version/date d'acceptation) serait préférable lorsque leurs prix unitaires diffèrent.
3. OpenAPI exige un `quoteVersionId` chaîne alors que le code possède un dernier repli `null`. Les invariants actuels des Devis acceptés fournissent une version, mais un test de base historique incomplète devrait verrouiller la réponse ou produire une erreur stable.
4. Le drill-down reste tronqué à 200 éléments sans curseur/pagination exploitable pour parcourir tous les items.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `node --test tests/sprint7-forecast.test.js tests/sprint1-data.test.js` : **21/21 réussis**, 0 échec, durée `672,04 ms`.
- `npm test` : **303/303 réussis**, 0 échec, 0 ignoré, durée `8,056 s`.
- `node --check server.js && node --check tests/sprint7-forecast.test.js` : **PASS**.
- `git diff --check 43bea95f..05f65c5` : **PASS**.
- Hashes : `server.js` `fe2c0714ae125515ab4faa61c6141518ac5ad860654e2247bc1fbd8281f456ca`; `app.js` `608f84b3235c746e997077e596d562c9b3588d3af52fc650de7333806285f571`; `tests/sprint7-forecast.test.js` `25948794870bc01963e8d96505d62cd868713c7052a94b5a4c060238490d8351`; OpenAPI `019e16ad0c2dc531fc5670a6525da4aa24efa877ecdc9e296c2af3e802dfb8d3`.

L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Gate REVIEW indépendante S7-C — backlog signé et forecast 30/60/90

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review`

Candidat Git exact : `43bea95f74ad6d6bcb602254c25deff7e9f1205e` (`feat(finance): add signed backlog and forecast`)

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**REJECTED — 0 P0, 4 P1 ouverts, 3 P2.**

Les routes, read-models, scopes et consommateurs UI sont présents, sans persistance nouvelle. Les tests nominaux passent. Le candidat ne peut cependant pas être approuvé : trois erreurs de conservation/date déjà observables dans le cœur de calcul et l'absence de version commerciale dans le drill-down empêchent US-083/084 de fournir un backlog/forecast exact et réconciliable.

## P1 bloquants

### REV-S7C-01 — `asOf` ne borne ni les réalisés ni la chaîne de revenus

`financeFlowLineRows()` valide et retourne `asOf`, mais collecte toutes les réservations actives et toutes les révisions courantes visibles sans comparer leurs dates à cette date de situation (`server.js:1528-1559`). Un réalisé dont `endsAt` est postérieur à `asOf` réduit donc déjà `earnedSignedRevenueMinor` et le backlog historique. Le forecast calcule ensuite son `remaining` à partir de ce réalisé futur et sous-estime les fenêtres.

Le même agrégat alimente `revenueChain()`. Pour les filtres de période, toute la valeur planifiée est datée sur la première réservation et toute la valeur réalisée/facturable sur le dernier réalisé (`server.js:2262-2268`) : plusieurs sources couvrant plusieurs périodes sont déplacées vers une date unique. Une requête mensuelle peut ainsi inclure ou exclure la totalité d'une ligne au lieu de sa part dans la période.

Correction requise : sélectionner les sources selon une convention temporelle explicite et testée (`endsAt <= fin de situation` pour le réalisé, règles semi-ouvertes pour planning), puis émettre des lignes analytiques par source/date ou ventiler de manière conservatrice avant les filtres `from/to`. Ajouter des tests avant/après `asOf`, borne exacte et plusieurs mois.

### REV-S7C-02 — la ventilation par réservation ne conserve pas les unités mineures

Dans `financeForecast()`, chaque réservation calcule séparément `roundHalfUpInteger(signed * allocated, sold)` puis le reste non planifié est arrondi séparément (`server.js:1570-1575`). La somme des arrondis n'est pas contrainte au montant signé restant. Exemple arithmétique : 2 centimes vendus pour 3 milli-unités, répartis en trois réservations d'une unité, donnent trois arrondis de 1 centime, soit 3 centimes planifiés pour 2 signés. L'inverse peut aussi perdre des centimes.

Cela viole `total = scheduled + unscheduled` sans double comptage et empêche la réconciliation du forecast avec le backlog. Correction requise : allouer par différences cumulées ou attribuer explicitement le reliquat déterministe à la dernière tranche, avec invariants par ligne et par fenêtre. Tester montants indivisibles, plusieurs réservations, reste non planifié et horizons cumulés.

### REV-S7C-03 — le drill-down US-083 ne porte pas la version du Devis

US-083 exige un chemin jusqu'au Devis, **à sa version** et à ses lignes. `financeFlowLineRows()` expose `quoteId`, `quoteNumber` et `quoteLineId`, mais ne capture ni `revenueRecognition.quoteVersionId`, ni `currentVersionId` (`server.js:1551-1558`). `financeBacklog()` et `financeForecast()` propagent donc des lignes sans version, et les schémas OpenAPI ne rendent pas ce lien obligatoire.

Sur un modèle commercial versionné, un montant live sans identifiant de version n'est pas une provenance revalidable et peut devenir ambigu après succession/version. Correction requise : porter la version acceptée figée dans les deux read-models, le contrat OpenAPI, l'UI/drill-down et les tests.

### REV-S7C-04 — les compléments acceptés ne couvrent pas le réalisé de leur ligne source

La formule contractuelle définit `sold = devis principal accepté + compléments acceptés`. Le dépôt possède déjà `actualIndexes().complementByLine` et `actualCommercialSummary()` additionne les quantités des compléments visibles à la ligne principale (`server.js:1313-1338`). Le nouveau `financeFlowLineRows()` ignore cette relation : il traite chaque document accepté et chaque ligne isolément, avec `soldQuantity = line.quantityMilli` (`server.js:1551-1557`).

Conséquence : un dépassement réalisé sur la ligne principale reste présenté comme `billable`, tandis que le complément accepté correspondant apparaît séparément comme backlog entièrement non produit. La chaîne planned/actual/billable n'est donc pas cohérente avec le moteur de consommation existant et peut simultanément surévaluer le facturable et le backlog. Correction requise : réutiliser une projection canonique principal + compléments, rattacher les sources réalisées aux quantités acceptées correspondantes et tester principal 10 + complément 2 + réalisé 12, avec et sans scope sur le complément.

## Contrôles conformes

- Les endpoints `/analytics/backlog` et `/analytics/forecast` restent protégés par `finance.read` via la famille `/analytics`.
- Société, Projet, Client, site, Devis, ressource/prestation, réservation et réalisé sont filtrés avant les totaux dans le chemin nominal ; le test de ressource hors scope retourne zéro.
- Les quantités et montants sont manipulés en `BigInt` et chaînes d'unités mineures ; aucune arithmétique flottante n'est introduite côté serveur.
- `invoiced` et `collected` restent explicitement indisponibles ; `billable` demeure séparé du CA signé.
- S7-C est un read-model sans nouvelle collection, mutation, audit ou migration. Le rollback annoncé peut retirer routes/UI sans réécrire les données S7-A/B.
- L'UI échappe les libellés et identifiants affichés, utilise des régions/tableaux et rafraîchit Finance sur invalidations Réservation/Réalisé ; aucun nouveau sink HTML non échappé n'a été identifié dans le diff.
- Les contrats OpenAPI publient les deux routes, les définitions, fenêtres et montants sous forme de chaînes.

## P2 importants

1. `items` est tronqué à 200 tandis que `itemCount` indique le total, sans paramètres de pagination ni curseur pour parcourir le drill-down complet.
2. Le choix de `projectEndDate || projectStartDate` comme cible du non-planifié n'est pas accompagné d'un champ de provenance indiquant laquelle des deux dates a été retenue.
3. Les tests UI/API S7-C sont principalement statiques ou purement domaine ; ils ne couvrent pas le rendu navigateur, le focus, l'erreur partielle d'un des cinq appels Finance ni le rafraîchissement SSE complet.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `node --test tests/sprint7-forecast.test.js tests/sprint1-data.test.js` : **19/19 réussis**, 0 échec, durée `764,63 ms`.
- Inspection du diff `37a1337..43bea95f`, de la spécification US-083/084, des formules, consommateurs, OpenAPI et tests.
- Hashes : `server.js` `968894ca91f230d4c6886c1b509156be997a5c4bfe8ff0004bacf716e676c197`; `app.js` `608f84b3235c746e997077e596d562c9b3588d3af52fc650de7333806285f571`; `tests/sprint7-forecast.test.js` `75ea47313ca1f6b4f8cd1de313fadeee77bbe341430d0220c62377455a983bff`; OpenAPI `6415d6ef5247a2ae08143f6662c42dbdae286727420845eddc51cb4fdf9f0a4a`.
- Aucune campagne longue supplémentaire n'a été lancée après identification des défauts bloquants. La suite complète DEV annoncée ne ferme pas les cas limites absents des tests.

## Condition de revalidation

Corriger les quatre P1, ajouter les non-régressions datées/conservatives/versionnées/compléments, puis repasser REVIEW et tous les gates aval impactés sur un même hash candidat. L'intégrateur doit reporter ce verdict dans `docs/project-status.md`.

---

# Gate re-REVIEW indépendante terminale S7-B — import de grille Client

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review_terminal`

Candidat Git exact : `37a133762bc7626cc9b51bc9577a52a44c3820ec` (`fix(clients): align rate import permissions`)

Diff correctif contrôlé : `3819b0d3490531082fc4efe26c44fffed44f388d..37a133762bc7626cc9b51bc9577a52a44c3820ec`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert. Trois P2 restent suivis sans bloquer cette re-REVIEW.**

Le P1 d'alignement du consommateur Clients est fermé. L'action « Importer Excel » n'est rendue que si l'acteur possède simultanément `client.manage` et `finance.cost.manage`; les fonctions d'ouverture, de prévisualisation et de confirmation répètent toutes le même contrôle avant de toucher l'état du drawer ou d'appeler l'API. Les gardes serveur SEC-S7B-11 du candidat précédent restent inchangées et la suite complète ne révèle aucune régression.

## Fermeture confirmée

1. **Visibilité de l'import : FERMÉ.** La surcharge finale de `clientDetailProfessionalPage()` retourne la vue complète seulement avec les deux permissions. Sinon, elle retire le bouton `data-client-rate-import` et remplace l'invitation à importer par un message indiquant que l'activation est réservée aux responsables des coûts (`app.js:636-643`).
2. **Ouverture directe : FERMÉ.** `openClientRateDrawer()` refuse sans `client.manage` ou sans `finance.cost.manage` avant d'appeler l'ancienne fonction ; aucun éditeur, fichier ou handler n'est alors initialisé (`app.js:644-648`).
3. **Prévisualisation : FERMÉ.** `previewClientRates()` refait le double contrôle, neutralise l'événement et n'appelle pas `/rate-card-import/preview` lorsque l'autorité manque (`app.js:649-653`). Cela protège aussi un drawer ancien resté ouvert après réduction dynamique de permissions.
4. **Confirmation : FERMÉ.** `confirmClientRates()` refait le double contrôle avant de lire la sélection ou d'appeler `/rate-card-imports` (`app.js:654-658`). La garde serveur indépendante continue d'exiger `finance.cost.manage` avant lecture du corps, stockage et mutation.
5. **Ordre des consommateurs : COHÉRENT.** Ces quatre surcharges sont déclarées après les implémentations Clients et avant le dernier wrapper `render()` qui appelle dynamiquement `clientDetailProfessionalPage()`. Aucune réaffectation ultérieure ne les contourne. `bindClientsProfessional()` ne trouve plus de bouton à lier pour un rôle non autorisé.
6. **Parcours autorisé : CONSERVÉ.** Avec `client.manage && finance.cost.manage`, le HTML original et les trois fonctions originales sont appelés sans modification. Les tests Clients existants avec l'administrateur continuent à prévisualiser, activer, relire et rejouer une grille.
7. **SEC-S7B-11 et historique : SANS RÉGRESSION.** Les refus serveur d'une ligne Devis avec coût forgé, de `POST /rates` et de l'activation de grille par Planner restent verts. Projection financière, Audit `rate`, scopes, snapshots, cache JSON, tamper, rollback et atomicité restent verts dans la suite complète.

## P2 — importants non bloquants isolément

1. **Test UI encore statique.** Le test Clients affirme la présence des wrappers et du double prédicat dans le source, sans rendre réellement la fiche avec Planner puis Admin ni déclencher ouverture/prévisualisation/confirmation. Une matrice DOM/browser protégerait le comportement observé et les messages accessibles.
2. **Retrait du bouton par expression régulière.** La visibilité dépend d'une correspondance exacte de classe, attribut et libellé HTML. Une modification cosmétique pourrait faire réapparaître le bouton, même si les trois gardes d'action empêcheraient toujours l'appel API. Construire conditionnellement le bouton serait plus robuste.
3. **Documentation API toujours partielle.** L'OpenAPI documente `POST /rates`, mais ne publie pas encore les opérations de mutation de lignes Devis et d'activation `rate-card-imports` ni leur 403 `FINANCE_COST_MANAGE_REQUIRED`. Ce manque de découvrabilité ne remet pas en cause les gardes exécutées.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `37a133762bc7626cc9b51bc9577a52a44c3820ec` |
| `node --test tests/clients.test.js tests/sprint7-finance.test.js` | **PASS, 24/24**, 0 échec/skip/todo, `1,206 s` |
| `npm test` | **PASS, 297/297**, 0 échec/skip/todo, `8,675 s` |
| `npm run lint` | **PASS** |
| `git diff --check 3819b0d3490531082fc4efe26c44fffed44f388d 37a133762bc7626cc9b51bc9577a52a44c3820ec` | **PASS** |
| Inspection ciblée visibilité, open, preview, confirm, ordre des wrappers et gardes serveur | P1 fermé ; aucun nouveau P0/P1 |

Empreintes SHA-256 du candidat :

```text
server.js                           d5e7adefdde78db2cc9ebdd53613edf5d7abf17d89e7844f0d98e971a397c5e7
app.js                              2af7b4560d9ecd650c7c847ad957b1b702df86f133d79c075b3116cc8d2cf34d
tests/clients.test.js               5ff3d19c19c3da9565e168ff8a0747cd6a15a1209c42147a8d4de30d3e4815cd
tests/sprint7-finance.test.js       041df67f0e9e976566105030ff09529df06b6b093b44711b4090bb0f1c550662
```

## Handoff

- Gate re-REVIEW terminale S7-B : **APPROVED** sur `37a133762bc7626cc9b51bc9577a52a44c3820ec` ; 0 P0/P1, 3 P2 suivis.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ni autre rapport modifié.
- `docs/project-status.md` reste sous responsabilité de l'intégrateur conformément à l'exception de tâche limitée à un fichier.

---

# Gate re-REVIEW finale S7-B — autorité d'écriture des coûts commerciaux

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review_terminal`

Candidat Git exact : `3819b0d3490531082fc4efe26c44fffed44f388d` (`fix(finance): authorize internal cost writes`)

Diff correctif contrôlé : `4c6c2aea1c6b540f427a1a2e9ceb9d2e05c17854..3819b0d3490531082fc4efe26c44fffed44f388d`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 1 P1 ouvert, 2 P2 ouverts.**

SEC-S7B-11 est fermé côté serveur : une valeur `costUnitMinor` fournie dans une ligne de Devis, `POST /rates` et l'activation d'une grille Client exigent tous `finance.cost.manage` avant `mutate()`, stockage de fichier, audit ou SSE. Les négatifs Planner obtiennent le code stable `FINANCE_COST_MANAGE_REQUIRED` et démontrent l'absence de mutation métier. Le lot ne peut cependant pas être approuvé : le consommateur Clients continue d'exposer le parcours complet « Importer Excel » avec le seul `client.manage`, puis échoue désormais en 403 au dernier clic. L'UI n'est donc pas alignée avec la nouvelle autorité serveur.

## P1 — bloquant

### P1-1 — L'import de grille Client reste proposé à un rôle qui ne peut plus l'activer

`clientDetailProfessionalPage()` affiche le bouton `data-client-rate-import` dès que `can('client.manage')` est vrai (`app.js:622`). `bindClientsProfessional()` ouvre ensuite le drawer sans contrôle Finance (`app.js:635`), puis `previewClientRates()` autorise l'upload, l'analyse et présente le bouton « Confirmer et activer la grille » (`app.js:632-633`). Le droit `finance.cost.manage` n'est vérifié nulle part dans ce consommateur ; seul le serveur refuse finalement `confirmClientRates()` (`app.js:634`).

Le rôle Planner possède `client.manage` mais pas `finance.cost.manage`. Il peut donc sélectionner et analyser un fichier, parcourir les correspondances et croire l'activation possible, avant de recevoir le nouveau 403. C'est une régression fonctionnelle directe du correctif et une violation du contrat frontend « permissions visibles et serveur » d'`AGENTS.md`.

Correction attendue : afficher l'action d'import/activation seulement avec `client.manage && finance.cost.manage`, ou conserver une prévisualisation explicitement en lecture seule et masquer/désactiver la confirmation avec une explication accessible. Ajouter un test consommateur réel pour Planner et un positif administrateur.

## Fermetures confirmées

1. **Ligne de Devis forgée : FERMÉ côté serveur.** `quoteLineFromInput()` teste la présence propre de `costUnitMinor` et refuse sans `finance.cost.manage` avant validation, résolution du tarif et mutation (`server.js:2270-2272`). Cela couvre création de document, ajout et modification de ligne, puisque tous ces chemins passent par cette fonction. La résolution automatique d'un coût depuis un tarif autorisé reste possible lorsqu'aucune valeur de coût n'est fournie par le client.
2. **`POST /rates` : FERMÉ.** `createRateCommand()` exige `finance.cost.manage` avant d'entrer dans `mutate()` (`server.js:3541-3544`). Le rôle Planner reçoit 403 avec `FINANCE_COST_MANAGE_REQUIRED`; aucun tarif, marqueur, audit ou événement ne peut être créé par ce chemin.
3. **Activation de grille Client : FERMÉ côté serveur.** La garde est exécutée avant lecture du corps, création de fichier temporaire et mutation (`server.js:3064-3068`). Le négatif vérifie 403 et un nombre de tarifs inchangé. La prévisualisation reste non mutante et accessible avec `client.manage`.
4. **UI Devis : TOUJOURS FERMÉE.** Le correctif précédent masque/désactive `costUnit` et n'ajoute `costUnitMinor` au payload qu'avec `finance.cost.manage`. La nouvelle autorité serveur empêche désormais aussi le contournement par requête forgée.
5. **Spécification : ALIGNÉE.** La spécification Sprint 7 explicite que toute création/modification de coût interne via ligne de Devis, tarif commercial ou activation de grille Client exige `finance.cost.manage`, et que `quote.manage`/`client.manage` seuls ne suffisent pas (`docs/specifications/sprint-7-actuals-finance-engine.md:277-282`).
6. **Régressions historiques : ABSENTES dans les campagnes.** Projection des DTO, Audit `rate`, dashboard Projet, scopes Finance, snapshots, cache JSON, tamper, rollback et atomicité restent verts.

## P2 — importants non bloquants isolément

1. **OpenAPI partiellement aligné.** Le contrat documente correctement le double droit et `costUnitMinor` pour `POST /rates`, mais ne publie toujours pas les opérations de mutation de lignes Devis ni `rate-card-imports`; leurs nouveaux 403 et l'exigence `finance.cost.manage` ne sont donc pas découvrables dans l'OpenAPI.
2. **Preuves négatives d'effets secondaires partielles.** Le refus de ligne vérifie version et nombre de lignes inchangés, et le refus d'import vérifie le nombre de tarifs. Les tests ne comptent pas explicitement marqueurs idempotents, audit, SSE et fichiers d'upload avant/après les trois refus. Les gardes sont statiquement antérieures à ces effets, mais une matrice d'absence totale figerait mieux le contrat.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `3819b0d3490531082fc4efe26c44fffed44f388d` |
| `node --test tests/sprint7-finance.test.js tests/quotes.test.js tests/clients.test.js tests/sprint7-actuals.test.js` | **PASS, 86/86**, 0 échec/skip/todo, `4,435 s` |
| `npm test` | **PASS, 297/297**, 0 échec/skip/todo, `9,017 s` |
| `npm run lint` | **PASS** |
| `git diff --check 4c6c2aea1c6b540f427a1a2e9ceb9d2e05c17854 3819b0d3490531082fc4efe26c44fffed44f388d` | **PASS** |
| Inspection ciblée des gardes, consommateurs, OpenAPI et spécification | SEC-S7B-11 serveur fermé ; 1 P1 UI ouvert |

Empreintes SHA-256 du candidat :

```text
server.js                                               d5e7adefdde78db2cc9ebdd53613edf5d7abf17d89e7844f0d98e971a397c5e7
app.js                                                  abf8882c11b07f132ce8cdcb8e4ce480225194d7be34bb4f7ad06d31e0881d8d
tests/sprint7-finance.test.js                           041df67f0e9e976566105030ff09529df06b6b093b44711b4090bb0f1c550662
tests/clients.test.js                                   04e6a093ac944e51fbc7b5cfd901b88988137914dd9aca977fcf606645c77a14
docs/api/openapi-v1.yaml                                5491260431b6d8869fc6a3cf8a3e43371a169e746d37047eeb7474ceea9acc25
docs/specifications/sprint-7-actuals-finance-engine.md  3c9d664dfd541eb550168e9e459f0b8a0e1f429b21b412ca0392c150ea28b74e
```

## Handoff

- Gate re-REVIEW finale S7-B : **CHANGES REQUIRED** sur `3819b0d3490531082fc4efe26c44fffed44f388d` ; 0 P0, 1 P1, 2 P2.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ni autre rapport modifié.
- `docs/project-status.md` reste sous responsabilité de l'intégrateur conformément à l'exception de tâche limitée à un fichier.

---

# Gate re-REVIEW terminale S7-B — consommateurs commerciaux et RateResponse

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review_terminal`

Candidat Git exact : `4c6c2aea1c6b540f427a1a2e9ceb9d2e05c17854` (`fix(finance): align commercial UI permissions`)

Diff correctif contrôlé : `d7661b7849179c5f04c1652f5b7082259c17c9bf..4c6c2aea1c6b540f427a1a2e9ceb9d2e05c17854`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert. Deux P2 restent suivis sans bloquer cette re-REVIEW.**

Les deux P1 de la REVIEW précédente sont fermés dans le périmètre correctif demandé. Les rôles sans `finance.read` ne voient plus les agrégats Projet, l'onglet Rentabilité ni les outils internes de coût/marge du Devis. La saisie de coût de ligne est masquée/désactivée et le payload navigateur n'inclut `costUnitMinor` qu'avec `finance.cost.manage`. Le contrat `/rates` distingue désormais la réponse complète de sa projection sans coût au moyen de `RateResponse`.

## Fermetures des P1

1. **Vues Projet/Devis sans `finance.read` : FERMÉ.** La surcharge finale de `projectDetailPage()` retire les cartes « Coût estimé » et « Marge estimée » ainsi que le bouton Rentabilité. `projectTabContent()` refuse également ce panneau en défense secondaire. La surcharge finale de `quoteWorkspacePage()` retire le bloc complet `quote-editor-internals`, qui contenait le suivi coût/marge. Les wrappers sont déclarés après les surcharges commerciales antérieures et aucune réaffectation ultérieure ne les contourne (`app.js:668-686`).
2. **Saisie/envoi du coût : FERMÉ dans le consommateur.** Après construction du drawer, `openQuoteLineDrawer()` masque et désactive `costUnit` lorsque `finance.cost.manage` manque. La surcharge finale de `submitQuoteLine()` ajoute `costUnitMinor` au payload uniquement si `can('finance.cost.manage')` et si la donnée existe ; un champ désactivé n'est en outre pas inclus dans `FormData` (`app.js:687-704`). Le fallback zéro qui pouvait écraser un coût depuis le navigateur disparaît donc pour Planner.
3. **Conservation Finance : FERMÉ.** Avec `finance.read`, les wrappers retournent le HTML commercial complet, incluant coûts, marges et rentabilité. Avec `finance.cost.manage`, le champ de coût reste actif et son envoi est conservé. Le correctif n'altère pas les DTO serveur complets déjà validés pour l'administrateur.
4. **OpenAPI conditionnel : FERMÉ.** `POST /rates` référence désormais `RateResponse`; son `oneOf` décrit soit `Rate` complet, soit une projection commerciale exigeant les champs de vente et interdisant explicitement la présence de `costUnitMinor`. La description rattache clairement la variante au droit `finance.read` (`docs/api/openapi-v1.yaml:208-220`, `:1285-1306`).
5. **SEC-S7B-10 et non-régression : SANS RÉGRESSION.** La projection récursive des réponses Devis/catalogue/grilles n'est pas modifiée. Audit `rate`, dashboard API Projet, scopes Finance, snapshots historiques, cache JSON, tamper, rollback et atomicité restent couverts par la suite complète.

## P2 — importants non bloquants isolément

1. **Test consommateur encore statique.** Le nouveau test vérifie les marqueurs source des wrappers et du contrat, mais ne rend pas réellement les vues dans un DOM avec les deux matrices de permissions. Un test navigateur devrait confirmer l'absence des libellés financiers, du champ de coût et de `costUnitMinor` dans le payload, puis leur présence pour Finance.
2. **Masquage UI fondé sur des expressions régulières HTML.** Les wrappers retirent les blocs après génération par correspondance de chaînes. Le comportement actuel est correct, mais une modification de balise/classe/libellé peut rendre le filtre inopérant sans erreur. Construire conditionnellement ces fragments au niveau des fonctions de rendu serait plus robuste.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `4c6c2aea1c6b540f427a1a2e9ceb9d2e05c17854` |
| `node --test tests/sprint7-finance.test.js tests/quotes.test.js tests/clients.test.js tests/sprint7-actuals.test.js` | **PASS, 86/86**, 0 échec/skip/todo, `4,261 s` |
| `npm test` | **PASS, 297/297**, 0 échec/skip/todo, `8,542 s` |
| `npm run lint` | **PASS** |
| `git diff --check d7661b7849179c5f04c1652f5b7082259c17c9bf 4c6c2aea1c6b540f427a1a2e9ceb9d2e05c17854` | **PASS** |
| Inspection ordre des surcharges UI, permissions, payload et schéma OpenAPI | 2 P1 fermés ; aucun nouveau P0/P1 dans le diff |

Empreintes SHA-256 du candidat :

```text
server.js                           5b16de4759502126ed8151ffedf8f92e7f91683605d003c07374c33ffe028fcf
app.js                              abf8882c11b07f132ce8cdcb8e4ce480225194d7be34bb4f7ad06d31e0881d8d
tests/sprint7-finance.test.js       05bbfd5a804fe3d5173d1549104390d53cbdce3af9df43caf200434cf4fb9895
docs/api/openapi-v1.yaml            6a817faf7ded9c942b32a528887c11e1ff37ea275ea986c28945902db59cbc81
```

## Limite d'exécution

Une tentative supplémentaire de smoke API isolé a été interrompue avant résultat exploitable ; elle n'est pas comptée comme preuve. Le verdict repose sur les campagnes ciblée et complète terminées, plus l'inspection statique ciblée demandée.

## Handoff

- Gate re-REVIEW terminale S7-B : **APPROVED** sur `4c6c2aea1c6b540f427a1a2e9ceb9d2e05c17854` ; 0 P0/P1, 2 P2 suivis.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ni autre rapport modifié.
- `docs/project-status.md` reste sous responsabilité de l'intégrateur conformément à l'exception de tâche limitée à un fichier.

---

# Gate re-REVIEW indépendante ultime S7-B — DTO commerciaux Finance

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review_terminal`

Candidat Git exact : `d7661b7849179c5f04c1652f5b7082259c17c9bf` (`fix(finance): restrict commercial cost responses`)

Diff correctif contrôlé : `01e1246ce6083d9a5d060ebc38f4d1f3a369bfed..d7661b7849179c5f04c1652f5b7082259c17c9bf`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 2 P1 ouverts, 2 P2 ouverts.**

Le canal serveur SEC-S7B-10 est fermé sur les réponses JSON inspectées : sans `finance.read`, la projection récursive supprime les coûts, marges et snapshots des listes/détails/versions/mutations Devis, de `quote-catalog`, de `rate-cards`, de `/rates` et des imports de grilles Client ; avec `finance.read`, les objets complets sont conservés. La re-REVIEW ne peut toutefois pas approuver le lot : les consommateurs navigateur interprètent les propriétés supprimées comme des zéros et affichent ainsi des coûts/marges faux, tandis que l'OpenAPI promet toujours un `Rate.costUnitMinor` obligatoire même quand le serveur l'omet.

## P1 — bloquants

### P1-1 — Le frontend affiche des coûts et marges fictifs aux rôles sans `finance.read`

La nouvelle projection serveur omet correctement les propriétés financières, mais les vues commerciales ne vérifient jamais `can('finance.read')` avant de les consommer :

- le dashboard Projet affiche toujours « Coût estimé » et « Marge estimée » en agrégeant `value.costTotal || '0'` et `value.marginAmount || '0'` (`app.js:478`) ;
- l'onglet « Rentabilité » est toujours proposé et calcule la marge comme vente moins coût remplacé par zéro (`app.js:478`, `:497`) ;
- l'espace Devis affiche toujours colonnes, totaux et détail « Coût/Marge » avec les mêmes fallbacks zéro (`app.js:481`) ;
- la vue A4 conserve le bloc « Outils internes / Suivi interne » et rend coût/marge à zéro (`app.js:522`) ;
- l'éditeur reste accessible à `quote.manage`, expose « Coût unitaire », initialise ce coût à zéro lorsque le catalogue projeté n'en fournit plus et renvoie ce zéro dans `costUnitMinor` (`app.js:486-487`, `:505-507`).

Pour un planificateur sans `finance.read`, un Devis réellement coûteux devient donc visuellement un Devis à coût nul ; certaines vues annoncent une marge gonflée, d'autres une marge nulle, et une édition peut écraser le coût interne avec la valeur de fallback. C'est une régression de cohérence et de permission visible, bloquante pour une release Finance.

Correction attendue : conditionner toutes les sections et colonnes financières à `can('finance.read')`, ne jamais fabriquer de zéro quand une propriété est absente, et ne proposer/envoyer `costUnitMinor` qu'avec l'autorité métier décidée pour la gestion de coûts. Ajouter un test frontend négatif avec rôle `quote.manage` sans `finance.read`, ainsi qu'un positif Finance.

### P1-2 — Le contrat OpenAPI contredit la projection conditionnelle de `/rates`

`POST /api/v1/rates` exige `quote.manage`, pas `finance.read` (`server.js:2660`), et sa réponse est maintenant projetée pour un gestionnaire commercial sans Finance (`server.js:2663`). Pourtant l'OpenAPI annonce toujours une réponse `Rate` (`docs/api/openapi-v1.yaml:208-220`) qui hérite de `RateCreateCommand`, où `costUnitMinor` est obligatoire (`:1253-1277`). Le contrat ne documente pas non plus la projection conditionnelle des listes Devis, versions, catalogue et grilles.

Un client strict ou généré conformément au contrat rejettera donc une réponse serveur valide pour ce rôle. La modification de forme n'est ni décrite, ni versionnée, ni représentée par deux schémas selon permission.

Correction attendue : publier des schémas de réponse commerciaux explicites, avec une variante restreinte sans coût/marge et une variante Finance complète (ou rendre la permission requise non ambiguë), puis couvrir leur conformité. La commande d'entrée peut conserver son propre schéma distinct de la réponse.

## Fermetures confirmées

1. **Listes, détails et versions Devis : FERMÉ côté API.** `route.startsWith('/api/v1/quotes')` couvre la liste, le détail, l'historique, le snapshot de version et toutes les sous-commandes. `send()` applique la projection récursive au dernier moment, y compris aux objets imbriqués, replays et détails d'erreur.
2. **Mutations Devis : FERMÉ côté réponse API.** Le PATCH exercé avec le rôle Planner ne contient aucun coût, marge ou snapshot. L'inspection confirme que POST, lignes, statuts, successeurs, conversion et contrôle Planning passent par le même `send()` après que le drapeau de restriction a été fixé.
3. **Catalogue, grilles et tarifs : FERMÉ côté API.** `quote-catalog`, `rate-cards`, `/rates` et les routes Client `rates|rate-card-import*` sont couverts. Le filtre retire `costUnitMinor` à toute profondeur tout en conservant les prix de vente et métadonnées commerciales.
4. **Lecteur Finance : CONSERVATION CONFIRMÉE.** Lorsque `finance.read` est présent, `res.planifyRestrictFinancials` reste faux et `send()` sérialise l'objet original. Le test administrateur retrouve `lines[].costUnitMinor` et `marginAmount`.
5. **Correctifs antérieurs et cache : SANS RÉGRESSION.** Audit `rate`, dashboard Projet, scopes Finance, snapshots historiques, cache JSON immuable, tamper, rollback et atomicité ne sont pas modifiés par ce diff et restent verts dans la suite complète.

## P2 — importants non bloquants isolément

1. **Matrice HTTP négative incomplète.** Le test ajouté exerce liste, détail, liste/détail de versions, catalogue, grilles et un PATCH. Il n'exerce pas explicitement création/replay, ajout/suppression de ligne, changement de statut, successeur, `/rates` POST ni import/preview Client sous un rôle sans `finance.read`; la couverture statique commune est solide, mais ces sorties devraient être figées par une matrice automatisée.
2. **Projection fondée sur une denylist de noms.** Tout futur champ financier portant un autre nom sera publié par défaut. Une construction explicite des DTO restreints, ou au minimum une assertion exhaustive sur les clés financières du modèle, réduirait ce risque d'évolution.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `d7661b7849179c5f04c1652f5b7082259c17c9bf` |
| `node --test tests/sprint7-finance.test.js tests/quotes.test.js tests/clients.test.js tests/sprint7-actuals.test.js` | **PASS, 85/85**, 0 échec/skip/todo, `3,580 s` |
| `npm test` | **PASS, 296/296**, 0 échec/skip/todo, `8,510 s` |
| `npm run lint` | **PASS** |
| `git diff --check 01e1246ce6083d9a5d060ebc38f4d1f3a369bfed d7661b7849179c5f04c1652f5b7082259c17c9bf` | **PASS** |
| Inspection ciblée serveur, consommateurs navigateur et OpenAPI | fuite JSON SEC-S7B-10 fermée ; 2 P1 de cohérence/contrat ouverts |

Empreintes SHA-256 du candidat :

```text
server.js                           5b16de4759502126ed8151ffedf8f92e7f91683605d003c07374c33ffe028fcf
tests/sprint7-finance.test.js       2c065fdc416e7913dad10b1fc96db32d3efabf26ab785462938c1d94ff24ac57
app.js                              67b80cac99763abd2d5dbfe57fadefe5612504978a156b29343d30ce03a6277d
docs/api/openapi-v1.yaml            b3d48360e946ac3d854c22a6915dc398a2fc6951e2f880b6122a882c88a5cb8e
```

## Handoff

- Gate re-REVIEW ultime S7-B : **CHANGES REQUIRED** sur `d7661b7849179c5f04c1652f5b7082259c17c9bf` ; 0 P0, 2 P1, 2 P2.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ni autre rapport modifié.
- `docs/project-status.md` reste sous responsabilité de l'intégrateur conformément à l'exception de tâche limitée à un fichier.

---

# Gate re-REVIEW ultime S7-B — canaux résiduels Audit et dashboard Projet

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review_terminal`

Candidat Git exact : `01e1246ce6083d9a5d060ebc38f4d1f3a369bfed` (`fix(finance): close residual read channels`)

Diff correctif contrôlé : `cf89c30b6568ebfa44efa4c6c26531213f15864f..01e1246ce6083d9a5d060ebc38f4d1f3a369bfed`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert. Trois P2 restent suivis sans bloquer cette re-REVIEW.**

Les deux derniers canaux de lecture financière identifiés sont fermés. Un lecteur `audit.read` dépourvu de `finance.read` reçoit désormais aussi une projection neutralisée pour les événements historiques `entityType: rate`. Un lecteur du dashboard Projet dépourvu de `finance.read` ne reçoit plus `estimatedCost`, `estimatedMargin`, `actualCost` ni `actualMargin`; ces quatre champs restent présents pour le lecteur Finance. Le correctif est localisé, ne modifie pas la persistance ni le cache validé et conserve les fermetures antérieures de scopes, snapshots, tamper, rollback et atomicité.

## Fermetures confirmées

1. **Audit `rate` sans `finance.read` : FERMÉ.** `FINANCE_AUDIT_ENTITY_TYPES` comprend maintenant `rate` aux côtés de `actualRecord`, `costRate` et `projectCost`. Le chemin partagé `auditEventDto()` neutralise `before`/`after`, réduit `details` à la liste blanche non monétaire et ajoute `financialDetailsRestricted: true`. Le test exige la présence effective d'au moins un événement `rate`, puis vérifie la projection de tous les types Finance et l'absence sérialisée de `costSnapshot`, `costUnitMinor`, `amountMinor` et `totalMinor`.
2. **Détail Audit avec `finance.read` : CONSERVÉ.** Le premier branchement de `auditEventDto()` retourne toujours l'événement original pour un lecteur Finance. Le test administrateur retrouve le `costSnapshot` de la révision Actual ; l'ajout de `rate` à l'ensemble de projection n'affecte donc pas les lecteurs autorisés ni le registre persistant.
3. **Dashboard Projet sans `finance.read` : FERMÉ.** Les quatre agrégats de coût/marge sont construits dans un fragment conditionné par `has(auth, 'finance.read')`. Le rôle Viewer obtient encore le dashboard et ses indicateurs non financiers/commerciaux, mais aucune des quatre propriétés sensibles. Le test administrateur confirme symétriquement que les quatre propriétés restent publiées avec `finance.read`.
4. **Consommateurs et contrats internes : SANS RÉGRESSION.** La projection Audit reste appliquée uniquement à la réponse de `/api/v1/audit`; elle ne mutile ni la preuve persistée ni le SSE. Le dashboard conserve ses champs d'identité, de planning, de capacité et de devis. Aucun autre consommateur applicatif n'est modifié par ce diff.
5. **Cache JSON, atomicité, tamper et rollback : SANS RÉGRESSION.** Le diff ne touche pas `readDb()`, `atomicWriteFile()`, `atomicWrite()` ni le rollback. La suite conserve la preuve qu'un hit reparse le JSON exact dans un nouvel arbre, que le cache n'est publié qu'après rename réussi, que les falsifications financières rendent la base indisponible et que le rollback restaure exactement la source après export privé.
6. **P1 historiques Finance : TOUJOURS FERMÉS.** Les négatifs de mutation personne/Projet/Client hors scope, le gel incrémental des snapshots planifiés, la conservation des coûts Actual historiques et le filtrage des marges restent verts dans les campagnes ciblée et complète.

## P2 — importants non bloquants isolément

1. **Matrice positive Audit Finance encore partielle.** Le négatif sans `finance.read` couvre maintenant explicitement les quatre `entityType`, dont `rate`, mais le positif avec `finance.read` affirme le détail complet seulement pour `actualRecord`. Le branchement commun conserve statiquement `rate`, `costRate` et `projectCost`; des assertions positives sur chacun protégeraient mieux ce contrat.
2. **Métadonnées Audit à portée société.** `/api/v1/audit` filtre historiquement par société, pas par site/Projet/entité. Les montants sont neutralisés sans `finance.read`, mais un rôle `audit.read` limité à un site peut encore recevoir des identifiants de provenance autorisés par la liste blanche pour un autre site. Il reste à documenter `audit.read` comme permission société ou à filtrer la provenance avant projection.
3. **Fenêtre de signature concurrente du cache.** Le cache détecte les altérations séquentielles, mais `readDb()` ne démontre pas encore l'égalité entre une signature prise avant lecture et une signature reprise après validation avant publication. Un remplacement externe précisément concurrent reste théoriquement possible ; une double lecture de signature avec égalité exigée fermerait ce cas.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `01e1246ce6083d9a5d060ebc38f4d1f3a369bfed` |
| `node --test tests/sprint7-finance.test.js tests/api.test.js tests/sprint7-actuals.test.js` | **PASS, 65/65**, 0 échec/skip/todo, `2,244 s` |
| `npm test` | **PASS, 295/295**, 0 échec/skip/todo, `8,610 s` |
| `npm run lint` | **PASS** |
| `git diff --check cf89c30b6568ebfa44efa4c6c26531213f15864f 01e1246ce6083d9a5d060ebc38f4d1f3a369bfed` | **PASS** |
| Inspection ciblée du diff, Audit, dashboard, consommateurs et cache | deux canaux résiduels fermés ; aucun nouveau P0/P1 |

Empreintes SHA-256 du candidat :

```text
server.js                           a883b6993d7753360cb153c557e1ea9bfd3f1175e5dfb2a250b524616f952e2d
tests/sprint7-finance.test.js       08c1e92878357c0df2fd16eb92a994768e1cd5da7fbfffa3514b8d66c4103986
app.js                              67b80cac99763abd2d5dbfe57fadefe5612504978a156b29343d30ce03a6277d
docs/api/openapi-v1.yaml            b3d48360e946ac3d854c22a6915dc398a2fc6951e2f880b6122a882c88a5cb8e
```

## Handoff

- Gate re-REVIEW ultime S7-B : **APPROVED** sur `01e1246ce6083d9a5d060ebc38f4d1f3a369bfed` ; 0 P0/P1, 3 P2 suivis.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ni autre rapport modifié.
- `docs/project-status.md` reste sous responsabilité de l'intégrateur conformément à l'exception de tâche limitée à un fichier.

---

# Gate re-REVIEW indépendante S7-B — projection Audit Finance et cache JSON

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review_terminal`

Candidat Git exact : `cf89c30b6568ebfa44efa4c6c26531213f15864f` (`fix(finance): protect audit data and stabilize writes`)

Diff correctif contrôlé : `0aec6303c9b9f5672be4c512277cfca6a6e99988..cf89c30b6568ebfa44efa4c6c26531213f15864f`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert. Trois P2 restent suivis sans bloquer cette re-REVIEW.**

Le P1 de confidentialité Audit Finance est fermé. La route `/api/v1/audit` projette désormais les événements `actualRecord`, `costRate` et `projectCost` selon l'autorité du lecteur : sans `finance.read`, `before` et `after` sont neutralisés, les détails sont réduits à quatre identifiants de provenance non monétaires et un marqueur explicite indique la restriction ; avec `finance.read`, l'événement complet reste inchangé. Le cache validé conserve maintenant le JSON sérialisé exact, reparsé à chaque hit : aucun appelant ne peut muter l'état caché, et le cache n'est publié qu'après le rename atomique réussi.

## Fermetures confirmées

1. **Audit sans `finance.read` : FERMÉ.** `auditEventDto()` couvre les trois agrégats Finance qui transportent des coûts (`actualRecord`, `costRate`, `projectCost`). La projection supprime entièrement les snapshots `before/after`, filtre `details` par liste blanche et ajoute `financialDetailsRestricted: true` (`server.js:1102-1107`). Le test HTTP d'un rôle possédant uniquement `audit.read` confirme l'absence de `costSnapshot`, `costUnitMinor`, `amountMinor` et `totalMinor` sur toutes les entrées Finance retournées (`tests/sprint7-finance.test.js:113-118`).
2. **Audit avec `finance.read` : FERMÉ.** Le premier branchement de `auditEventDto()` restitue l'événement original lorsque `finance.read` est présent. Le test administrateur retrouve la révision Actual et son `costSnapshot`, démontrant que la projection ne détruit pas la preuve financière pour un lecteur habilité. Les anciens consommateurs Audit administrateur de `tests/api.test.js` continuent à lire `before/after` complets.
3. **Consommateur unique cohérent : FERMÉ.** La projection est appliquée juste avant pagination dans le seul endpoint public d'audit (`server.js:3124`). Elle ne modifie ni le registre persistant, ni les événements de domaine, ni le SSE. Les événements non Finance restent inchangés, préservant les parcours d'audit Organisation, Planning, Stock et RBAC.
4. **Cache immuable et isolé : FERMÉ.** Un hit de cache exécute `JSON.parse(validatedDatabaseCache.raw)` ; chaque lecteur obtient donc un nouvel arbre, sans référence partagée (`server.js:1052-1084`). Le test modifie localement un Client issu de `readDb()` puis vérifie qu'une nouvelle lecture conserve la valeur persistée (`tests/sprint7-finance.test.js:31-37`).
5. **Cache aligné sur les octets écrits : FERMÉ.** `atomicWriteFile()` sérialise une fois, écrit le temporaire privé, effectue le rename puis retourne exactement le JSON écrit. `atomicWrite()` publie ce même texte dans le cache uniquement après succès (`server.js:825-831`, `:1086-1092`). Un échec avant rename ne peut donc pas exposer un état non persisté via le cache.
6. **Tamper, rollback et non-régression : SANS RÉGRESSION.** La signature device/inode/taille/mtime/ctime invalide les altérations séquentielles ; les falsifications de révisions, snapshots, références de taux, marqueurs et chaînes restent refusées. Le rollback relit et valide le fichier, exige l'export privé puis remplace atomiquement la source. Scopes Finance, snapshots historiques, marges et écritures Actual bornées restent verts dans les campagnes ciblée et complète.

## P2 — importants non bloquants isolément

1. **Matrice de conservation Audit Finance partielle.** Le négatif sans `finance.read` inspecte les trois types Finance, mais le positif avec `finance.read` affirme explicitement le détail complet seulement pour `actualRecord`. Le branchement est commun et conserve statiquement `costRate`/`projectCost`; ajouter des assertions positives sur leurs montants protégerait mieux ce contrat.
2. **Métadonnées Audit à portée société.** `/api/v1/audit` filtre historiquement par société, pas par site/Projet/entité. La nouvelle projection empêche toute fuite de montant, mais un rôle `audit.read` limité à un site peut encore recevoir des identifiants de provenance autorisés par la liste blanche pour un événement d'un autre site. Clarifier si `audit.read` est volontairement une permission d'audit société ; sinon filtrer les événements selon leur provenance avant projection.
3. **Fenêtre de signature concurrente conservée.** Le cache détecte les altérations séquentielles, mais `readDb()` ne vérifie pas encore que la signature initiale est identique à celle publiée après validation. Un remplacement externe précisément concurrent entre lecture/validation et mise en cache reste théoriquement possible. Exiger deux signatures égales fermerait ce cas sans modifier le modèle JSON.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `cf89c30b6568ebfa44efa4c6c26531213f15864f` |
| `node --test tests/sprint7-finance.test.js tests/api.test.js tests/sprint7-actuals.test.js` | **PASS, 65/65**, 0 échec/skip/todo, `2,234 s` |
| `npm test` | **PASS, 295/295**, 0 échec/skip/todo, `8,769 s` |
| `npm run lint` | **PASS** |
| `git diff --check 0aec6303..cf89c30b` | **PASS** |
| Inspection projection Audit, consommateurs, cache JSON, tamper, rollback et atomicité | P1 Audit fermé ; aucun nouveau P0/P1 |

Empreintes SHA-256 du candidat :

```text
server.js                           e48715d640ae9fb9094e60a89d959da2713313abb21ab4972163328fe7a3a5c8
tests/sprint7-finance.test.js       c15668044402c27700347d1bccb2dc977570dc8281b9ca19e4c8a2388170a2cb
app.js                              67b80cac99763abd2d5dbfe57fadefe5612504978a156b29343d30ce03a6277d
docs/api/openapi-v1.yaml            b3d48360e946ac3d854c22a6915dc398a2fc6951e2f880b6122a882c88a5cb8e
```

## Handoff

- Gate re-REVIEW S7-B : **APPROVED** sur `cf89c30b6568ebfa44efa4c6c26531213f15864f` ; 0 P0/P1, 3 P2 suivis.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ni autre rapport modifié.
- `docs/project-status.md` reste sous responsabilité de l'intégrateur conformément à l'exception de tâche limitée à un fichier.

---

# Gate re-REVIEW indépendante S7-B — scopes Finance, snapshots incrémentaux et cache validé

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review`

Candidat Git exact : `0aec6303c9b9f5672be4c512277cfca6a6e99988`

Diff correctif contrôlé : `b42ea165ed32eeebae0b3f9f2080520bf946d4d8..0aec6303c9b9f5672be4c512277cfca6a6e99988`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert. Trois P2 restent suivis sans bloquer cette re-REVIEW.**

Les deux P1 de mutation Finance hors périmètre sont fermés. Le correctif résout désormais la personne jusqu'à son adhésion active autorisée et résout chaque dépense jusqu'au site du Projet et au Client avant toute création ou modification. La stratégie de coûts planifiés ne rebâtit plus tous les snapshots dans une écriture interactive : elle capture l'état de planification avant mutation, ne fige que les versions de Réservation réellement modifiées et recopie le snapshot antérieur lorsque seuls des champs non financiers changent. Enfin, le cache de base validée est indexé par la signature du fichier actif, n'est publié qu'après l'écriture atomique, retourne des clones et est invalidé par une altération ou un rollback qui change cette signature.

## Fermetures des P1

1. **CostRate `person` hors site : FERMÉ.** `costRateInput()` résout l'utilisateur de la société, son adhésion active puis exige simultanément `entityAllowed()` et `membershipAllowed()` (`server.js:1401-1408`). La même validation porte sur l'état final d'un PATCH, après fusion avec l'existant. Le test HTTP d'un gestionnaire Finance Paris obtient `404` sur la création d'un coût pour une personne Boulogne et sur le retargeting d'un tarif Paris ; l'objet autorisé reste inchangé (`tests/sprint7-finance.test.js:54-66`).
2. **ProjectCost Projet/Client hors périmètre : FERMÉ.** `projectCostInput()` résout le Projet final, exige son site autorisé et son Client autorisé même lorsque `siteId` est absent, puis revalide Réservation et Prestation liées (`server.js:1421-1432`). `projectCostAllowed()` applique les mêmes sources en lecture/rejeu (`server.js:1413-1419`). Les créations hors site et hors Client ainsi que le retargeting PATCH sont refusés `404`, sans modification de la dépense autorisée (`tests/sprint7-finance.test.js:67-77`).
3. **Snapshots planifiés sur mutation : FERMÉ.** `mutate()` capture les couples version/empreinte de planification avant la commande, puis `freezeMutatedReservationPlannedCosts()` ignore les Réservations inchangées, crée seulement la nouvelle version touchée et recopie le snapshot précédent lorsque l'empreinte financière est identique (`server.js:1089-1092`, `:1462-1474`). Une modification de tarif ne réévalue donc pas les versions déjà figées. Confirmation et correction Actual, qui ne modifient aucune Réservation, désactivent explicitement ce suivi (`server.js:2652-2654`). Le backfill initial conserve un index Actual partagé au lieu de le reconstruire par Réservation (`server.js:1476-1484`).
4. **Cache, falsification et rollback : FERMÉ pour le chemin nominal.** La clé comprend device, inode, taille, `mtimeNs` et `ctimeNs`; un hit retourne un `structuredClone`, et `atomicWrite(..., { cacheValidated: true })` ne remplace le cache qu'après le rename atomique (`server.js:1050-1087`). Les falsifications séquentielles de révisions, snapshots planifiés, références de taux, marqueurs et chaînes sont refusées après qu'un état a déjà été lu/caché (`tests/sprint7-finance.test.js:112-120`). Le rollback ne se fie pas au cache : il relit le fichier, rejoue la validation de migration, exige un export privé puis remplace atomiquement la source (`server.js:711-720`; `tests/sprint7-finance.test.js:122-125`).

## P2 — importants non bloquants isolément

1. **Preuve négative mutation encore partielle.** Les nouveaux tests démontrent les `404` et l'absence de modification de l'entité autorisée, mais ne comptent pas explicitement `financeIdempotency`, audit et événements SSE avant/après chaque refus, ni un rejeu après réduction dynamique de scope. Le chemin de code stocke marqueur/audit uniquement après validation et émet le SSE seulement après succès, mais une matrice de révocation/replay rendrait cette propriété directement exécutable.
2. **Incrémental ne signifie pas encore O(1).** Toute mutation générique construit encore une `Map` de toutes les Réservations puis les reparcourt pour repérer les versions touchées (`server.js:1463-1469`). Les calculs lourds et le backfill global ont disparu des confirmations/corrections Actual, mais le coût O(R) de détection reste à mesurer pour les autres écritures sur 10 000 Réservations. Les résultats du gate Performance sont une preuve indépendante et ne sont pas revendiqués par cette REVIEW.
3. **Fenêtre de concurrence du cache non testée.** La signature protège les altérations séquentielles et les remplacements atomiques. Il reste une fenêtre théorique si le fichier est remplacé entre la lecture brute validée et la seconde signature prise par `cacheValidatedDatabase()`, ainsi que l'absence des signatures de fichiers de sauvegarde dans la clé du cache. Une double lecture de signature avant/après validation, avec égalité exigée, et un test concurrent fermeraient complètement ce cas.

## Preuves fraîches exécutées par cette REVIEW

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `0aec6303c9b9f5672be4c512277cfca6a6e99988` |
| `node --check server.js && node --check app.js` | **PASS** |
| `node --test tests/sprint7-finance.test.js tests/migration-sprint7.test.js tests/sprint7-actuals.test.js` | **PASS, 24/24**, 0 échec/skip/todo, `593,55 ms` |
| `npm test` | **PASS, 294/294**, 0 échec/skip/todo, `8,27 s` |
| `git diff --check b42ea165ed32eeebae0b3f9f2080520bf946d4d8..0aec6303c9b9f5672be4c512277cfca6a6e99988` | **PASS** |
| Inspection du diff, routes POST/PATCH/replay, snapshots, cache, migration et rollback | deux P1 historiques fermés ; aucun nouveau P0/P1 |

Empreintes SHA-256 du candidat :

```text
server.js                           a65c81f95c013fa66ac61306d285b50abdbe461f901fe3da4b957e4c779a220e
app.js                              67b80cac99763abd2d5dbfe57fadefe5612504978a156b29343d30ce03a6277d
docs/api/openapi-v1.yaml            b3d48360e946ac3d854c22a6915dc398a2fc6951e2f880b6122a882c88a5cb8e
tests/sprint7-finance.test.js       07dac1c226372cb1c39db56c123e0c11720dd795803659015e4ca5d5658d290f
tests/sprint7-actuals.test.js       d83667ecd893ed88046f95474dd33bf1f5b508cbd83676db774e349f0742a7c9
scripts/benchmark-actuals.js        6bd42742306e65ce72db3ac62c1d80cbaa20c7df93116cfaf1884fdf56741873
scripts/benchmark-finance.js        1d0b4726837026923736bdb27210ea9a5262b429afa9771b665ecc3aee715e11
```

## Handoff

- Gate re-REVIEW S7-B : **APPROVED** sur `0aec6303c9b9f5672be4c512277cfca6a6e99988` ; 0 P0/P1, 3 P2 suivis.
- Les rapports Sécurité et Performance restent des gates indépendants : cette REVIEW ne reprend ni ne revendique leurs mesures ou verdicts.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ou autre rapport modifié.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur conformément à l'exception de tâche limitée à un fichier.

---

# Gate re-REVIEW terminal S7-B — coûts historiques, scopes et marges

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review_terminal`

Candidat applicatif exact : `b42ea165ed32eeebae0b3f9f2080520bf946d4d8` (`fix(finance): close S7-B gate blockers`)

Diff correctif contrôlé : `59ad25a339112dc4faa7df556e43aace6c1cb1ae..b42ea165ed32eeebae0b3f9f2080520bf946d4d8`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 2 P1 ouverts, 1 P2 ouvert.**

Les trois P1 de la REVIEW précédente sont fermés sur leurs chemins de lecture et de calcul : le coût planifié est figé par version de Réservation dans `plannedCostSnapshots`, les quatre types de tarifs internes sont filtrés par leur source, et les marges filtrent Client, Devis, Ressource/Stock/Prestation avant agrégation tout en publiant définition, fraîcheur, sources et drill-down. Le backfill est bien exécuté dans la migration Finance et dans `atomicWrite()`, avant l'écriture atomique.

Le candidat ne peut néanmoins pas être approuvé. Les validations de mutation ne sont pas symétriques avec les contrôles de lecture : un gestionnaire Finance limité à certains sites peut créer ou retargeter un tarif `person` vers une personne hors site, et créer ou retargeter une dépense vers un Projet/Client hors périmètre lorsque `siteId` est omis. Ces écritures hors autorité violent la SPEC Sprint 7 §9 et le contrat de mutation sensible d'`AGENTS.md`.

## P1 — bloquants

### P1-1 — Un tarif `person` peut être créé ou retargeté vers une personne hors site

`financeEntityAllowed()` protège correctement la lecture et le rejeu d'un tarif `person` en résolvant la membership puis en appelant `membershipAllowed()` (`server.js:1382-1390`). En revanche, `costRateInput()` valide la source `person` uniquement par société et `entityAllowed(auth, 'person', id)` (`server.js:1395-1401`). En l'absence d'une liste explicite `entityScopes.person`, ce prédicat est ouvert et ne contrôle ni la membership active ni son site/unité.

Conséquences :

- `POST /api/v1/finance/cost-rates` accepte une personne Boulogne pour un gestionnaire Finance limité à Paris ;
- `PATCH /api/v1/finance/cost-rates/{id}` peut partir d'un tarif Paris autorisé puis remplacer `scopeType/scopeId` par cette personne Boulogne ; le contrôle `financeEntityAllowed()` porte seulement sur l'objet avant mutation ;
- la réponse de mutation restitue immédiatement l'objet créé/modifié, puis les lectures/replays suivants le masquent. L'échec fermé après coup ne répare ni l'écriture non autorisée ni son audit/SSE.

Correction attendue : pour `person`, résoudre une membership active de la société et exiger à la fois `entityAllowed()` et `membershipAllowed()` dans `costRateInput()`, comme dans la lecture. Revalider la provenance finale de tout PATCH avant écriture. Ajouter des négatifs POST, PATCH et replay avec gestionnaire `finance.cost.manage` Paris et personne Boulogne ; vérifier absence de tarif, marqueur idempotent, audit et SSE après refus.

### P1-2 — Une dépense peut viser un Projet/Client hors périmètre si `siteId` est absent

`projectCostAllowed()` applique bien le Projet, le Client et les éventuelles sources liées lors des lectures/replays (`server.js:1406-1412`). `projectCostInput()` ne reprend toutefois pas ces invariants pour la provenance principale (`server.js:1414-1424`) :

- le Projet est sélectionné avec `projectAllowed()` seulement ; ce prédicat ne contrôle pas le site du Projet ;
- le Client propriétaire n'est jamais résolu ni passé à `clientAllowed()` ;
- le site n'est contrôlé que si le client envoie explicitement `siteId`. Une valeur absente ou `null` contourne donc le scope site même si le Projet porte un site hors périmètre.

Ainsi, un gestionnaire limité à Paris mais sans restriction explicite de Projets peut créer une dépense sur un Projet Boulogne avec `siteId` omis. Il peut aussi retargeter une dépense Paris autorisée vers un Projet/Client caché : le contrôle initial porte sur l'ancien objet, puis `projectCostInput()` accepte la nouvelle provenance. Comme pour P1-1, la réponse, l'audit et le SSE matérialisent l'écriture avant que les lectures ultérieures ne la masquent.

Correction attendue : résoudre le Projet final, exiger son site autorisé et son Client autorisé, puis imposer la cohérence du `siteId` de dépense avec le Projet/la Réservation selon le contrat métier. Appliquer ces contrôles au POST et à l'état final du PATCH. Ajouter des négatifs multi-sites et `entityScopes.client` pour création, retargeting et replay, avec preuve de zéro écriture partielle/audit/SSE.

## P2 — important non bloquant isolément

- **La suite couvre la confidentialité en lecture, pas la symétrie des mutations.** Le nouveau test multi-sites crée les quatre tarifs avec l'administrateur Organisation puis vérifie seulement qu'un lecteur Finance Paris ne les voit pas. Il ne donne pas `finance.cost.manage` au rôle restreint et ne tente aucun POST/PATCH hors site. Les dépenses ne disposent d'aucun négatif Projet/Client/site équivalent. Cette lacune a laissé les deux P1 ci-dessus passer malgré 71/71 ciblés et 293/293 complets.

## Fermetures historiques confirmées

1. **Historique planifié : FERMÉ.** `freezeReservationPlannedCosts()` indexe par `reservationId:version`, stocke montant, tarif/version, unité, quantité et état résolu/partiel/indisponible hors DTO Réservation. `migrateSprint7FinanceV1()` effectue le backfill initial et `atomicWrite()` le rejoue avant chaque écriture atomique ; une version déjà figée n'est pas recalculée après changement de tarif.
2. **Lecture des quatre sources : FERMÉE.** Ressource, catégorie de ressource, personne et catégorie de personne sont résolues vers leurs prédicats site/unité/entité dans `financeEntityAllowed()`. Le test Paris/Boulogne vérifie le masquage des quatre types.
3. **Marges avant agrégation : FERMÉES.** Les Projets exigent Client et site autorisés ; les Devis exigent leur scope ; chaque ligne est filtrée par Ressource, Stock, Prestation ou type manuel avant construction des totaux. Réservations, réalisés et dépenses sont ensuite rattachés au sous-ensemble autorisé.
4. **Réconciliation : FERMÉE.** La réponse `FINANCE_MARGIN@1` expose période, fraîcheur, sources, compteurs et lignes de drill-down bornées ; l'UI et l'OpenAPI consomment ce contrat.
5. **Intégrité historique : FERMÉE.** Snapshots planifiés et réalisés, références de tarifs, chaîne de révisions de dépenses et marqueurs idempotents sont vérifiés ; annulation de dépense terminale et rollback avec export privé restent conformes.

## Preuves examinées

Environnement des preuves QA : macOS arm64, Node `v26.6.0`, 2026-08-23. Aucune campagne longue n'a été relancée par cette REVIEW terminale ; les résultats frais produits sur le candidat exact sont réutilisés conformément au mandat.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/sprint7-finance.test.js tests/sprint7-actuals.test.js tests/quotes.test.js` | **PASS, 71/71**, 0 échec/skip/todo, preuve QA sur `b42ea165…` |
| `npm test` | **PASS, 293/293**, 0 échec/skip/todo, preuve QA sur `b42ea165…` |
| `git diff --check b42ea165^ b42ea165` | **PASS** |
| Inspection ciblée du diff, des mutations/replays, de `atomicWrite()`, des scopes et des consommateurs | 3 P1 historiques fermés ; 2 P1 de mutation hors scope ouverts |

Empreintes SHA-256 du candidat :

```text
server.js                           30099196c834172b88870b568b79f8af1b667a9994974c1669a9494e2783d004
app.js                              67b80cac99763abd2d5dbfe57fadefe5612504978a156b29343d30ce03a6277d
docs/api/openapi-v1.yaml            b3d48360e946ac3d854c22a6915dc398a2fc6951e2f880b6122a882c88a5cb8e
tests/sprint7-finance.test.js       1c20ef42048df5420fc522155c861f1b3d664e15a188163ac6b744c84545a85d
tests/sprint7-actuals.test.js       d83667ecd893ed88046f95474dd33bf1f5b508cbd83676db774e349f0742a7c9
```

## Handoff

- Gate re-REVIEW terminal S7-B : **CHANGES REQUIRED** sur `b42ea165ed32eeebae0b3f9f2080520bf946d4d8` ; retour DEV requis, puis re-REVIEW et gates aval impactés.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ou autre rapport modifié.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur conformément à l'exception de tâche limitée à un fichier.

---

# Gate REVIEW S7-B — coûts historiques et marges

Date : 2026-08-23

Reviewer : agent indépendant `g7b_review`

Candidat Git exact : `59ad25a339112dc4faa7df556e43aace6c1cb1ae`

Diff contrôlé : `fa9b3e5..59ad25a339112dc4faa7df556e43aace6c1cb1ae`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 3 P1 ouverts, 2 P2 ouverts.**

Les 20 tests ciblés et les 291 tests complets sont verts. Les dépenses Projet sont bien versionnées, leur annulation est terminale, les nouvelles révisions Actual protègent leur instantané de coût par le digest V3, et migrations/idempotence/audit/SSE suivent les conventions du monolithe. Le candidat ne peut toutefois pas être approuvé : le coût planifié n'est pas historisé, les tarifs internes ne sont pas filtrés par le site de leur source en lecture, et l'agrégat de marges ne respecte ni la provenance/drill-down publiée ni tous les scopes d'entité avant calcul.

## P1 — bloquants

### P1-1 — Modifier un `CostRate` réécrit le coût historique planifié

`PATCH /finance/cost-rates/{id}` modifie l'objet `CostRate` en place et incrémente seulement son champ `version`; aucune collection de révisions ni copie de l'ancienne version n'est créée (`server.js:2581`). `financeMargins()` résout ensuite chaque réservation à chaque lecture depuis la collection courante (`server.js:1427-1429`). Une modification du montant, de la période ou de l'état d'un tarif change donc rétroactivement `plannedCost` et `plannedMargin` d'une réservation existante.

L'instantané du réalisé est correctement figé (`server.js:1412-1418`), mais il ne couvre pas le planifié. Cela contredit la SPEC §6.1 : le calcul historique doit conserver `costRateId`, `version` et le montant résolu, et une modification/archivage ne doit pas changer un résultat figé.

Correction attendue : conserver les versions de `CostRate` de manière immuable et/ou figer un snapshot analytique lors de la planification, puis calculer la marge planifiée depuis ce snapshot. Ajouter une régression « réservation planifiée → marge lue → tarif modifié/archivé → même coût historique ».

### P1-2 — `finance.read` peut lire des tarifs internes hors de ses sites

La liste `GET /finance/cost-rates` filtre uniquement avec `financeEntityAllowed()` (`server.js:2579`). Pour un tarif `resource`, `resourceCategory` ou `person`, cette fonction appelle seulement `entityAllowed()` sur l'identifiant source (`server.js:1367-1375`) : elle ne retrouve pas la source et n'applique ni `resourceAllowed()`, ni `siteAllowed()`, ni `unitAllowed()`/le périmètre du membre. Un acteur Finance limité à Paris, mais sans liste d'entités explicite, peut donc recevoir les coûts d'une ressource ou catégorie de Boulogne. `personCategory` tombe même dans le fallback `entityAllowed(auth, 'costRate', value.id)`, sans contrôle de l'unité source.

La création revalide correctement la source (`server.js:1383`), ce qui ne corrige pas la fuite de la lecture. Le problème contredit la SPEC §9 et concerne des montants internes confidentiels.

Correction attendue : résoudre chaque source au GET/replay/SSE et appliquer les mêmes prédicats complets que pour sa création. Ajouter des tests négatifs multi-sites pour les quatre `scopeType`, y compris après réduction de scope et au rejeu idempotent.

### P1-3 — `/analytics/margins` n'est ni réconciliable ni filtré sur toutes ses sources

`financeMargins()` sélectionne les Projets puis les Devis avec `quoteAllowed()`, mais ne vérifie pas `clientAllowed()` et additionne toutes les lignes d'un Devis sans appliquer `resourceAllowed()` ou `offeringAllowed()` aux sources des lignes (`server.js:1423-1425`). Un acteur autorisé sur le Projet/Devis mais restreint sur le Client, une Ressource ou une Prestation reçoit donc encore leur revenu et leur coût dans les totaux. Le moteur analytique existant `commercialAnalyticRows()` montre pourtant le contrat attendu : filtrer les lignes sources avant allocation.

La réponse ne contient par ailleurs que des totaux et une liste `{id,name}` de Projets (`server.js:1434`). Elle omet `definitionVersion`, période complète, fraîcheur, sources et drill-down Devis/ligne/réservation/réalisé exigés par les SPEC §7 et §10. L'OpenAPI `MarginAnalytics` documente cette sortie minimale au lieu du contrat publié. L'UI affiche des KPI et les référentiels, mais aucun tableau analytique filtrable ou drill-down (`app.js:357-360`). Il est donc impossible d'expliquer ou de réconcilier les trois marges à leurs sources.

Correction attendue : produire les marges sur des lignes analytiques autorisées avant agrégation, inclure définition/fraîcheur/provenance et un drill-down borné, aligner OpenAPI/UI, puis tester des scopes Client/Ressource/Prestation partiels.

## P2 — importants non bloquants isolément

1. **Couverture Finance trop heureuse.** Les tests ne couvrent ni les coûts `person`/`personCategory`, ni les bornes semi-ouvertes exactes, ni les scopes multi-sites/Client/Ressource/Prestation, ni les formules des trois marges sur plusieurs Devis et dépenses datées. Le test UI est une recherche statique de chaînes, pas un parcours clavier ou un contrôle des états obsolètes.
2. **Intégrité structurelle incomplète des révisions de dépense.** `sprint7FinanceStateValid()` impose l'unicité du couple dépense/numéro et le digest du snapshot, mais pas une suite contiguë de révisions ni la cohérence des champs/versions/auteurs du snapshot. Compléter ces invariants pour détecter une suppression ou une chaîne tronquée au rejeu.

## Contrôles conformes

- **Résolution :** priorité ressource avant catégorie et dernière période applicable; chevauchements actifs refusés.
- **Dépenses Projet :** montants entiers/devise société, version optimiste, motif de correction, snapshot antérieur digesté, transition `cancelled` terminale.
- **Réalisé :** les nouvelles confirmations/corrections portent un snapshot de coût et un digest V3; une modification ultérieure du tarif ne change pas cette révision.
- **Mutations :** clé d'idempotence, revalidation du résultat au rejeu, audit dans la transaction et SSE après commit.
- **Migration/rollback :** ordre S7-A → S7-B, sauvegarde privée `0600`, marqueur et références contrôlés, export obligatoire et restauration byte-exacte.
- **UI de saisie :** labels explicites, tables dans des régions focusables, échappement des textes et gestion chargement/vide/erreur.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `59ad25a339112dc4faa7df556e43aace6c1cb1ae` |
| `node --check server.js && node --check app.js` | **PASS** |
| `node --test tests/sprint7-finance.test.js tests/sprint7-actuals.test.js` | **PASS, 20/20**, 0 échec/skip/todo, 0,600 s |
| `npm test` | **PASS, 291/291**, 0 échec/skip/todo, 8,740 s |
| `git diff --check fa9b3e5..59ad25a` | **PASS** |
| Inspection indépendante du diff, des routes, scopes, UI et OpenAPI | **3 P1 et 2 P2** |

Une tentative de probe API supplémentaire multi-sites a été interrompue pendant l'attente d'autorisation locale et n'est pas comptée comme preuve. Les constats P1 sont directement démontrés par les chemins d'autorisation et de calcul ci-dessus.

Empreintes SHA-256 du candidat :

```text
server.js                           3e4921e359e7b3455460443230e7b607b9711b93cae66c45367f32712fed35ee
app.js                              39da92b68af5f4faf9c08b783d4d493cfe7c1965e70568e741f5e8a2d7c7ec04
index.html                          63713e30a59e7192c60b023b9f78d7e85bfef5904788f816e2cec190bd573590
planning.css                        fc6168de5e0e3d4295592680cdc0a70b1155feb51bca18cdfa7e29d4a186e009
docs/api/openapi-v1.yaml            eaa86411c7bea417ecf8e28494122dfb9cc8fbae42f06e285db95b5a3f3ba1cc
tests/sprint7-finance.test.js       677569280b52e399242855b9f4576cff8fc328fa5e8761f43811f7641fb475e6
tests/sprint7-actuals.test.js       d83667ecd893ed88046f95474dd33bf1f5b508cbd83676db774e349f0742a7c9
```

## Handoff

- Gate REVIEW S7-B : **non approuvé**; retour DEV requis, puis nouvelle REVIEW et tous les gates aval impactés.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ou autre rapport modifié.
- L'intégrateur doit mettre `docs/project-status.md` à jour : S7-B `Bloqué / retour DEV`, 3 P1 et 2 P2, candidat `59ad25a`.

---

# Gate re-REVIEW finale S7-A — provenance commerciale et compatibilité legacy

Date : 2026-08-23

Reviewer : agent indépendant `g7a_review`

Candidat Git exact : `27ad4965dc6c4c4fc3336e58b1dff70ea59e3d91`

Diff correctif contrôlé : `e4af056e5203bace13ce09821c80a7dc768cef32..27ad4965dc6c4c4fc3336e58b1dff70ea59e3d91`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert. Un P2 de représentativité du benchmark reste suivi, sans bloquer ce gate REVIEW.**

Le P1 restant de la passe précédente est fermé : chaque Devis complémentaire contributeur est conservé avec son identité puis filtré par `quoteAllowed()` avant agrégation. Une quantité issue d'un complément absent de `entityScopes.quote` ne contribue donc plus au vendu, aux écarts ni au facturable. La compatibilité des révisions historiques est également alignée avec le contrat : tout DTO legacy sans champ persistant expose désormais explicitement `digestVersion: 1`.

## Fermetures confirmées

1. **Devis complémentaires hors scope : FERMÉ.** `actualIndexes()` conserve `{ quoteId, quantityMilli }` par ligne source. `actualCommercialSummary()` retrouve chaque complément, applique `quoteAllowed(auth, complement)`, puis recalcule `soldQuantityMilli` uniquement sur le sous-ensemble autorisé. Le test dédié démontre `1500` vendu avec le complément hors scope, puis `10500` après ajout explicite de ce complément au scope Devis.
2. **Consommateurs : CONFORMES.** Liste, détail, route par réservation et réponses de rejeu utilisent le même `actualRecordDto()` et donc le même `actualCommercialSummary()`. Le SSE Actual reste une invalidation sans quantité commerciale; le rechargement applique les scopes courants. Le contrôle du Devis source par `quote.read` et `quoteAllowed()` reste présent.
3. **Compatibilité `digestVersion` : FERMÉE.** `actualRecordDto()` normalise les révisions historiques dépourvues du champ vers `digestVersion: 1`, sans réécrire le registre. L'OpenAPI peut donc continuer à rendre ce champ obligatoire, tandis que la validation d'intégrité conserve le calcul V1 historique et le V2 pour les nouvelles écritures.
4. **Anciens P1 : SANS RÉGRESSION.** Une unité différente reste refusée par `422 ACTUAL_UNIT_CONVERSION_REQUIRED`; la lecture par réservation ne restitue que le réalisé de sa version courante; les rejeux idempotents revalident l'acteur et ses scopes avant restitution.
5. **Intégrité et digest V2 : SANS RÉGRESSION.** Le registre et ses révisions restent append-only, chaînés et contrôlés par digest; la migration demeure rejouable et le rollback byte-exact. Les métadonnées V2 falsifiées restent refusées.
6. **UI, accessibilité et complexité : SANS RÉGRESSION.** Dialogue nommé par `aria-labelledby`, labels/focus/statuts textuels conservés; pagination appliquée avant projection DTO et index de révisions/compléments construits hors des boucles de restitution.

## P2 restant — non bloquant REVIEW

- **Jeu du benchmark partiellement représentatif.** La mesure fraîche porte sur 10 011 réservations et 2 500 réalisés, mais sur 161 ressources et sans les 2 000 documents commerciaux demandés par la SPEC §12. Les seuils mesurés sont respectés avec marge. La complétude représentative doit rester suivie au gate Performance; elle ne masque aucun P0/P1 fonctionnel dans cette re-REVIEW ciblée.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `27ad4965dc6c4c4fc3336e58b1dff70ea59e3d91` |
| `node --check server.js && node --check app.js && node --check scripts/benchmark-actuals.js` | **PASS** |
| `node --test tests/migration-sprint7.test.js tests/sprint7-actuals.test.js` | **PASS, 14/14**, 0 échec/skip/todo, 0,580 s |
| `npm test` | **PASS, 284/284**, 0 échec/skip/todo, 8,625 s |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS**, 5 actifs runtime |
| `git diff --check e4af056..27ad496` | **PASS** |
| `npm run benchmark:actuals` | **PASS** — list p95 108,70 ms; pending 122,30 ms; détail 102,10 ms; confirmation 204,39 ms; correction 199,45 ms |
| Inspection indépendante du correctif et des consommateurs DTO/SSE/replay | P1 complément hors scope et P2 `digestVersion` fermés; anciens P1 non réintroduits |

Le `git diff --check` global du répertoire de travail a simultanément signalé des espaces finaux dans `docs/qa-report.md`, fichier détenu et modifié par un autre gate. Ce constat concurrent n'affecte ni le diff exact du candidat, qui passe, ni le verdict REVIEW; aucun fichier tiers n'a été modifié par ce reviewer.

Empreintes SHA-256 du candidat :

```text
server.js                           57243146a3aa2b5b136f0a4f57f50186c18c0df211d756a1dad3e118ccc8d98
app.js                              eb2c927f161dfbb45e05942bcda929bb37c8217c133a0913c6a0f0cd58263afa
docs/api/openapi-v1.yaml            59df65fca73f2f80d49c0dca46a6f288a674174bedb1b24b4d581855f75c2352
tests/sprint7-actuals.test.js        30c03d2fd46c277833913527c64920398d6226864eab21f79361ecd8fae8ebb9
scripts/benchmark-actuals.js        2f0847a809ac93dbdf018a8ad8ed50a0370301e55b13ba2b5b8a2e0c95916456
```

## Handoff

- Gate re-REVIEW finale S7-A : **APPROVED** sur le candidat exact `27ad4965dc6c4c4fc3336e58b1dff70ea59e3d91`.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ou autre rapport modifié.
- `docs/project-status.md` reste sous responsabilité de l'intégrateur.

---

# Gate re-REVIEW S7-A — durcissement du registre réalisé

Date : 2026-08-23

Reviewer : agent indépendant `g7a_review`

Candidat Git exact : `e4af056e5203bace13ce09821c80a7dc768cef32`

Diff correctif contrôlé : `5c613d3f683b73fd14830ad76e165dfa641f5749..e4af056e5203bace13ce09821c80a7dc768cef32`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 1 P1 ouvert, 2 P2 ouverts.**

Les deux P1 de la passe précédente sont fermés : une unité différente est refusée côté serveur et n'est plus modifiable dans l'UI; la route singulière d'une réservation sélectionne désormais exclusivement le réalisé de sa version courante. Le digest V2, le nom accessible du dialogue, le bornage de `asOf`, la pagination avant projection et les index de révisions sont également conformes. Un P1 de provenance commerciale subsiste cependant : les Devis complémentaires acceptés sont agrégés dans `sold` sans revalider leur scope individuel.

## P1 — bloquant

### P1-1 — Les compléments acceptés contribuent à la réconciliation sans contrôle de leur scope Devis

`actualIndexes()` parcourt tous les Devis acceptés et additionne chaque ligne complémentaire dans `complementByLine`, uniquement à partir du couple `planningComplementSourceQuoteId:planningSourceQuoteLineId` (`server.js:1219-1224`). `actualCommercialSummary()` ajoute ensuite cette quantité globale au vendu de la ligne source (`server.js:1239-1244`).

Le correctif revalide bien `quote.read` et `quoteAllowed()` pour le Devis source dans `actualRecordAllowed()`, la file, la confirmation, la correction, le rejeu et le SSE. Il ne conserve toutefois ni l'identité des Devis complémentaires contributeurs, ni un filtre `quoteAllowed(auth, complement)` avant agrégation. Un acteur dont le scope d'entité autorise le Devis principal mais exclut un complément accepté reçoit donc encore l'effet de ce complément dans :

- `soldQuantityMilli` ;
- `soldDeviationQuantityMilli` et `billableQuantityMilli` ;
- potentiellement `billableValueMinor` s'il possède aussi `finance.read`.

Cette sortie permet d'inférer une quantité commerciale hors scope et contredit la SPEC §9 : toutes les sources doivent être autorisées avant agrégation, jamais filtrées après calcul. Le test ajouté ne couvre que le Devis source (`tests/sprint7-actuals.test.js:110-118`) et laisse ce chemin sans régression.

Correction attendue : indexer les compléments avec leur `quoteId/companyId/projectId/siteId` et leurs lignes, puis n'agréger que des compléments explicitement autorisés, ou échouer fermé si une réconciliation prétend couvrir des sources non consultables. Ajouter un test avec Devis principal autorisé + complément accepté hors `entityScopes.quote`, puis vérifier liste, détail, replay et SSE/DTO sans fuite.

## P2 — importants non bloquants isolément

1. **Compatibilité du contrat `digestVersion`.** Le validateur accepte volontairement les anciennes révisions sans champ `digestVersion` comme V1 (`server.js:617-629`), mais l'OpenAPI rend désormais ce champ obligatoire (`docs/api/openapi-v1.yaml:864-881`) et `actualRecordDto()` restitue les objets legacy sans le normaliser. Projeter `digestVersion: revision.digestVersion || 1` dans les DTO, ou rendre le champ facultatif pour la compatibilité documentée.
2. **Jeu du benchmark partiellement représentatif.** La preuve mesure bien 10 011 réservations et 2 500 réalisés, mais seulement 161 ressources et aucun document commercial relié, contre 250 ressources et 2 000 documents dans la SPEC §12. Les seuils passent largement; compléter ultérieurement le dataset pour couvrir le coût des réconciliations Devis/compléments.

## Fermetures confirmées

1. **Unité et conversion : FERMÉ.** `actualRevisionInput()` impose l'unité canonique du snapshot et répond `422 ACTUAL_UNIT_CONVERSION_REQUIRED`; confirmation et correction sont testées. L'UI affiche une valeur en lecture seule et n'envoie plus le champ.
2. **Version courante de réservation : FERMÉ.** `GET /reservations/{id}/actual` compare `sourceReservationVersion === reservation.version`; en l'absence de record courant il retourne `pending` avec la bonne version. La régression V1 → réservation V2 passe.
3. **Provenance du Devis principal : PARTIELLEMENT FERMÉE.** `quote.read`, Projet/site et scope d'entité du Devis source sont vérifiés sur file, historique, détail, mutation, replay et SSE. Le P1 restant concerne exclusivement les compléments contributeurs.
4. **Digest V2 : FERMÉ pour les nouvelles écritures.** Société, acteur, horodatages et données opérationnelles alimentent le digest; les utilisateurs référencés appartiennent à la société; la falsification de `confirmedAt` est refusée. La lecture des anciennes révisions V1 reste tolérée.
5. **Complexité et pagination : CONFORMES.** Les révisions sont groupées une fois dans des maps; la liste pagine avant construction des DTO; file et détails restent linéaires/indexés. Aucun retour à une boucle quadratique complète n'a été observé.
6. **Accessibilité : FERMÉE.** Le dialogue est relié à son titre par `aria-labelledby`, les champs restent labelisés, le focus initial est explicite et les statuts comportent du texte.
7. **`asOf` : FERMÉ.** Une date future est refusée par `422`; la file UI continue d'utiliser l'instant serveur.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `e4af056e5203bace13ce09821c80a7dc768cef32` |
| `node --test tests/migration-sprint7.test.js tests/sprint7-actuals.test.js` | **PASS, 13/13**, 0 échec/skip/todo, 0,666 s |
| `npm test` | **PASS, 283/283**, 0 échec/skip/todo, 9,514 s |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS**, 5 actifs runtime |
| `git diff --check` | **PASS** |
| `npm run benchmark:actuals` | **PASS** — list p95 106,18 ms; pending 124,26 ms; détail 103,36 ms; confirmation 219,45 ms; correction 218,33 ms |
| Inspection de `5c613d3..e4af056` et consommateurs Devis/SSE | deux anciens P1 fermés; un P1 complément hors scope |

Empreintes SHA-256 du candidat :

```text
server.js                           c63e5f0465ad7621bed356933e14d8679c8e1a2518ee43ae204ef08a72bf0906
app.js                              eb2c927f161dfbb45e05942bcda929bb37c8217c133a0913c6a0f0cd58263afa
docs/api/openapi-v1.yaml            59df65fca73f2f80d49c0dca46a6f288a674174bedb1b24b4d581855f75c2352
tests/sprint7-actuals.test.js        e9d755f5b58db0df15adc6614492b819aa5aa24452ea3b0c11e6ad47f05f8b75
scripts/benchmark-actuals.js        2f0847a809ac93dbdf018a8ad8ed50a0370301e55b13ba2b5b8a2e0c95916456
```

## Handoff

- Gate re-REVIEW S7-A : **non approuvé** jusqu'à fermeture du P1 de provenance des compléments et nouvelle re-REVIEW sur le correctif.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée, statut ou autre rapport modifié.
- `docs/project-status.md` reste sous responsabilité de l'intégrateur.

---

# Gate REVIEW S7-A — registre du réalisé

Date : 2026-08-23

Reviewer : agent indépendant `g7a_review`

Candidat Git exact : `5c613d3f683b73fd14830ad76e165dfa641f5749`

Diff contrôlé : `80c29ce..5c613d3f683b73fd14830ad76e165dfa641f5749`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 2 P1 ouverts, 2 P2 ouverts.**

Le registre append-only, les révisions chaînées, l'idempotence, l'audit, le SSE après commit, les scopes et le rollback byte-exact sont correctement structurés et les 12 tests ciblés frais sont verts. Deux défauts fonctionnels empêchent toutefois d'approuver S7-A : une unité réelle incompatible peut être comparée directement à l'unité commerciale sans conversion, et la lecture singulière d'une réservation peut restituer un ancien réalisé alors que sa version courante est de nouveau à confirmer.

## P1 — bloquants

### P1-1 — Une confirmation/correction accepte une unité différente sans conversion versionnée

`actualRevisionInput()` accepte toute unité de `SERVICE_OFFERING_UNITS` transmise par le client, sans exiger qu'elle soit égale à l'unité du snapshot planifié et sans résoudre de conversion (`server.js:1254-1260`). `actualCommercialSummary()` remet ensuite `sold`, `planned` et `actual` directement au même calcul entier (`server.js:1231-1236`, `packages/quote-consumption/index.js:49-65`). L'interface expose elle-même toutes les unités dans un sélecteur modifiable (`app.js:954-956`) et l'OpenAPI autorise ce champ (`docs/api/openapi-v1.yaml:840-861`).

Il est donc possible de confirmer, par exemple, `8 heure` face à `1 jour`; le moteur compare `8000` à `1000` comme si les unités étaient identiques et produit un écart/facturable faux. Cela contredit explicitement la SPEC §4.2 (« une conversion explicite et versionnée est nécessaire si elle diffère ») et compromet la chaîne Finance.

Correction attendue : pour S7-A, verrouiller l'unité réelle sur l'unité canonique du snapshot planifié/commercial, côté serveur et UI. Si une conversion doit réellement être supportée, introduire d'abord un contrat de conversion identifié/versionné, conserver son identifiant dans la révision et convertir avant toute réconciliation. Ajouter des tests négatifs confirmation **et** correction sur unité différente.

### P1-2 — `GET /reservations/{id}/actual` peut retourner un réalisé obsolète au lieu de l'état de la version courante

Le modèle autorise à juste titre un `ActualRecord` par couple `reservationId:sourceReservationVersion`, afin qu'une réservation modifiée puisse réapparaître dans la file. Mais la route singulière sélectionne le premier enregistrement du tableau avec `find()` sans comparer `sourceReservationVersion` à `reservation.version` (`server.js:2427`). Après confirmation de la version 1, modification de la réservation en version 2, puis consultation de cette route, l'API renvoie encore le réalisé V1 alors que `pendingActualItems()` classe correctement V2 « à confirmer ». Après confirmation de V2, elle peut toujours renvoyer V1.

Impact : deux endpoints donnent des états contradictoires pour la même réservation et un consommateur peut considérer à tort le réalisé courant comme confirmé. Correction attendue : sélectionner exclusivement le record de la version opérationnelle courante ; s'il n'existe pas, retourner l'état `pending` de cette version. Conserver l'historique multi-version via `/actuals?reservationId=...`. Ajouter les régressions V1 confirmée → réservation V2 pending, puis V2 confirmée → détail V2.

## P2 — importants non bloquants isolément

1. **La file publique accepte un `asOf` arbitrairement futur.** La SPEC §4.1 définit l'éligibilité selon l'instant serveur, tandis que `/actuals/pending?asOf=...` accepte toute date ISO (`server.js:2423`, OpenAPI `:424-436`). La mutation reste protégée par `Date.now()`, mais la lecture peut annoncer comme confirmable une réservation future. Supprimer ce paramètre public, le borner à `now`, ou documenter une permission explicite de simulation.
2. **Nom accessible du dialogue incomplet.** Le `<dialog>` natif ne porte ni `aria-labelledby` ni `aria-label`; son titre change dynamiquement mais ne lui est pas relié (`app.js:954-955`). Ajouter un identifiant stable au titre et `aria-labelledby`, puis un test d'accessibilité sémantique. Les labels de champs, le focus initial et les statuts textuels sont par ailleurs présents.

## Contrôles conformes

- **Append-only et concurrence :** création d'un record distinct, révisions numérotées, `priorRevisionId`, contrôle `actualVersion`/`reservationVersion`, absence d'écrasement des anciennes révisions.
- **Intégrité structurale :** unicité réservation/version, chaîne de révisions contiguë, digest des valeurs réalisées et refus d'une révision falsifiée au rejeu de migration.
- **Lecture dérivée :** la file ne crée ni Actual, ni audit; tri déterministe et filtrage société/site/projet/entités.
- **Idempotence :** rejeu exact sans seconde écriture; corps divergent en conflit; permissions et scopes revalidés avant restitution.
- **Audit et événements :** audit canonique et `ActualConfirmed` dans la transaction; invalidation SSE seulement après succès, sans émission sur erreur ou rejeu.
- **Confidentialité :** sans `finance.read`, la valeur facturable est masquée; un réalisé non relié commercialement reste `unmapped` et reçoit un facturable nul, sans montant inventé.
- **Migration/rollback :** ordre Sprint 6 → Sprint 7, sauvegarde privée `0600`, marqueur/digest vérifiés, export obligatoire et restauration byte-exacte.
- **UI :** échappement des données injectées, états chargement/vide/erreur/lecture seule, focus visible et libellés textuels non fondés uniquement sur la couleur.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `5c613d3f683b73fd14830ad76e165dfa641f5749` |
| `node --check server.js && node --check app.js` | **PASS** |
| `node --test tests/migration-sprint7.test.js tests/sprint7-actuals.test.js` | **PASS, 12/12**, 0 échec/skip/todo, 0,9 s |
| Inspection indépendante du diff `80c29ce..5c613d3` et de ses consommateurs | **2 P1, 2 P2** |
| Tentative de reproduction API isolée de P1-1 | bind localhost refusé par le sandbox; la preuve statique est directe dans les contrats serveur/UI/OpenAPI |

La suite complète `npm test` n'a pas été rejouée dans cette passe interrompue; la preuve DEV annoncée reste 281/281, mais elle ne ferme pas les scénarios absents ci-dessus.

Empreintes SHA-256 du candidat :

```text
server.js                                      f81919705c8d5522580cc3a279ea56ca18756f399b34ee8e054cd8058e2e929f
app.js                                         9387d6913f1cbe934b61e548908f7015aecd59a175201a39f19e4fa1939a9d6e
packages/quote-consumption/index.js            58bba2239793950530f93392794b0e71ac388c9be7670bd2ee70a176afa1f63b
docs/api/openapi-v1.yaml                       3a84d89420a734fb663483537abf39a1e4e3229feffdabfb40aa72ad5c607e44
tests/sprint7-actuals.test.js                   c94f884fc1f0f7a12ba6797e36f9507a1505d522d5e755509f01e6f3077e22f1
tests/migration-sprint7.test.js                 129f32023259f7eb98d2f845c5cfcd11f28199ba378bcb5b8eff6fbb88e72a94
docs/specifications/sprint-7-actuals-finance-engine.md 9a0d63334a98d544f648dd9394149704c2cc1ab4ae83cb92111f95f73673a304
```

## Handoff

- Gate REVIEW S7-A : **non approuvé** jusqu'à correction des deux P1 et re-REVIEW indépendante sur le nouveau commit.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée ou autre rapport modifié.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

---

# Gate G6 — re-REVIEW ultime du garde multisite

Date : 2026-08-23

Reviewer : agent indépendant `g6_review_final`

Candidat Git exact : `1eab12023a44d65bb9d63dc3bfeba6e04399826f`

Diff contrôlé : `b25c61d085644525c18ce18a7b25d5b9f81c222c..1eab12023a44d65bb9d63dc3bfeba6e04399826f`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert.**

Le dernier défaut de provenance multisite est fermé. Les réponses PlanyBot qui agrègent des données Planning portent désormais une empreinte canonique du périmètre de sites courant, en complément des gardes Réservation/Ressource. Un résumé créé avec Paris + Boulogne devient inaccessible après retrait de Boulogne, au rejeu idempotent comme dans l'historique, tandis que le Projet demeure autorisé. Les protections précédemment approuvées — permissions commerciales, provenance compacte, scopes d'entités, OpenAPI et absence de mutation silencieuse — ne régressent pas.

## Fermetures et contrôles

1. **Garde de sites : FERMÉ.** `planyEntityScopeGuard()` canonicalise, trie et hache `auth.user.siteIds` pour le type `site` (`server.js:1309`). Le contrôle courant réutilise le même calcul dans `planyAccessAllowed()` (`server.js:1329`). Un passage Organisation → sites ou toute modification de la liste invalide aussi l'ancienne provenance de manière sûre.
2. **Couverture des agrégats : CONFORME.** Disponibilité du personnel, conflits, résumé Projet, préparation de réservation et disponibilité des ressources déclarent toutes `site` dans leurs `sourceAccess.scopeTypes` (`server.js:1279`, `1285`, `1290`, `1296`, `1301`). Les réponses sans agrégat Planning ne sont pas artificiellement élargies.
3. **Régression Paris + Boulogne → Paris : PASS.** Le test accorde les deux sites avec le Projet inchangé, produit un résumé multisite d'au moins deux réservations, retire uniquement Boulogne, puis constate `404` sur le rejeu et la lecture des messages (`tests/plany.test.js:140-143`).
4. **Provenance compacte : NON-RÉGRESSION.** Une garde de site ajoute une seule empreinte de taille fixe ; aucune liste de réservations, ressources ou sites sources n'est recopiée. Le test de taille du snapshot reste inférieur à 2 000 caractères et la suite complète reste verte.
5. **Permissions/scopes : NON-RÉGRESSION.** Les scénarios `quote.read`, préférence client, scopes Réservation/Ressource et Projet continuent de refuser replay/historique après révocation. Les ressources et personnes directement exposées restent contrôlées individuellement.
6. **OpenAPI : NON-RÉGRESSION.** Le fichier est inchangé depuis le candidat approuvé ; le contrôle frais résout les 67 références locales uniques, dont `ReservationAllocation`, et valide les paramètres requis des 46 chemins.

## Régressions adjacentes

- Aucun P0/P1 n'a été identifié dans le diff ciblé ou les consommateurs de provenance relus.
- L'invalidation sur extension d'un périmètre de sites est volontairement plus stricte que nécessaire, mais fail-close et sans perte de données : l'utilisateur peut reformuler sa demande pour obtenir un résultat courant.
- Le coût du nouveau garde dépend uniquement du petit périmètre de sites autorisés et produit une empreinte fixe ; il ne réintroduit ni amplification persistée ni boucle quadratique sur les 10 000 réservations.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `1eab12023a44d65bb9d63dc3bfeba6e04399826f` |
| `node --test tests/plany.test.js tests/quotes.test.js tests/sprint6-plany-migration.test.js` | **PASS, 64/64**, 0 échec/skip/todo, 4,885 s |
| `npm test` | **PASS, 270/270**, 0 échec/skip/todo, 8,862 s |
| Contrôle Ruby/Psych des références locales et paramètres de templates OpenAPI | **PASS**, 67 références uniques résolues, 46 chemins valides |
| `git diff --check` | **PASS** |
| Inspection de `b25c61d..1eab120` | diff limité au garde de sites, à sa régression et à la documentation/statut associés |

Empreintes SHA-256 du candidat :

```text
server.js                                      d24ef8b32d18ee6b68a9c995d6cbefe6949b26ae3cd24a431e55c5ad2a4e0c84
app.js                                         d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54
docs/api/openapi-v1.yaml                       0632ef9e0c18adf793e662e883398701146c9a55a7a5fd73801ffe6ecd6a61fb
tests/plany.test.js                            c4359eacd062967523a1b0197f8470f40719514bc2239123c3d9c82093c4cc5d
tests/quotes.test.js                           16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a
docs/specifications/sprint-6-planybot-excel.md 626f41549f742a203caf2a4d495e5d1f8a8cf457ee5afe51a3ac5a7ad848fa77
```

## Limites et handoff

- Cette REVIEW approuve le candidat exact `1eab120`; les gates SECURITY concernés par leur P1 multisite doivent publier leur propre revalidation sur ce même état avant déblocage global G6.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée ou autre document modifié.
- `docs/project-status.md` reste sous responsabilité de l'intégrateur.

---

# Gate G6 — re-REVIEW terminale provenance compacte et OpenAPI

Date : 2026-08-23

Reviewer : agent indépendant `g6_review_final`

Candidat Git exact : `b25c61d085644525c18ce18a7b25d5b9f81c222c`

Diff contrôlé : `14c1268cfcdcbefdcee8bf7a6be10419ef307f14..b25c61d085644525c18ce18a7b25d5b9f81c222c`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert.**

Les blocages REVIEW précédents sont fermés. Les recommandations PlanyBot qui exposent une préférence client persistent désormais `quote.read`; celles dont la disponibilité ou la continuité dépend des Réservations/Ressources portent des gardes compactes des scopes correspondants. Rejeu et historique échouent fermés après révocation de permission ou modification du périmètre. La provenance agrégée n'embarque plus une liste non bornée de sources et ne reproduit plus le traitement quadratique signalé par les gates précédents. L'OpenAPI résout toutes ses références locales, dont `ReservationAllocation`, et tous ses paramètres de chemin sont déclarés obligatoires.

## Fermetures confirmées

1. **Préférence client / permission commerciale : FERMÉ.** `planyAccessSnapshot()` ajoute `quote.read` dès qu'une recommandation renvoyée porte `clientPreference: true` (`server.js:1322`). Le test crée une recommandation préférée, retire ensuite `quote.read`, puis vérifie `404` au rejeu et dans l'historique.
2. **Continuité et disponibilité / scopes sources : FERMÉ.** Les branches conflit, résumé Projet, préparation et disponibilité annoncent les types de scopes réellement consultés (`server.js:1285`, `1290`, `1296`, `1301`). Le snapshot de schéma 3 en conserve une empreinte canonique et `planyAccessAllowed()` la recalcule avec les droits courants (`server.js:1309-1329`). Les identifiants directement affichés restent parallèlement vérifiés individuellement.
3. **Provenance compacte et bornée : FERMÉ.** Les listes exhaustives de Réservations/Ressources sources ont été remplacées par au plus une empreinte par type de scope. La taille persistée ne croît donc plus avec les 10 000 Réservations du Projet et les boucles `includes`/`some` ne portent plus sur cette cardinalité. Le test confirme un snapshot inférieur à 2 000 caractères.
4. **Fail-close et compatibilité : CONFORME.** Seul `schemaVersion: 3` est accepté. Les anciennes provenances restent conservées mais ne sont pas restituées. Les gardes changent aussi lors d'une extension de scope ; ce refus plus strict est sûr et impose simplement une nouvelle demande PlanyBot.
5. **OpenAPI : FERMÉ.** `ReservationAllocation` est déclaré comme alias de l'union canonique `Allocation`. Le contrôle indépendant résout toutes les références locales et valide les paramètres requis de chaque template. Les quatre routes G6 avec `{quoteId}` restent correctement déclarées.

## Régressions adjacentes

- Aucun P0/P1 n'a été identifié dans le diff, les consommateurs PlanyBot et les contrats Réservation/Devis relus.
- Les tests ciblés confirment l'absence de mutation lors d'une recommandation, l'isolation utilisateur, les replays idempotents, les permissions et les réductions de scopes.
- Le schéma 3 rend volontairement inaccessibles les historiques de schéma 2 ; ce comportement fail-close est documenté et conforme à la spécification G6.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `b25c61d085644525c18ce18a7b25d5b9f81c222c` |
| `node --test tests/plany.test.js tests/quotes.test.js tests/sprint6-plany-migration.test.js` | **PASS, 64/64**, 0 échec/skip/todo, 4,826 s |
| `npm test` | **PASS, 270/270**, 0 échec/skip/todo, 8,548 s |
| Contrôle Ruby/Psych des références locales et paramètres de templates OpenAPI | **PASS**, 67 références uniques résolues, 46 chemins valides |
| `git diff --check` | **PASS** |
| Inspection de `14c1268..b25c61d` | diff limité au durcissement de provenance, au contrat OpenAPI, aux tests et à leur documentation/statut |

Empreintes SHA-256 du candidat :

```text
server.js                                      5025a767d5d05bc08a46aab00d8a2302d86838ce4f3f0d5e8cc817cec91a5a7d
app.js                                         d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54
docs/api/openapi-v1.yaml                       0632ef9e0c18adf793e662e883398701146c9a55a7a5fd73801ffe6ecd6a61fb
tests/plany.test.js                            cfd8e782b2a78e00533a3f111337dcb266adcb7dfe91acb67e969e16c79acc58
tests/quotes.test.js                           16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a
docs/specifications/sprint-6-planybot-excel.md 39ce221aff88530d0e33e95df82be1aeb9aaafb81897894e9d20305622ddfa23
```

## Limites et handoff

- Cette passe REVIEW ne remplace pas les revalidations indépendantes QA, SECURITY et PERFORMANCE sur `b25c61d` ; leurs rapports visibles portent encore sur le candidat antérieur et doivent être rejoués.
- Fichier modifié : `docs/code-review.md` uniquement. Aucun code, test, donnée ou autre document modifié.
- `docs/project-status.md` reste sous responsabilité de l'intégrateur.

---

# Gate G6 — re-REVIEW finale provenance et OpenAPI

Date : 2026-08-23

Reviewer : agent indépendant `g6_review_final`

Candidat Git exact : `14c1268cfcdcbefdcee8bf7a6be10419ef307f14`

Diff contrôlé : `6381cbeb7020d57ac21e2086a3d5475d9d675325..14c1268cfcdcbefdcee8bf7a6be10419ef307f14`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 1 P1 ouvert.**

Les deux scénarios explicitement corrigés sont fermés : `quote.read` est désormais revalidé pour le guide de planning client, et le résumé Projet conserve puis revalide ses réservations et ressources sources. Les quatre paramètres `quoteId` OpenAPI sont aussi valides et couverts par un test sémantique. La correction de provenance n'est toutefois pas généralisée aux recommandations PlanyBot, qui continuent d'exposer des faits commerciaux et opérationnels dérivés sans conserver toutes leurs autorités sources.

## P1 — bloquant

### P1-1 — Les recommandations PlanyBot ne conservent pas la provenance du tarif client ni des réservations de continuité

`planyResourceRecommendations()` calcule le nombre d'utilisations antérieures d'une ressource depuis les réservations visibles du Projet (`server.js:1223-1225`) et consulte les grilles tarifaires du client sous permission `quote.read` (`server.js:1227`). La réponse expose ensuite `continuity`, `clientPreference` et les motifs « Déjà utilisée … fois » / « Tarif dédié actif pour ce client » (`server.js:1230-1235`).

Or `planyAccessSnapshot()` ne retient pour ces recommandations que les ressources et sites retournés (`server.js:1312`). Il n'ajoute `quote.read` que lorsqu'un identifiant de Devis est présent (`server.js:1319`) et ne reçoit aucun identifiant de réservation ayant alimenté le compteur de continuité. Les branches `bookingDraft` et `availability` retournent les recommandations sans `sourceAccess` ni `requiredPermissions` correspondant (`server.js:1295-1301`).

Deux restitutions historiques restent donc possibles après réduction des droits :

- après révocation de `quote.read`, une recommandation déjà produite peut encore révéler qu'une ressource bénéficie du tarif dédié du client ;
- après retrait du scope d'une réservation source, elle peut encore révéler son effet dans le compteur historique de continuité.

Impact : la règle G6 de revalidation des permissions et scopes courants à chaque lecture/rejeu reste incomplète pour une sortie métier visible. Le P1 provenance est réduit, mais pas fermé.

Correction attendue : faire remonter depuis le calcul des recommandations une provenance interne séparée du payload public, comprenant `requiredPermissions: ['quote.read']` dès qu'une préférence commerciale est consultée/exposée et les `reservationIds` contribuant aux continuités retournées. Persister cette provenance dans le snapshot et ajouter deux non-régressions replay + history : révocation de `quote.read` sur une recommandation avec préférence client, puis retrait d'une réservation contribuant à une continuité positive.

## Fermetures confirmées

1. **Guide planning client / `quote.read` : FERMÉ.** Le snapshot de schéma 2 persiste `requiredPermissions`, toute réponse liée à un Devis exige `quote.read`, et `planyAccessAllowed()` fail-close si la permission n'est plus accordée. Le test retire `quote.read` après création et obtient `404` au rejeu comme à l'historique.
2. **Résumé Projet / sources agrégées : FERMÉ.** La réponse ajoute `sourceAccess.reservationIds` et `sourceAccess.resourceIds`; ces identifiants sont fusionnés au snapshot puis revalidés. Les tests retirent successivement les scopes d'entités et confirment le refus du rejeu/historique.
3. **Paramètres OpenAPI `quoteId` : FERMÉ.** Les quatre opérations concernées déclarent un paramètre `in: path`, `required: true`, de schéma `string`. Le test automatisé parcourt désormais chaque template `{param}` et vérifie sa déclaration obligatoire ; le contrôle sémantique indépendant frais passe.
4. **Régressions adjacentes :** aucun autre P0/P1 n'a été identifié dans le diff ciblé et ses consommateurs relus. Le P1 restant concerne la même propriété de provenance, dans une branche adjacente non couverte par les nouvelles régressions.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `14c1268cfcdcbefdcee8bf7a6be10419ef307f14` |
| `node --test tests/plany.test.js tests/quotes.test.js tests/sprint6-plany-migration.test.js` | **PASS, 64/64**, 0 échec/skip/todo |
| `npm test` | **PASS, 270/270**, 0 échec/skip/todo, 8,525 s |
| Contrôle Ruby/Psych de tous les templates `{param}` OpenAPI | **PASS**, aucun paramètre de chemin absent ou non obligatoire |
| `git diff 14c1268 --` sur code/tests/spec G6 | aucun écart : les fichiers revus correspondent au commit exact |

Empreintes SHA-256 du candidat :

```text
server.js                                      3903abe5d6bf1503dd0102e0fa798f27c8da1a9bae67609ff74eaa85828c1f0c
app.js                                         d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54
docs/api/openapi-v1.yaml                       5c5da7dfd2ea2911a49432112adaad301eeab5ae63b9d6a9c175cce67a2aba84
tests/plany.test.js                            f3f292017f74163b6e30bb1653604d02c51d44860a87f84bf60b55e80b5a3294
tests/quotes.test.js                           16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a
tests/sprint6-plany-migration.test.js          317fbbf899c103520455d2b2dbf63df3f005d52940e5b74452cab7c4a48ad77c
docs/spec-sprint6-plany-conversation-import.md 94d4bd35683782043c63a6d52ffc1b13e74c6b2d1cf0cbcb5e35c8c322f93ae1
```

## Handoff

- Fichier modifié : `docs/code-review.md` uniquement.
- Aucun code, test, donnée ou autre rapport modifié.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur après correction et nouvelle re-REVIEW.

---

# Gate G6 — re-REVIEW indépendante des correctifs

Date : 2026-08-23

Reviewer : agent indépendant `g6_review_final`

Candidat Git exact : `6381cbeb7020d57ac21e2086a3d5475d9d675325`

Diff contrôlé : `cdc475c9ff015531e662327dbdc9d7c2e82f6aa8..6381cbeb7020d57ac21e2086a3d5475d9d675325`

Nature : revue seule ; seul `docs/code-review.md` est modifié

## Verdict terminal

**CHANGES REQUIRED — 0 P0, 2 P1 ouverts.**

Les correctifs ferment le contournement de clarification Excel → Devis et le défaut de bornage/décompression synchrone. Ils ferment aussi le cas précis du Projet inféré puis retiré du scope. Deux blocages subsistent néanmoins : la provenance PlanyBot ne couvre pas encore toutes les autorités réellement utilisées et les quatre chemins OpenAPI ajoutés sont structurellement invalides faute de déclaration du paramètre de chemin `quoteId`.

## P1 — bloquants

### P1-1 — La revalidation PlanyBot reste incomplète pour les permissions et les faits agrégés

`planyAccessSnapshot()` persiste bien les Projets, sites, Devis, imports, ressources, réservations et personnes explicitement présents dans les faits/actions (`server.js:1309-1317`). Le rejeu et l'historique appellent ensuite `planyAccessAllowed()` et le test de retrait du Projet inféré passe.

Deux autorités utilisées lors de la réponse ne sont toutefois pas conservées/revalidées :

- une réponse `clientPlanning` exige `quote.read` lors de sa création (`server.js:1255-1260`), mais une route `/plany/*` n'exige ensuite que `planning.read` (`server.js:2283`) et `planyAccessAllowed()` contrôle `quoteAllowed()` sans vérifier que `quote.read` est toujours accordé (`server.js:1326-1327`) ; après révocation de la permission commerciale avec scopes inchangés, le rejeu/historique peut donc restituer les faits du Devis ;
- le résumé Projet calcule `reservationCount`, `plannedDays` et `resourceCount` depuis les réservations accessibles, mais ne place dans ses faits que le Projet et les agrégats (`server.js:1287-1290`). La provenance ne contient donc ni les réservations ni les ressources ayant produit ces valeurs. Une réduction ultérieure de `entityScopes.reservation` ou `entityScopes.resource`, tout en conservant le Projet, ne rend pas ce résumé historique inaccessible.

Impact : la règle G6 §3.1 « chaque lecture revalide les permissions et scopes courants » n'est pas satisfaite pour toutes les réponses historiques. Le P1 historique est seulement partiellement fermé.

Correction attendue : persister les permissions/capacités requises par chaque réponse et tous les identifiants sources ayant contribué aux faits agrégés, puis les revalider au rejeu et à la lecture. Ajouter deux régressions : révocation de `quote.read` après une réponse `clientPlanning`, puis réduction des scopes Réservation/Ressource après un résumé Projet sans retrait du Projet.

### P1-2 — Les nouveaux chemins OpenAPI omettent leur paramètre `quoteId`

Les quatre routes auparavant absentes figurent désormais dans `docs/api/openapi-v1.yaml`, mais aucune ne déclare le paramètre de chemin obligatoire `quoteId` :

- `POST /quotes/{quoteId}/client-planning/analyze` ;
- `POST /quotes/{quoteId}/client-planning/apply-lines` ;
- `POST /quotes/{quoteId}/planning-conversion/preview` ;
- `POST /quotes/{quoteId}/planning-conversion`.

Le contrôle sémantique frais signale exactement ces quatre erreurs. Un template OpenAPI contenant `{quoteId}` doit déclarer un paramètre `in: path`, `required: true`, au niveau du chemin ou de chaque opération. Le simple parsing YAML et le test de présence textuelle des chemins ne détectent pas cette invalidité.

Impact : le contrat G6 n'est pas exploitable par une validation/génération OpenAPI standard et ne décrit pas complètement l'identité de la ressource appelée. Le quatrième P1 historique n'est que partiellement fermé.

Correction attendue : ajouter le paramètre `quoteId` aux quatre opérations, puis conserver un contrôle sémantique automatisé des paramètres de templates, pas seulement un parse YAML ou une recherche de chaînes.

## Fermetures confirmées

1. **Clarification Excel → Devis : FERMÉ.** `apply-lines` consomme `clientPlanningCurrentAnalysis()`, refuse les lignes non `matched/confirmed`, exige une ressource, et compare exactement ressource, libellé, durée et quantité à la dernière révision. L'interface directe enregistre d'abord les corrections versionnées. Les tests couvrent refus avant clarification, révision humaine, dérive refusée, application puis rejeu idempotent, sans réservation.
2. **Parseurs bornés : FERMÉ au gate REVIEW.** XLSX/PDF utilisent la décompression asynchrone ; les plafonds couvrent entrées ZIP utiles/totales, feuilles, octets par entrée et cumulés, lignes, colonnes, cellules, chaînes partagées, fusions, flux PDF et blocs texte. CSV est borné en lignes/colonnes/cellules. Le dépassement ZIP retourne `CLIENT_PLANNING_LIMIT_EXCEEDED` sans persistance. La mesure de réactivité et les charges adversariales complémentaires restent du ressort Performance/Sécurité.
3. **Cas Projet inféré : FERMÉ isolément.** Le test retire `project_1` du scope après une réponse sans contexte explicite ; rejeu et historique retournent tous deux `404`.
4. **Inventaire des routes G6 : PRÉSENT mais non valide.** Conversation, analyse, application, preview et conversion sont toutes listées ; le P1-2 porte sur leur validité structurelle.

## Régressions adjacentes et limites

- Aucun P0 ni autre P1 n'a été identifié dans le diff ciblé, ses consommateurs UI et les chemins Planning/Commercial relus.
- Le probe dynamique de révocation `quote.read` n'a pas pu ouvrir un port dans le sandbox (`listen EPERM`) et la demande d'autorisation locale a été interrompue. Le constat P1-1 repose donc sur le chemin statique déterministe décrit ci-dessus ; aucune affirmation de smoke réseau n'est faite.
- REVIEW n'a pas exécuté le navigateur E2E, la mesure de réactivité de l'event loop ni une batterie exhaustive de bombes ZIP/PDF. Ces preuves restent dues aux gates aval après correction des P1.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`, 2026-08-23.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `6381cbeb7020d57ac21e2086a3d5475d9d675325` |
| `node --test tests/plany.test.js tests/quotes.test.js tests/sprint6-plany-migration.test.js` | **PASS, 63/63**, 0 échec/skip/todo |
| `npm test` | **PASS, 269/269**, 0 échec/skip/todo, 8,889 s |
| Contrôle Ruby/Psych de tous les templates `{param}` OpenAPI | **FAIL**, quatre paramètres `quoteId` manquants listés au P1-2 |
| `git diff 6381cbe --` sur code/tests/spec G6 | aucun écart : les fichiers revus correspondent au commit exact |

Empreintes SHA-256 du candidat :

```text
server.js                                      458a9c08cb26cc45ecb3613f7d743d996a70100bd4ccbf38416c221bcce29062
app.js                                         d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54
docs/api/openapi-v1.yaml                        ea5a084ce6ce88fdf252108dac3d865c73506cecd331984fb9dbd5df46c4b83a
tests/plany.test.js                             34cbab3d8ffbc55cf961c801eb48ed6a11babace731939848136b9a4db3a7030
tests/quotes.test.js                            16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a
tests/sprint6-plany-migration.test.js           317fbbf11e4e341be7220d7893e3f59c7f45f970c4e357ea721912949d6f801b
docs/specifications/sprint-6-planybot-excel.md  9c1468a368a299eb5ee5a80a5c11348778d027ea1e00eea4fd7ff96a86a915f1
```

## Handoff

Le candidat retourne en DEV pour ces deux P1, puis doit repasser REVIEW et tous les gates aval impactés. Conformément au mandat mono-fichier, `docs/project-status.md` reste à mettre à jour par l'intégrateur. Toute modification du code, des tests ou de l'OpenAPI invalide cette re-REVIEW.

---

# Gate G6 — REVIEW indépendante Sprint 6 PlanyBot & import Excel

Date : 2026-08-23
Reviewer : agent indépendant `g5_review`
Candidat Git : `cdc475c9ff015531e662327dbdc9d7c2e82f6aa8`
Périmètre : `US-057` à `US-060`, `US-062` à `US-064`
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**NOT APPROVED — Gate REVIEW G6 bloqué**

**0 P0, 4 P1 ouverts.** Les tests existants sont verts et le cycle nominal « proposition → confirmation → moteur » est correctement séparé, mais le candidat ne satisfait pas encore les exigences de confidentialité historique, de clarification obligatoire, de bornage Excel et de contrat API du Sprint 6.

## Constats bloquants

### P1 — Les faits historiques ne sont pas systématiquement revalidés après réduction de scope

`planyFindProject()` permet de résoudre un Projet depuis le texte sans `context.projectId` (`server.js:1240-1243`), mais la conversation ne mémorise ensuite que les identifiants explicitement présents dans `context` (`server.js:1337`). Une conversation créée par « Résume Horizons » peut donc contenir des faits et noms liés au Projet tout en conservant `projectId: null`. La lecture d'historique accepte alors cette conversation, car `projectAllowed(auth, null)` est vrai (`server.js:1012`, `server.js:2706`). Le rejeu idempotent retourne également le résultat persisté avant toute revalidation des entités contenues dans ses faits lorsque la requête d'origine n'avait pas de contexte (`server.js:1330-1331`).

Impact : après retrait d'un scope Projet/ressource, un utilisateur peut encore relire ou rejouer des faits historiques devenus hors périmètre, contrairement à la règle explicite de la section 3.1 de la spécification G6.

Attendu : persister les scopes effectifs réellement utilisés par chaque réponse (Projet, site, Devis, import, ressources), puis les revalider sur lecture et rejeu ; masquer ou invalider tout message/résultat qui n'est plus autorisé. Ajouter un test de réduction de droits après une résolution de Projet par texte, sans contexte explicite.

### P1 — Le chemin « import Excel → Devis brouillon » contourne la clarification obligatoire

L'interface exclut explicitement `quoteClientPlanningImport` du wrapper de clarification et affiche directement « Ajouter au devis » (`app.js:646-652`). Côté serveur, `POST .../client-planning/apply-lines` lit toujours `imported.analysis.rows`, et non `clientPlanningCurrentAnalysis(imported)`, puis accepte n'importe quelle ligne source sans refuser les statuts `ambiguous` ou `unmatched` (`server.js:2504-2505`). Le client peut fournir lui-même `sourceId`, libellé et quantité et créer une ligne commerciale sans révision humaine ni motif audité.

Impact : `US-063` et la règle « aucune donnée incertaine appliquée avant validation humaine » sont contournables précisément sur le parcours de création directe d'un Devis depuis Excel. La protection présente dans `quotePlanningPreview()` ne couvre que la conversion Planning ultérieure.

Attendu : faire consommer à `apply-lines` la dernière révision, refuser les lignes ambiguës/non reconnues, vérifier qu'une ligne `confirmed` correspond exactement à la correction courante et faire passer l'interface de Devis direct par la même clarification versionnée. Ajouter les cas négatifs et le rejeu idempotent après révision.

### P1 — Le parseur XLSX n'applique pas les bornes structurelles et peut bloquer le serveur

Le fichier compressé est limité à 5 Mo, mais le lecteur ZIP autorise jusqu'à 2 000 entrées et gonfle chacune synchroniquement jusqu'à 20 Mo, sans plafond agrégé (`server.js:1961-1966`). La variante LES 50 parcourt ensuite toutes les feuilles correspondantes et matérialise leurs lignes (`server.js:1969-1991`). Il n'existe pas de limite explicite sur le nombre de feuilles exploitées, le total décompressé, les lignes, colonnes, cellules ou cellules fusionnées avant analyse.

Impact : un petit classeur fortement compressé peut provoquer une consommation CPU/mémoire très élevée et bloquer la boucle Node locale. Cela contredit les sections 3.4, 5 et 7 de la spécification, qui imposent des bornes serveur et une analyse non bloquante.

Attendu : imposer des plafonds globaux avant/durant la décompression (entrées utiles, octets cumulés, feuilles, lignes, colonnes, cellules, chaînes et fusions), interrompre dès dépassement avec une erreur stable, et ajouter des tests de bombe ZIP/feuilles et dimensions excessives ainsi qu'une mesure de réactivité.

### P1 — Le contrat OpenAPI G6 ne décrit pas tout le parcours exposé

Le document ajoute `/plany/messages`, la consultation/confirmation/refus d'une proposition et la création d'une révision. Il omet toutefois la lecture de conversation réellement exposée par `GET /api/v1/plany/conversations/{id}/messages`, ainsi que les routes d'analyse Excel, d'application vers le Devis et de prévisualisation/confirmation Planning sur lesquelles repose le parcours G6. La recherche ne trouve aucun chemin `client-planning/analyze`, `client-planning/apply-lines` ni `planning-conversion/preview` dans `docs/api/openapi-v1.yaml`.

Impact : le contrat ne sépare pas complètement conversation, analyse sans mutation, clarification et application confirmée comme l'exige la section 4. Les consommateurs ne disposent pas d'un contrat versionné suffisant pour vérifier le workflow ou les erreurs.

Attendu : documenter toutes les routes G6 effectivement consommées, leurs permissions, idempotence, erreurs stables, limites et schémas de réponse, puis ajouter une validation de cohérence OpenAPI/implémentation.

## P2 non bloquants

- Le classement de disponibilité traite toute ressource ayant un chevauchement comme entièrement occupée (`server.js:1294`, `server.js:1299`), même lorsque sa capacité résiduelle serait suffisante. Le moteur de confirmation reste autoritaire, mais les recommandations peuvent omettre des candidats valides.
- Le tri ajoute le nom avant l'identifiant comme départage (`server.js:1235-1238`), alors que la spécification définit l'identifiant opaque comme dernier critère stable. Ce choix doit être aligné ou documenté.
- Une proposition expirée reste persistée avec le statut `prepared`; la confirmation la refuse correctement, mais le statut `expired` documenté n'est jamais matérialisé. L'interface ne possède pas non plus l'action clavier distincte « Voir la prévisualisation », la prévisualisation étant toujours développée.
- `storeClientPlanningFile()` est exécuté avant la transaction de persistance de l'analyse (`server.js:2500-2501`) : une concurrence ou un échec tardif peut laisser un fichier privé orphelin. Prévoir nettoyage ou rattachement transactionnel.

## Points conformes vérifiés

- La préparation d'une proposition ne crée pas de réservation ; la confirmation exige `planning.write`, un digest et une clé d'idempotence, puis appelle `createReservationCommand()` qui revalide disponibilité/capacité.
- Les propositions sont privées par utilisateur, société, Projet, site et ressources ; les replays de confirmation divergents sont refusés.
- Le classement ne retourne jamais le coût brut et n'utilise ce critère qu'avec `finance.read`; la préférence client requiert `quote.read`.
- Les révisions Excel sont additives et immuables, portent digest, acteur, date et audit ; la conversion Planning compare la sélection à la dernière correction confirmée.
- La migration Sprint 6 crée une sauvegarde privée `0600`, vérifie son marqueur et dispose d'un rollback byte-exact précédé d'un export de récupération.
- L'interface échappe les contenus injectés, utilise des contrôles natifs clavier, annonce l'activité via `aria-live` et restaure le focus à la fermeture du panneau.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-23.

| Commande | Résultat |
|---|---|
| `git rev-parse HEAD` | `cdc475c9ff015531e662327dbdc9d7c2e82f6aa8` |
| `node --test tests/plany.test.js tests/quotes.test.js tests/sprint6-plany-migration.test.js` | **PASS, 61/61**, 0 échec/skip/todo, 4,757 s |
| `npm test` | **PASS, 267/267**, 0 échec/skip/todo, 8,647 s |
| `node --check server.js` | PASS |
| `node --check app.js` | PASS |
| `git diff --check` | PASS sur le candidat au lancement de REVIEW ; un rejeu final signale ensuite des espaces ajoutés concurremment dans `docs/qa-report.md`, hors ownership REVIEW |

Les tests verts démontrent les parcours nominaux mais ne couvrent aucun des quatre cas bloquants ci-dessus ; ils ne suffisent donc pas à approuver le gate.

## Empreintes du candidat revu

```text
server.js                                      2c8b7d270daee986524a6011dc1aa9551312af0a4c3dcab8dffe031fc116f372
app.js                                         2bef5de38aa129788b35b6e05a767390635d368984a02609079b0d8fa309c480
planning.css                                   788b3e981245b1927ce2f726b980ac2772848a16ca2c42d69f12c81a7ef1f99d
tests/plany.test.js                             9ea6407fb3b76b756584c2666d9e184a52f6ad9fcfc0380853baab1529f72687
tests/quotes.test.js                            20a28dc983e91b8aa0219ed79d8cac3739c0588d9ef19c19126f81accd86e9e2
tests/sprint6-plany-migration.test.js           317fbbf11e4e341be7220d7893e3f59c7f45f970c4e357ea721912949d6f801b
docs/api/openapi-v1.yaml                        8eb7cba34b35f9600d4f64bc76993d3cbbc27bc22e59382343e92356b58d2bf3
docs/specifications/sprint-6-planybot-excel.md  f498e70b697950cbf687d0ddcb9abb8c804114112505f9aef8a7e38adc9437a5
README.md                                       7186c0e926a58e6c461b18a1586eb59602eb63726331eeb7c0d97ea500410b75
```

## Limites et handoff

- Aucun test navigateur E2E du panneau, du focus et de la persistance après rechargement n'a été exécuté par REVIEW ; ce sera une preuve aval obligatoire après fermeture des P1.
- `docs/project-status.md` présente une modification concurrente non incluse dans le commit `cdc475c`; REVIEW ne l'a ni modifiée ni restaurée. L'intégrateur doit y consigner `G6 REVIEW = NOT APPROVED — 4 P1` après stabilisation du candidat.
- Le dernier `git diff --check` global est rendu rouge uniquement par des espaces finaux ajoutés concurremment dans `docs/qa-report.md`; `docs/code-review.md` ne contient pas d'erreur de whitespace dans le diff de cette REVIEW.

---

# Gate G5 — Re-REVIEW finale de la page Équipe autonome

Date : 2026-08-22
Reviewer : agent indépendant `g5_review`
Périmètre : route `#team`, annuaire minimal Personnel, compétences et indisponibilités
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**APPROVED — Gate REVIEW G5 validé sur le candidat final `#team`**

**0 P0, 0 P1 ouvert.** Le P1 constaté sur le premier candidat (annuaire vide pour un acteur planning dépourvu de `membership.read`) est fermé. La page utilise désormais une collection Personnel distincte, alimentée par un endpoint minimal autorisé par `planning.read` et cloisonné par société/site. Les formulaires utilisent cette même collection et le lien de gouvernance reste masqué sans `membership.read`.

## Contrôles effectués

- `GET /api/v1/personnel-directory` exige `planning.read`, impose la société issue de la session, applique `membershipAllowed()` et ne retourne que `id`, `displayName`, `jobTitle` et un `defaultSiteId` lui-même filtré par `siteAllowed()`.
- `app.js` sépare `personnelAdmin.directory` de `organization.memberships`; l'annuaire, les libellés et les sélecteurs de compétences/indisponibilités utilisent tous la collection dédiée.
- La route `#team` est reliée au routeur et rend une page autonome. Sans `planning.read`, elle affiche un refus explicite ; les mutations et leurs contrôles restent conditionnés par `planning.write` côté interface et côté serveur.
- Le lien « Gérer les accès » n'est rendu qu'avec `membership.read`, ce qui évite d'exposer une action de gouvernance inaccessible au planificateur.
- Les valeurs provenant de l'API sont échappées avant injection HTML. Les formulaires ont des libellés et champs requis, les suppressions ont un nom accessible, et l'état actif est aussi exprimé textuellement.
- Le contrat OpenAPI et les tests API/organisation couvrent l'annuaire minimal, le cloisonnement et le parcours planificateur. Le contrôle navigateur transmis sur le candidat exact montre deux membres et des sélecteurs renseignés.

## Preuves sur le candidat exact

Environnement : macOS, 2026-08-22. Les preuves DEV/QA ci-dessous ont été transmises pour les mêmes empreintes ; REVIEW n'a pas relancé la suite longue.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/api.test.js` | **PASS, 41/41** (preuve DEV/QA transmise) |
| `node --test tests/organization.test.js` | **PASS, 34/34** (preuve DEV/QA transmise) |
| `npm test` | **PASS, 262/262** (preuve DEV/QA transmise) |
| `node --check server.js` | PASS, preuve REVIEW fraîche |
| `node --check app.js` | PASS, preuve REVIEW fraîche |
| Contrôle navigateur avec acteur planificateur | PASS : 2 membres visibles, sélecteurs renseignés (preuve transmise) |
| Inspection RBAC, cloisonnement, XSS et accessibilité | PASS, aucun P0/P1 |

Hashes complets revus :

```text
server.js                         8b1e180f94c0101342e4ecda6258e23d5ddafd99c1e9caecdff5cbbd3c51063a
app.js                            8a122679a279beedb6c0d6cd8f0bf9197a36124bc60c55bef25d35b93f9823b7
index.html                        edada446944aa48c1782028dc52e8b35cf00589156a3016ab0a2cd1bf97504ae
planning.css                      4016e6d89ac521cfc22eb42aad17ef16d54db5720e6e8df0bebf6c4739cc57d1
tests/api.test.js                 f5c788f3cf74e1fb810b0730a8d18269922179eca7576eeec6ff02bbeb08d2f3
tests/organization.test.js        665257902c792725f0978a5726238eafb5596b2b8059b164dd9169c93741fe16
docs/api/openapi-v1.yaml          75a83115cbeb5712f237884cc9144726e8cfa5b9e0a455d98ab386c1048e2c1e
```

## P2 non bloquants

- Le lien principal « Équipe » reste visible pour un rôle sans `planning.read`; la page échoue correctement et explicitement, mais masquer aussi le lien rendrait la navigation plus cohérente avec les permissions.
- Les événements SSE `personSkill.updated.v1` et `personUnavailability.updated.v1` ne déclenchent pas encore de rafraîchissement de la page Équipe : une modification effectuée dans une autre session nécessite un rechargement. Cela n'altère ni l'autorité serveur ni la persistance.

## Limites et handoff

- `git diff --check` est actuellement rouge à cause d'un espace final déjà présent dans `docs/security-review.md`, fichier hors ownership de REVIEW ; aucun correctif étranger n'a été appliqué.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur avec `G5 REVIEW #team = APPROVED — 0 P0/P1`.

---

# Gate G5 — Re-REVIEW finale du cloisonnement Personnel

Date : 2026-08-21  
Reviewer : agent indépendant `g5_review`  
Périmètre : nouveau candidat après correction des lectures et annulations d'indisponibilités inter-site  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**APPROVED — Gate REVIEW G5 validé sur le candidat final**

**0 P0, 0 P1 ouvert.** Le changement postérieur à la REVIEW précédente ferme correctement l'accès HTTP inter-site aux indisponibilités Personnel, sans régression observée sur les quatre corrections G5 déjà approuvées.

## Correctif final vérifié

- La liste `GET /api/v1/person-unavailabilities` filtre maintenant chaque snapshot avec `personnelSnapshotAllowed()`, donc tenant, site porté par l'indisponibilité et adhésion visible sont tous exigés (`server.js:2089`, `server.js:2138`). Un simple filtre `membershipId` ne peut plus réintroduire un élément hors site.
- `DELETE /api/v1/person-unavailabilities/{id}` applique le même prédicat avant le contrôle de version et avant toute mutation (`server.js:2140`). Un identifiant deviné hors site répond `404 NOT_FOUND`, sans révélation de version ni changement d'état.
- Le rejeu idempotent est également revalidé contre le snapshot courant : une ancienne autorisation ne permet pas de rejouer une annulation après réduction de scope.
- Le test HTTP crée une indisponibilité Boulogne, utilise un acteur `planning.write` limité à Paris, vérifie la liste masquée, le `DELETE 404`, puis relit avec l'admin et confirme que le statut reste `confirmed` (`tests/api.test.js:49-54`, `tests/api.test.js:209-220`).
- Les quatre fermetures P1 précédentes restent intactes : option simple indépendante, matrice SSE fail-closed, présence clavier et notification de libération logout/TTL.

## P2 non bloquants conservés

Les quatre P2 de la REVIEW précédente restent inchangés : clé d'intention idempotente des formulaires Personnel, absence de consommation SSE Personnel dans O3, test du rollback avancé/OpenAPI incomplets, et profondeur de preuve révocation SSE/expiration TTL. Aucun n'est aggravé par ce correctif.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/api.test.js` hors sandbox | **PASS, 40/40**, 0 échec/skip/todo, 2,015 s |
| `node --test tests/planning-postproduction.test.js` | **PASS, 43/43**, 0 échec/skip/todo, 122 ms |
| `node --test tests/sprint5-realtime.test.js` hors sandbox | **PASS, 1/1**, 0 échec/skip/todo, 2,111 s |
| `node --test tests/sprint5-migration.test.js` | **PASS, 1/1**, 0 échec/skip/todo, 225 ms |
| `node --check server.js` | PASS |
| `node --check app.js` | PASS |
| `git diff --check` | PASS |
| Inspection GET/DELETE/rejeu inter-site | PASS : lecture masquée, mutation introuvable, état inchangé |

La première tentative du test temps réel dans le sandbox a été refusée par l'environnement (`listen EPERM 127.0.0.1`) avant exécution du scénario ; son rejeu autorisé hors sandbox est vert et constitue la preuve retenue. La suite complète n'a pas été rejouée par REVIEW ; le gate QA/intégration porte séparément la preuve `260/260` sur ce candidat.

Hashes complets du candidat final revu :

```text
server.js                                        b9b6294f5816ca8ed12d7be1789127e4a9bc1f19d7f2e25a12ef8a3db5c0d200
app.js                                           04f7a5a9ce015e6d2ae00d1faa092f63023ded430c2c8dff11944f1e394f5054
planning.css                                     4016e6d89ac521cfc22eb42aad17ef16d54db5720e6e8df0bebf6c4739cc57d1
tests/api.test.js                                1e581cec20a6f19e82d91dee9fa953ec3d20858803f11a53e9652229c2ec342b
tests/planning-postproduction.test.js            9c5721e024c6e25161916c1a256202f1a289a80a86ae62e6b967764a714e061f
tests/sprint5-realtime.test.js                    d8b17b3ac2f35b70d654552920387f4108f2ad18e0b7763d1e334db9f9320cf9
tests/sprint5-migration.test.js                   d32231df043658ec415e3368f9f57763a6b5bcf280e793e8b62237dfadc441b7
docs/api/openapi-v1.yaml                         a588ec9eb527b62034f426369b45fa901324020bf6d4dca945a7068a033b5575
docs/specifications/sprint-5-advanced-resources-realtime.md 7f264fb3094ee4b51e064a2f943a834bd3af93eec0666425522f5f4993869350
```

## Handoff

- Fichier modifié : `docs/code-review.md` uniquement.
- Le verdict précédent est supersédé par celui-ci pour les empreintes finales ci-dessus.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur avec `G5 REVIEW final = APPROVED — 0 P0/P1`.

---

# Gate G5 — Re-REVIEW indépendante du candidat corrigé Sprint 5

Date : 2026-08-21  
Reviewer : agent indépendant `g5_review`  
Périmètre : fermeture des quatre P1 REVIEW du candidat Sprint 5, puis recherche de régressions sur `US-068`, `US-070` à `US-076`  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**APPROVED — Gate REVIEW G5 validé**

**0 P0, 0 P1 ouvert.** Les quatre défauts bloquants de la première REVIEW sont corrigés sans régression bloquante observée : une option simple reste indépendante, les événements SSE sont classifiés par permission et échouent fermés, les gestes clavier passent par le verrou court, et les libérations logout/TTL notifient les autres sessions. Les preuves ciblées fraîches couvrent le candidat exact et sont toutes vertes.

## Fermeture des quatre P1

### 1. Option simple indépendante et double option structurée — fermé

- `patchReservation()` ne déclenche désormais l'arbitrage que pour une transition `option → confirmed` portant un `optionGroupId` non vide (`server.js:2827-2835`). Les concurrents et perdants ne sont donc jamais recherchés pour une option simple.
- Le test négatif crée deux options simples indépendantes, confirme la première et vérifie que la seconde conserve statut, version et absence de décision.
- Une double option groupée conserve le contrôle de priorité et le perdant visible. `optionAlternativeResources()` filtre les ressources actives du même tenant/site, compatibles avec la catégorie ou le type, autorisées et sans erreur/conflit (`server.js:2808-2814`) ; ces alternatives structurées sont attachées à la décision perdante (`server.js:2844-2847`).

### 2. Permissions et scopes SSE — fermé

- `ssePermissionsForEvent()` classe explicitement Réservation/Personnel sous `planning.read`, Ressource/Catégorie sous `resource.read` et les autres familles connues sous leur permission de lecture (`server.js:1078-1092`). Une famille inconnue retourne une liste vide et n'est pas diffusée.
- À chaque émission, le serveur reconstruit le contexte courant de la session, vérifie au moins une permission requise, le tenant, le site et le scope d'entité avant l'écriture SSE (`server.js:1069-1070`, `server.js:1113-1123`). Une révocation est donc prise en compte sans conserver l'ancien contexte.
- L'ouverture du flux exige au moins une famille lisible, limite une connexion par session et applique une capacité globale (`server.js:2585`). Les tests contractuels vérifient les classifications sensibles et l'échec fermé ; le scénario trois sessions confirme la diffusion autorisée et le refus du second flux d'une même session.

### 3. Présence sur les commandes clavier — fermé

- `withPlanningPresence()` acquiert la présence, annule la commande en cas de refus et libère systématiquement dans un `finally` (`app.js:113-115`).
- Les déplacements verticaux, déplacements temporels et redimensionnements clavier passent tous par ce wrapper avec l'intention `moving` ou `resizing` (`app.js:867-879`). Ils utilisent donc le même protocole que les gestes pointeur et restent soumis au `423` serveur et au contrôle final de `version`.
- Le test Planning lie explicitement les trois chemins clavier au wrapper de présence et conserve la couverture des alternatives accessibles.

### 4. Libération logout/TTL diffusée — fermé

- Chaque présence conserve un snapshot minimal de la réservation et un minuteur. `releaseReservationPresence()` supprime l'entrée, annule le minuteur puis émet `reservation.presenceReleased.v1` (`server.js:1073-1076`). Cette même fonction est appelée par libération manuelle, expiration TTL et libération de toutes les présences d'une session.
- Le logout supprime la session sortante, libère ses présences puis ferme ses propres flux ; les autres sessions autorisées reçoivent l'invalidation (`server.js:2127`).
- Le test temps réel attend explicitement l'événement de libération sur le second observateur avant de réacquérir la réservation, puis confirme la persistance et les invalidations après redémarrage.

## Régressions recherchées et points conformes

- Les allocations génériques conservent catégorie, `genericAllocationId`, compatibilité, disponibilité, contrôle de version, scope, audit et rejeu idempotent.
- Le filtrage PlanyBot tient maintenant compte du site de l'indisponibilité : une absence locale n'exclut plus la personne sur un autre site (`server.js:1185-1187`).
- Les snapshots Personnel vérifient tenant, site et adhésion visible avant lecture ou diffusion.
- Les intervalles restent semi-ouverts ; options et réservations confirmées consomment la capacité ; les états terminaux restent protégés.
- Le reset déterministe annule les minuteurs de présence et vide la structure éphémère (`server.js:274-280`).
- Aucun préfixe effectivement émis par le candidat n'est laissé hors de la matrice SSE ; les familles inconnues restent silencieuses.
- Syntaxe backend/frontend et whitespace Git restent valides.

## P2 non bloquants

1. **Clé d'intention UI Personnel** — `automaticIdempotencyKey()` reste dérivée uniquement du chemin et du corps (`app.js:40-41`). Après archivage/annulation, une nouvelle intention utilisateur strictement identique peut rejouer le résultat historique au lieu de créer un nouvel objet actif. Une clé doit rester stable pendant un retry mais changer entre deux soumissions distinctes.
2. **Rafraîchissement O3 Personnel** — le serveur diffuse les invalidations `personSkill.*` et `personUnavailability.*`, mais `startEvents()` ne les consomme pas (`app.js:54`). Deux administrateurs ouverts sur O3 ne voient donc pas immédiatement leurs changements réciproques sans rechargement.
3. **Rollback avancé et OpenAPI** — le test de migration exécute le rollback Personnel mais pas `rollbackSprint5AdvancedResources`. OpenAPI ne documente pas le `200` de rejeu des créations Personnel (`docs/api/openapi-v1.yaml:282-320`) et rattache encore `cancelReservation` à `/reservations/{reservationId}/generic-assignments` plutôt qu'à `/reservations/{reservationId}` (`docs/api/openapi-v1.yaml:392-449`).
4. **Profondeur de preuve SSE/TTL** — les contrôles automatisés prouvent la matrice fail-closed, la limite de flux, la diffusion autorisée et la libération au logout ; ils ne simulent pas encore un rôle personnalisé sans permission puis une révocation en plein flux, ni l'attente réelle des 20 secondes d'expiration. L'implémentation relit toutefois le contexte à chaque émission et partage le même chemin de libération pour le TTL.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/api.test.js` hors sandbox | **PASS, 39/39**, 0 échec/skip/todo, 1,921 s |
| `node --test tests/planning-postproduction.test.js` | **PASS, 43/43**, 0 échec/skip/todo, 123 ms |
| `node --test tests/sprint5-realtime.test.js` hors sandbox | **PASS, 1/1**, 0 échec/skip/todo, 2,093 s |
| `node --test tests/sprint5-migration.test.js` | **PASS, 1/1**, 0 échec/skip/todo, 228 ms |
| `node --check server.js` | PASS |
| `node --check app.js` | PASS |
| `git diff --check` | PASS |
| Inspection statique options/SSE/présence/TTL | PASS : les quatre chemins bloquants sont fermés sur les lignes citées |

La suite `npm test` complète n'a pas été rejouée par REVIEW : les sous-suites affectées ont été exécutées directement et le gate QA indépendant porte la preuve complète séparée sur le même candidat.

Hashes complets du candidat approuvé :

```text
server.js                                        dd5d410a47670be5e50b313fa1634357f2b5718e645bde93c9987a0b368abe21
app.js                                           04f7a5a9ce015e6d2ae00d1faa092f63023ded430c2c8dff11944f1e394f5054
planning.css                                     4016e6d89ac521cfc22eb42aad17ef16d54db5720e6e8df0bebf6c4739cc57d1
tests/api.test.js                                a1833d491bd36782031a2d1ccb72d762990e9dab34f124045f1fa5b23e0bba72
tests/planning-postproduction.test.js            9c5721e024c6e25161916c1a256202f1a289a80a86ae62e6b967764a714e061f
tests/sprint5-realtime.test.js                    d8b17b3ac2f35b70d654552920387f4108f2ad18e0b7763d1e334db9f9320cf9
tests/sprint5-migration.test.js                   d32231df043658ec415e3368f9f57763a6b5bcf280e793e8b62237dfadc441b7
docs/api/openapi-v1.yaml                         a588ec9eb527b62034f426369b45fa901324020bf6d4dca945a7068a033b5575
docs/specifications/sprint-5-advanced-resources-realtime.md 7f264fb3094ee4b51e064a2f943a834bd3af93eec0666425522f5f4993869350
```

## Limites et handoff

- Aucun E2E navigateur n'a été exécuté par REVIEW ; l'intégrateur doit conserver le contrôle navigateur multi-session au gate E2E.
- Fichier modifié : `docs/code-review.md` uniquement.
- Conformément à l'exception mono-fichier, `docs/project-status.md` reste à mettre à jour par l'intégrateur avec `G5 REVIEW = APPROVED — 0 P0/P1`.
- Les quatre P2 restent à planifier ; ils ne bloquent pas REVIEW selon le contrat de gate.

---

# Gate G5 — REVIEW indépendante du candidat Sprint 5

Date : 2026-08-21  
Reviewer : agent indépendant `g5_review`  
Périmètre : `US-068`, `US-070` à `US-076` — double option, ressources génériques, personnel, présence/verrou court, SSE, idempotence, migrations et rollback  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**CHANGES REQUESTED — Gate REVIEW G5 bloqué**

**0 P0, 4 P1 ouverts, 4 P2 ouverts.** Les tests existants sont verts sur le candidat exact, mais ils ne couvrent pas quatre écarts bloquants aux critères Sprint 5 : l'arbitrage d'une option simple peut altérer des options sans rapport, les flux SSE Réservation/Ressource ne revalident pas leur permission de lecture, les commandes clavier contournent le protocole de présence, et la libération au logout/TTL n'est pas diffusée aux autres sessions.

## Constats bloquants

### P1 — Confirmer une option simple arbitre toutes les options sans groupe du tenant

- `patchReservation()` définit `confirmingOption` pour toute transition `option → confirmed`, même lorsque `item.optionGroupId` est absent (`server.js:2795`). Une option simple sans métadonnées de double option est pourtant autorisée par `validateReservation()` (`server.js:1272-1274`).
- Avec `optionGroupId === undefined`, les filtres de `server.js:2803` et `server.js:2813` sélectionnent toutes les autres réservations `option` dont le groupe est également absent, y compris sur d'autres ressources, projets, périodes ou sites de la même société.
- Ces options sans rapport sont temporairement exclues du contrôle de capacité puis reçoivent `optionDecision.state = "lost"` et une incrémentation de version. Cela constitue une mutation collatérale silencieuse de données métier.
- Le test `Sprint 5 double option` ne crée que deux options explicitement groupées ; aucun négatif ne confirme une option simple en présence d'une autre option simple indépendante.
- En outre, le perdant ne reçoit que `winnerReservationId` : aucune ressource alternative structurée n'est calculée ni affichée, contrairement au contrat §3/§4.

Correction attendue : n'exécuter l'arbitrage de groupe que si le groupe complet est présent et valide, conserver le comportement normal d'une option simple, borner les concurrents au contrat explicite, fournir les alternatives promises et tester options groupées/non groupées sur plusieurs projets/sites.

### P1 — Les événements SSE Réservation et Ressource ne contrôlent pas la permission de lecture

- `/api/v1/events` accepte toute session authentifiée ; sa résolution de permission de route est `null` (`server.js:2107`, `server.js:2561`).
- `ssePermissionForEvent()` (`server.js:1073`) exige `planning.read` uniquement pour Personnel et `quote.read` pour Commercial. Les familles `reservation.*` et `resource.*` retournent `null`.
- `emit()` diffuse donc ces métadonnées à un rôle personnalisé sans `planning.read`/`resource.read` dès lors que ses scopes d'entités ne l'excluent pas (`server.js:1097-1099`). `reservationAllowed()` et `resourceAllowed()` contrôlent les scopes, pas les permissions.
- Cela contredit l'invariant §2.3 et le §5 : toute diffusion SSE doit revalider permission, société, site, projet et entités. Le test SSE utilise uniquement des rôles Admin/Planner autorisés et ne couvre pas un abonné authentifié sans droit Planning/Ressource.

Correction attendue : classifier explicitement chaque famille SSE avec sa permission (`planning.read`, `resource.read`, etc.), échouer fermé pour toute famille sans classification, puis tester un rôle sans permission et une révocation de permission pendant le flux.

### P1 — Les alternatives clavier déplacent/redimensionnent sans acquérir la présence

- Le gestionnaire clavier de `app.js:860-878` appelle directement `movePlanningCellByRoom()`, `changePlanningBookingTime()`, `moveWholePlanningBooking()` ou `resizePlanningBooking()`.
- Aucune de ces fonctions n'appelle `acquirePlanningPresence()`. L'acquisition ajoutée à `app.js:883` et `app.js:890` ne couvre que l'ouverture du formulaire et `pointerdown`.
- Un utilisateur clavier peut donc initier une mutation sans que les autres opérateurs voient « X modifie cette réservation », contrairement au critère UI explicite §4 « les alternatives clavier […] déclenchent le même protocole de présence ».
- Le test frontend Sprint 5 vérifie seulement la présence de chaînes/fonctions par expressions régulières ; il ne relie pas le chemin clavier à l'acquisition.

Correction attendue : acquérir avec l'intention correcte avant chaque commande clavier sensible, annuler la mutation si l'acquisition échoue, libérer après fin/annulation et ajouter un test comportemental clavier.

### P1 — Logout et expiration suppriment le verrou sans notifier les autres sessions

- `releaseReservationPresenceForToken()` (`server.js:1070`) supprime silencieusement les entrées de la Map. Le logout l'appelle puis ferme uniquement les flux SSE de la session sortante (`server.js:2104`).
- `pruneReservationPresence()` supprime également les verrous expirés sans produire `reservation.presenceReleased.v1`.
- Les autres navigateurs ne rechargent la présence que lorsqu'ils reçoivent `reservation.presence.v1` ou `reservation.presenceReleased.v1` (`app.js:54`). Il n'existe pas de minuterie UI qui re-rende la carte à `expiresAt`.
- Le test trois sessions confirme seulement qu'une seconde session peut réacquérir juste après le logout ; il n'attend aucun événement de libération sur l'autre flux. Le critère S5-D exige pourtant la diffusion SSE et la libération à la déconnexion.

Correction attendue : diffuser une invalidation de libération autorisée pour chaque verrou retiré au logout/expiration, ou fournir un mécanisme équivalent borné côté client, puis prouver que les deux observateurs retirent l'état verrouillé sans rechargement manuel.

## Constats non bloquants

### P2 — Une même action légitime ne peut pas être recréée après archivage depuis l'UI

`automaticIdempotencyKey()` (`app.js:35-36`) dérive la clé du chemin et du corps. Les formulaires Personnel n'ajoutent pas de clé d'intention aléatoire (`app.js:925`). Après archivage d'une compétence, recréer exactement la même compétence rejoue donc éternellement le premier résultat historique au lieu de créer une nouvelle version active. Même risque pour une indisponibilité annulée puis ressaisie à l'identique. La clé doit rester stable pendant un retry, mais changer entre deux intentions utilisateur distinctes.

### P2 — Le site d'une indisponibilité n'est pas respecté par le filtrage PlanyBot

`PersonUnavailability.siteId` est optionnel et la recherche reçoit un `siteId`, mais `planyAvailablePeople()` (`server.js:1164`) exclut une personne dès qu'une indisponibilité temporelle intersecte, sans comparer les sites. Une indisponibilité enregistrée pour Paris bloque donc aussi une proposition sur un autre site. Clarifier la sémantique puis filtrer `siteId` de façon cohérente et ajouter un test multi-site.

### P2 — Les événements Personnel ne sont pas consommés par l'interface O3

Le serveur diffuse `personSkill.updated.v1` et `personUnavailability.updated.v1`, mais `startEvents()` (`app.js:54`) ne recharge que Présence, Réservation et Ressource ; les écouteurs Organisation n'incluent pas les familles Personnel. Deux administrateurs ouverts sur O3 ne voient donc pas leurs changements réciproques en temps réel, malgré la couche SSE ajoutée et testée au niveau transport.

### P2 — Couverture rollback et contrat OpenAPI incomplets

- `tests/sprint5-migration.test.js` démontre seulement `rollbackSprint5Personnel`; aucun test dédié n'exécute `rollbackSprint5AdvancedResources` alors que le rollback S5-B est un critère de sortie.
- Les créations Personnel peuvent répondre `200` lors d'un rejeu exact mais OpenAPI ne documente que `201` (`docs/api/openapi-v1.yaml:282-320`).
- Le `delete: cancelReservation` est rattaché dans le YAML à `/reservations/{reservationId}/generic-assignments` au lieu de `/reservations/{reservationId}` (`docs/api/openapi-v1.yaml:415-449`), ce qui induit les consommateurs en erreur.

## Points conformes vérifiés

- Les empreintes correspondent exactement au candidat annoncé et n'ont pas varié pendant la revue.
- Les allocations génériques séparent catégorie et ressource réelle, conservent `genericAllocationId`, contrôlent version, compatibilité, disponibilité, scope, audit et rejeu.
- Les mutations Personnel exigent `planning.write`, CSRF/Origin, scope d'adhésion, validation bornée, version à l'annulation et idempotence avec conflit de payload ; l'audit/SSE n'est pas répété au rejeu.
- Les intervalles d'indisponibilité sont semi-ouverts et les chevauchements actifs sont refusés.
- Le scénario trois sessions couvre deux observateurs SSE, `423`, `409` sans écrasement, persistance et reconnexion après redémarrage.
- Les sauvegardes et exports Personnel sont privés (`0600`) et la restauration testée est byte-exacte.
- L'UI utilise un libellé textuel pour la présence et les décisions d'option, sans dépendre uniquement de la couleur.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/planning-postproduction.test.js` | **PASS, 43/43**, 0 échec/skip/todo, 129 ms |
| `node --check server.js` | PASS |
| `node --check app.js` | PASS |
| `git diff --check` | PASS |
| Inspection flux option simple | **FAIL fonctionnel déterministe** : `undefined === undefined` sélectionne les options sans groupe comme concurrentes/perdantes |
| Inspection permission SSE | **FAIL autorisation** : Réservation/Ressource ont `requiredPermission = null` |
| Inspection clavier → présence | **FAIL critère UI** : les appels de mutation clavier ne passent pas par `acquirePlanningPresence()` |
| Inspection logout/TTL → SSE | **FAIL temps réel** : suppression Map sans émission `presenceReleased` |

La reproduction HTTP locale isolée envisagée pour l'option simple n'a pas démarré : la demande d'autorisation a été interrompue. Aucun résultat dynamique n'est revendiqué pour cette commande. La suite complète n'a pas été rejouée par REVIEW à la demande de l'intégrateur ; le gate QA indépendant fournit séparément la preuve 257/257.

Hashes complets du candidat revu :

```text
server.js                                        54ec6fd513df647c578690317b64e5ba532626099c56282589f66519459b76b0
app.js                                           400d3e045b9ee9caffdea1aa0f81559f21cd61c830267a6e0eb270ae4dcba0fa
planning.css                                     4016e6d89ac521cfc22eb42aad17ef16d54db5720e6e8df0bebf6c4739cc57d1
tests/api.test.js                                080a40c806eaefac5a06d4aea8ab23dee35b5a25f3db13419338a31c0f1defe7
tests/planning-postproduction.test.js            f2827562b1bfa54d52e3ed90f1dcb3c0a690945b6d750e082f941be43953b04a
tests/sprint5-realtime.test.js                    c7c7a0ea2f9451c55ead7ceae87170cba322b30df8244fb3e7199578f73f6747
tests/sprint5-migration.test.js                   d32231df043658ec415e3368f9f57763a6b5bcf280e793e8b62237dfadc441b7
docs/api/openapi-v1.yaml                         a588ec9eb527b62034f426369b45fa901324020bf6d4dca945a7068a033b5575
docs/specifications/sprint-5-advanced-resources-realtime.md 01693a430b00a243d96c2fc307da795bbfc5d84642202260cf02168581616faa
```

## Limites et handoff

- Aucun E2E navigateur n'a été exécuté par REVIEW ; le rendu O3 et les gestes réels restent à revalider après correction.
- Fichier modifié : `docs/code-review.md` uniquement.
- Conformément à l'exception de tâche mono-fichier, `docs/project-status.md` reste à mettre à jour par l'intégrateur avec `G5 REVIEW = CHANGES REQUESTED — 4 P1`.
- Après correction, revenir à DEV puis repasser REVIEW et tous les gates aval impactés sur les nouvelles empreintes.

---

# Gate G4 — Re-REVIEW ultime du correctif DST automnal

Date : 2026-08-21  
Reviewer : agent indépendant `g3_review`  
Périmètre : alignement de l'occurrence DST répétée entre frontend et batch, consolidation finale des correctifs G4  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**APPROVED — Gate REVIEW G4 validé**

**0 P0, 0 P1 ouvert.** Le dernier défaut bloquant est fermé : `move` et `duplicate` choisissent désormais l'occurrence précoce de l'heure automnale répétée, comme le frontend. Les heures printanières inexistantes restent refusées sans mutation, le rejeu historique reste protégé par le scope courant et les trois autres familles de P1 G4 ne régressent pas.

## Fermeture du dernier P1

- `exactZonedDateTimeIso()` (`server.js:1850-1857`) collecte les offsets IANA observables autour de la journée, construit tous les instants dont le round-trip reproduit exactement date et heure civiles, les trie par instant croissant puis retient le premier.
- Pour `2027-10-31 02:30 Europe/Paris`, les deux occurrences restent distinguables et le résultat serveur est maintenant `2027-10-31T00:30:00.000Z`, soit l'occurrence `earlier` CEST attendue par `planningZonedIso()` côté frontend.
- Le test API couvre séparément un `move` et un `duplicate` vers cette cible et vérifie dans les deux réponses l'instant `00:30Z`.
- L'heure inexistante du printemps continue de ne produire aucun candidat : move et duplicate retournent `422 VALIDATION_ERROR`; le move conserve instant et version de la source.

## Consolidation des fermetures G4

- **Temporalité** : date/heure civiles dérivées dans le fuseau du site, minuit et changement d'offset représentable conservés, heure inexistante refusée, heure répétée alignée sur `earlier`.
- **Rejeu/scope** : accès simultané exigé au snapshot historique et à la réservation courante, y compris Projet, site, ressource principale et overrides ; le replay après déplacement de ressource puis réduction du scope retourne `404` sans fuite.
- **Undo/Redo** : versions attendues conservées et rafraîchies après compensation ; divergence refusée par le serveur ; piles bornées à 50 et purgées avec les autres états transitoires au changement de société.
- **Sélection/accessibilité** : rectangle borné aux cellules rendues, Maj+clic et Maj+Entrée, état `aria-pressed` synchronisé.
- **Autosave** : compteur des mutations concurrentes, `saving` jusqu'à la dernière intégration, puis `synced` ou `offline` selon le résultat réseau.
- **Batch/Commercial** : atomicité, idempotence, version, terminalité, conflits intra-lot, liens Projet/Devis/ligne, moteur vendu-planifié et complément `+5 → +3 → 0` restent couverts sans régression automatisée.

## P2 non bloquants conservés

1. `docs/api/openapi-v1.yaml:324-329` omet encore les réponses batch `400 IDEMPOTENCY_KEY_REQUIRED` et les gardes `401/403` réellement possibles.
2. Les audits métier portent `batchIndex`, mais `batchReservations()` ne produit pas l'audit récapitulatif batch explicite demandé au §5 (taille, familles d'actions, résultat) ; l'`operationId` batch reste dans le résultat/marker.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/api.test.js` hors sandbox | **PASS, 32/32**, 0 échec/skip/todo, 1,544 s |
| `node --test tests/planning-postproduction.test.js` | **PASS, 38/38**, 0 échec/skip/todo, 115 ms |
| `npm test` hors sandbox | **PASS, 245/245**, 0 échec/skip/todo, 8,163 s |
| `node --check server.js` | PASS |
| `node --check app.js` | PASS |
| `git diff --check` | PASS |
| Move automne `2027-10-31 02:30` | PASS : `00:30Z`, occurrence `earlier` |
| Duplicate automne `2027-10-31 02:30` | PASS : `00:30Z`, occurrence `earlier` |
| Move/duplicate printemps inexistant | PASS : `422`, aucune mutation source |
| Rejeu historique après changement de ressource/scope | PASS : entité courante lisible, ancien snapshot `404` |

Hashes complets du candidat approuvé :

```text
server.js                                31f2e713320acae6833aef5b55a05701e7734cb7365679d896cf5389aa066b3b
app.js                                   16dc6c21c3241fdd9d5391546ccafa7110cc11d63dbecc2b69762cc8543d4c84
planning.css                             e4df59fc44cf624241bf4bd822b5059cbefd1ec4b109f65ca1cb9e8b5fbcf45f
tests/api.test.js                        05a7d439035f7706d60346267b23cd49b33d9d1b8ce222c6c9bf1021bf073c27
tests/planning-postproduction.test.js    7cb607aa612905690c1356a333eba7d5a5adeeaac1c00e9eedd938d0f09438c3
docs/api/openapi-v1.yaml                 20eef6d443681732d5f04a2d730133beebbdb5aac78cc6d890b3c3fdd201b1a9
package.json                             abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

## Limites et handoff

- Aucun E2E navigateur n'a été exécuté par cette REVIEW ; les interactions DOM restent à confirmer au gate E2E sur ce même candidat.
- Fichier modifié : `docs/code-review.md` uniquement. L'intégrateur doit reporter `G4 REVIEW = APPROVED — 0 P0/P1` dans `docs/project-status.md`.
- Les deux P2 restent à planifier ; ils ne bloquent pas le verdict REVIEW selon le contrat de gate.

---

# Gate G4 — Re-REVIEW finale du candidat DST/scope

Date : 2026-08-21  
Reviewer : agent indépendant `g3_review`  
Périmètre : correctif DST exact move/duplicate, rejeu historique après évolution de ressource et réduction de scope, consolidation des P1 G4  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**CHANGES REQUESTED — Gate REVIEW G4 reste bloqué**

**0 P0, 1 P1 ouvert, 2 P2 ouverts.** Les heures locales inexistantes sont maintenant refusées sans mutation pour `move` et `duplicate`, et le rejeu historique revalide correctement l'ancien snapshot ainsi que l'entité courante. Il reste cependant une divergence DST automnale entre le frontend et le batch serveur : les deux occurrences d'une heure répétée ne suivent pas la même politique.

## Constat bloquant

### P1 — Une cible automnale ambiguë choisit une occurrence différente entre UI et batch

- Le frontend canonique `planningZonedIso()` (`app.js:47`) expose une désambiguïsation et choisit `earlier` par défaut.
- Le batch reconstruit `move` et `duplicate` avec `exactZonedDateTimeIso()` (`server.js:1850-1852`, `server.js:2538`, `server.js:2590`). Cette fonction vérifie désormais le round-trip, mais délègue à `zonedDateTimeIso()`, qui n'expose aucune politique et converge vers la seconde occurrence.
- Reproduction fraîche : `2027-10-31 02:30 Europe/Paris` devient `2027-10-31T01:30:00.000Z` côté serveur, soit l'occurrence tardive CET, alors que le défaut frontend retourne l'occurrence précoce CEST (`00:30Z`). Les deux instants ont le même libellé civil, mais diffèrent d'une heure et peuvent produire une disponibilité/conflit différent.
- Le contrat G3 conservé exige que les occurrences répétées restent distinctes ; le correctif G4 doit donc préserver explicitement l'occurrence source ou porter une politique `earlier/later` validée dans la commande. Le test API actuel couvre le saut de printemps et des heures représentables après transition, mais aucune cible répétée d'automne.

Correction attendue : partager le résolveur IANA canonique et sa politique de désambiguïsation entre frontend et serveur, inclure ou dériver cette politique sans ambiguïté dans `move`/`duplicate`, puis tester les deux occurrences automnales avec contrôle des instants et des conflits.

## Fermetures vérifiées

- **Heure inexistante — fermé** : `exactZonedDateTimeIso()` compare date et heure réaffichées ; `move` et `duplicate` retournent `422 VALIDATION_ERROR` avant désindexation/écriture si une borne n'existe pas. Le test vérifie le statut, l'instant et la version inchangés après move ; la copie refusée ne crée aucun item puisque `mutate()` ne commit pas sur exception.
- **Minuit et changement d'offset représentable — fermé** : les dates/heures sont dérivées avec le fuseau du site et les tests conservent `23:30–03:30` lors du déplacement puis de la copie.
- **Rejeu historique et scope courant — fermé** : `reservationSnapshotAllowed()` contrôle société, site, Projet, réservation, ressources principales et overrides. Le rejeu exige simultanément l'accès au snapshot historique et à la réservation courante. Le scénario déplace la réservation de `resource_3` vers `resource_5`, réduit ensuite le scope à `resource_5`, confirme que l'entité courante reste lisible puis obtient `404` au rejeu de l'ancien batch.
- **P1 antérieurs — fermés sans régression** : versions attendues des compensations, refus de divergence, piles Undo/Redo bornées à 50 et purgées au changement de société, sélection rectangulaire Maj souris/clavier, autosave concurrent à compteur, atomicité/idempotence, terminalité et rollback restent couverts.

## Constats non bloquants conservés

### P2 — OpenAPI omet des réponses batch réelles

`docs/api/openapi-v1.yaml:324-329` documente `200/201/404/409/422`, mais pas `400 IDEMPOTENCY_KEY_REQUIRED` ni les gardes `401/403` réellement exposés.

### P2 — Aucun audit récapitulatif de niveau batch

Les audits métier portent `batchIndex` et restent corrélables, mais `batchReservations()` ne produit pas l'audit batch explicite demandé au §5 (taille, familles d'actions et résultat). L'`operationId` batch reste limité au résultat/marker.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/api.test.js` hors sandbox | **PASS, 32/32**, 0 échec/skip/todo, 1,396 s |
| `node --test tests/planning-postproduction.test.js` | **PASS, 38/38**, 0 échec/skip/todo, 125 ms |
| `npm test` hors sandbox | **PASS, 245/245**, 0 échec/skip/todo, 7,840 s |
| `node --check server.js` | PASS |
| `node --check app.js` | PASS |
| `git diff --check` | PASS |
| Test API DST inexistant | PASS : move et duplicate `422`; move conserve instant/version |
| Test API rejeu scope | PASS : courant sur nouvelle ressource lisible, snapshot historique hors scope rejeté `404` |
| Reproduction occurrence automnale | **FAIL fonctionnel confirmé** : serveur `2027-10-31 02:30` → `01:30Z` (later), frontend par défaut → `00:30Z` (earlier) |

Hashes complets du candidat revu :

```text
server.js                                cc9172f1bd5b85eb2eb39f17344c6726c9478f9caf146a0f179d951c5533f6e9
app.js                                   16dc6c21c3241fdd9d5391546ccafa7110cc11d63dbecc2b69762cc8543d4c84
planning.css                             e4df59fc44cf624241bf4bd822b5059cbefd1ec4b109f65ca1cb9e8b5fbcf45f
tests/api.test.js                        cac073c71655887d26d8a0cf175feff1354dab445be2128e48ef5564f66a6a41
tests/planning-postproduction.test.js    7cb607aa612905690c1356a333eba7d5a5adeeaac1c00e9eedd938d0f09438c3
docs/api/openapi-v1.yaml                 20eef6d443681732d5f04a2d730133beebbdb5aac78cc6d890b3c3fdd201b1a9
```

## Limites et handoff

- Aucun E2E navigateur n'a été exécuté par cette REVIEW ; les comportements DOM restent démontrés par les tests frontend ciblés.
- Fichier modifié : `docs/code-review.md` uniquement. L'intégrateur doit reporter `G4 REVIEW = CHANGES REQUESTED — 1 P1` dans `docs/project-status.md`.
- Après alignement explicite de la désambiguïsation automnale et ajout des deux occurrences au test API, repasser REVIEW puis les gates aval impactés.

---

# Gate G4 — Re-REVIEW indépendante du candidat corrigé

Date : 2026-08-21  
Reviewer : agent indépendant `g3_review`  
Périmètre : fermeture des quatre P1 REVIEW G4, rejeu batch après changement de scope et non-régression Sprint 4  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**CHANGES REQUESTED — Gate REVIEW G4 reste bloqué**

**0 P0, 1 P1 ouvert, 2 P2 ouverts.** Trois des quatre P1 précédents sont fermés et le rejeu batch revalide désormais le périmètre courant. La reconstruction temporelle batch reste néanmoins incorrecte sur une heure locale inexistante au passage DST : la commande réussit avec une autre heure civile au lieu de refuser l'entrée. Un test vert sur un déplacement autour de la transition ne couvre pas cette cible exacte.

## Constat bloquant

### P1 — `move`/`duplicate` batch altèrent silencieusement une heure locale inexistante

- `server.js:2515-2524` et `server.js:2571-2574` dérivent maintenant correctement la date et l'heure civiles depuis le fuseau IANA du site ; les cas ordinaires, le voisinage de minuit et le passage d'un offset été à un offset hiver sont donc corrigés.
- Cependant, le résolveur partagé `zonedDateTimeIso()` (`server.js:1828-1833`) itère sur les offsets sans vérifier que l'instant obtenu se réaffiche avec la date/heure demandée. Pour `Europe/Paris`, la cible inexistante `2027-03-28 02:30` retourne `2027-03-28T00:30:00.000Z`, qui se réaffiche **01:30**, et aucune validation batch ne détecte cette altération.
- Le contrat temporel G3 conservé par Sprint 4 impose une saisie/affichage dans le fuseau IANA et le candidat G3 approuvé refuse explicitement les heures inexistantes. Un déplacement ou collage batch vers le dimanche de bascule peut donc enregistrer une réservation une heure plus tôt que la cellule demandée, ce qui est une corruption fonctionnelle visible.
- Le nouveau test API « autour du changement DST » déplace une séance `23:30–03:30` vers une date où ces deux heures existent ; il ne cible ni `02:00` ni `02:30` le jour du saut.

Correction attendue : utiliser le résolveur IANA canonique qui valide le round-trip civil, retourner une erreur stable pour une heure inexistante et couvrir `move` et `duplicate` sur `02:00/02:30` au printemps ainsi qu'une heure répétée à l'automne avec politique de désambiguïsation explicite.

## Fermetures vérifiées

- **Undo/Redo, versions, borne et société — fermé** : chaque compensation envoie la version mémorisée, met à jour cette version après succès et laisse le serveur refuser une divergence ; `pushPlanningHistory()` borne les deux piles à 50 ; `clearPlanningTransientState()` purge piles, presse-papiers, cible, peinture et sélections au changement de société.
- **Sélection rectangulaire — fermé** : `selectPlanningRectangle()` étend entre l'ancre et la cible sur les seules cellules rendues ; Maj+clic et Maj+Entrée partagent le comportement, avec `aria-pressed` synchronisé.
- **Autosave concurrent — fermé** : le compteur `planningPendingMutations` maintient `saving` tant qu'une mutation Planning reste en vol ; l'état final est `synced` seulement à zéro, ou `offline` après échec réseau.
- **Rejeu et scope courant — fermé** : avant de restituer un batch idempotent, `server.js:2455-2460` retrouve chaque réservation historique dans la société et revalide site, projet et entités via `reservationAllowed`; le test réduit le scope après succès puis obtient `404` au rejeu, sans nouvel audit.
- Atomicité, versions obsolètes, conflits intra-lot, terminalité, liens Devis/Projet/ligne, synchronisation du complément et émission SSE après commit restent couverts sans régression automatisée.

## Constats non bloquants conservés

### P2 — OpenAPI omet des réponses batch réelles

`docs/api/openapi-v1.yaml:324-329` documente `200/201/404/409/422`, mais pas `400 IDEMPOTENCY_KEY_REQUIRED` ni les gardes `401/403` réellement exposés par la route.

### P2 — Aucun audit récapitulatif de niveau batch

Les audits métier portent `batchIndex` et sont corrélables, mais `batchReservations()` ne produit toujours pas l'audit batch explicite demandé au §5 (taille, familles d'actions et résultat). `operationId` n'est présent que dans la réponse et le marqueur idempotent.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/api.test.js` hors sandbox | **PASS, 32/32**, 0 échec/skip/todo, 1,431 s |
| `node --test tests/planning-postproduction.test.js` | **PASS, 38/38**, 0 échec/skip/todo, 120 ms |
| `npm test` hors sandbox | **PASS, 245/245**, 0 échec/skip/todo, 8,178 s |
| `node --check server.js` | PASS |
| `node --check app.js` | PASS |
| `git diff --check` | PASS |
| Reproduction directe de l'algorithme `zonedDateTimeIso()` | **FAIL fonctionnel confirmé** : demandé `2027-03-28T02:30 Europe/Paris`, retourné `2027-03-28T00:30:00.000Z`, réaffiché `01:30` |

Hashes complets du candidat revu :

```text
server.js                                1373ea2bffceeb11d492fdddb21fe6869a85ac0d368643b123d056d35eace25e
app.js                                   16dc6c21c3241fdd9d5391546ccafa7110cc11d63dbecc2b69762cc8543d4c84
planning.css                             e4df59fc44cf624241bf4bd822b5059cbefd1ec4b109f65ca1cb9e8b5fbcf45f
tests/api.test.js                        0fbd58d6b61135801d9620dd36a0481ca8d0e511ad58884c7d0440e2899eaa04
tests/planning-postproduction.test.js    7cb607aa612905690c1356a333eba7d5a5adeeaac1c00e9eedd938d0f09438c3
tests/quotes.test.js                     380c3de4a5b431f5981992f949f5a37f0a3444b0433a95e7d94ad866ba60753e
docs/api/openapi-v1.yaml                 20eef6d443681732d5f04a2d730133beebbdb5aac78cc6d890b3c3fdd201b1a9
package.json                             abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

## Limites et handoff

- Aucun E2E navigateur n'a été ajouté ou exécuté par cette REVIEW ; la sélection rectangulaire et l'ordre inversé des réponses autosave restent démontrés par la sous-suite frontend, pas par un navigateur réel.
- Fichier modifié : `docs/code-review.md` uniquement. L'intégrateur doit reporter `G4 REVIEW = CHANGES REQUESTED — 1 P1` dans `docs/project-status.md`.
- Après correction du résolveur batch et ajout des négatifs DST exacts, repasser REVIEW puis les gates aval impactés sur les nouveaux hashes.

---

# Gate G4 — REVIEW indépendante du candidat Sprint 4

Date : 2026-08-21  
Reviewer : agent indépendant `g3_review`  
Périmètre : Sprint 4 complet — batch atomique/idempotent, copier/coller, multi-sélection, peinture, undo/redo, autosave, moteur vendu/planifié et cycle des Devis complémentaires ; contrôle du correctif O1  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**CHANGES REQUESTED — Gate REVIEW G4 bloqué**

**0 P0, 4 P1 ouverts, 2 P2 ouverts.** Les preuves automatisées sont vertes, mais le candidat ne satisfait pas encore quatre critères explicites : conservation temporelle des copies/déplacements, refus d'une compensation après divergence et historique borné/isolé, sélection rectangulaire, et autosave exact sous mutations concurrentes.

## Constats bloquants

### P1 — `move` et `duplicate` reconstruisent les dates depuis l'UTC au lieu du fuseau civil du site

- `server.js:2500-2509` prend `item.startsAt.slice(0, 10)` comme date source puis concatène la date cible avec la portion horaire/offset brute persistée ; `server.js:2558-2559` fait de même pour une copie de cellule.
- Les instants de l'interface étant stockés en UTC, une séance Europe/Paris à `00:30` peut porter la date UTC de la veille : le déplacement calcule alors un jour de trop. Une copie entre été et hiver conserve aussi l'heure UTC au lieu de l'heure murale de la cellule.
- Le contrat Sprint 3/G3 impose le fuseau IANA exact et Sprint 4 exige la conservation des cellules/durées. Les tests batch n'utilisent que des heures UTC sans minuit ni DST.
- Correctif attendu : dériver date/heure locales avec le fuseau du site, reconstruire via le résolveur IANA canonique, et tester printemps, automne et proximité de minuit sur `move`/`duplicate`.

### P1 — Undo/Redo contourne la divergence et l'historique n'est ni uniformément borné ni vidé au changement de société

- `app.js:687-692` et `app.js:703-706` envoient la **version courante** de `state.bookings`. Après modification SSE/concurrente, la compensation adopte cette nouvelle version et peut écraser l'évolution au lieu d'être refusée comme l'exige §7.
- `app.js:666`, `app.js:695`, `app.js:708` et `app.js:711` poussent directement dans `planningUndo`; seule `rememberPlanningUndo()` (`app.js:660`) borne à 50. Move/resize unitaires, échec et Redo peuvent dépasser la borne.
- Le changement de société (`app.js:529-530`) ne vide pas les piles, presse-papiers, cible et peinture déclarés à `app.js:651`.
- Correctif attendu : conserver les versions résultat avant/après, refuser une compensation si la version diverge, centraliser les piles bornées et purger tout état Planning au changement de société. Tester divergence SSE, 51 actions et changement de contexte.

### P1 — La multi-sélection rectangulaire spécifiée n'existe pas

- US-039 exige « Ctrl/Cmd/Shift et rectangle ». `app.js:725-726` fournit seulement un toggle par clic avec modificateurs ; aucun rectangle/marquee/lasso n'existe dans `app.js` ou `planning.css`.
- Le clic-glisser de `app.js:751-759` crée une nouvelle période sur une seule ressource : ce n'est pas une sélection rectangulaire de cellules existantes.
- Aucun test Planning ne couvre cette interaction. Ajouter un rectangle visible borné aux cellules rendues/autorisées, sans conflit avec la création, avec alternative clavier et E2E.

### P1 — L'autosave peut annoncer « Synchronisé » pendant qu'une mutation est encore en vol

- `app.js:18-20` conserve un état scalaire sans compteur ; `app.js:37` met `saving` à chaque départ puis chaque réponse remet immédiatement `synced`.
- Avec deux mutations concurrentes, la première réponse affiche donc « Synchronisé » avant réception/intégration de la seconde. Le test actuel ne fait qu'inspecter les trois libellés et ne simule pas des réponses inversées.
- Correctif attendu : compteur de mutations (ou sérialisation explicite), `synced` uniquement à zéro requête pendante après intégration, et test de concurrence/ordre inversé.

## Constats non bloquants

### P2 — OpenAPI omet des réponses batch réelles

`docs/api/openapi-v1.yaml:313-329` documente `200/201/404/409/422`, alors que le serveur renvoie aussi `400 IDEMPOTENCY_KEY_REQUIRED` et que le garde de route peut répondre `401/403`.

### P2 — Pas d'audit récapitulatif de niveau batch

Les audits métier sont corrélés par `operationId`, mais `batchReservations()` ne crée pas l'audit récapitulatif demandé au §5 (taille, familles d'actions, résultat). Les mutations restent traçables individuellement, mais le lot doit être reconstitué.

## Contrôles conformes observés

- `mutate()` n'écrit qu'après retour sans exception : les rejets en milieu de lot n'atteignent ni fichier, idempotence, audit, complément ni SSE.
- Le garde central applique `planning.write`, auth/session, CSRF/Origin et isolation société ; les recherches ajoutent site, projet et entités autorisées.
- L'index de conflits est maintenu dans le lot pour create/duplicate/move/resize/cancel/restore ; les conflits intra-lot sont détectés.
- Rejeu exact sans nouvel audit/SSE ; contenu divergent en `IDEMPOTENCY_CONFLICT`.
- Le moteur couvre non-planifiable, base principale + compléments acceptés et `+5 → +3 → 0`, sans réécrire les documents acceptés.
- La peinture est focusable et utilisable par Entrée/Espace ; les statuts ne reposent pas seulement sur la couleur.
- Le correctif O1 est couvert et la suite complète ne montre pas de régression.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande | Résultat |
|---|---|
| `node --test tests/api.test.js` | **PASS, 31/31**, 0 échec/skip/todo |
| `node --test tests/planning-postproduction.test.js` | **PASS, 35/35**, 0 échec/skip/todo |
| `node --test tests/quotes.test.js` | **PASS, 47/47**, 0 échec/skip/todo |
| `npm test` | **PASS, 241/241**, 0 échec/skip/todo, 8,149 s |
| `node --check server.js` | PASS |
| `node --check app.js` | PASS |
| `git diff --check` | PASS |

Hashes complets :

```text
server.js                                e9511b717c48571107796dfead2ce755d15fd61096b169e4f422f690ee6926b9
app.js                                   4e4184596936fe90876b71e967ba39db2f8f0938b2b3d33b79f58b9fef3aa718
planning.css                             e4df59fc44cf624241bf4bd822b5059cbefd1ec4b109f65ca1cb9e8b5fbcf45f
tests/api.test.js                        c6aaf73f3e95c9e411c9ed5d1ebebaea29a6e06dea1d70507d8cb9b10518d0ff
tests/planning-postproduction.test.js    684222c039fc23e207607c953aea513635f0747cc1821441c0819b9892b62e5f
tests/quotes.test.js                     380c3de4a5b431f5981992f949f5a37f0a3444b0433a95e7d94ad866ba60753e
docs/api/openapi-v1.yaml                 20eef6d443681732d5f04a2d730133beebbdb5aac78cc6d890b3c3fdd201b1a9
package.json                             abe5863b875a828360ab67edf388968413b375168df9cc32e50487e9bbb3e376
```

## Limites et handoff

- Aucun code/test corrigé et aucun E2E navigateur ajouté dans cette revue. L'E2E DEV antérieur ne couvre pas rectangle, concurrence autosave, divergence Undo/SSE ni copie/déplacement DST/minuit.
- Fichier modifié : `docs/code-review.md` uniquement. L'intégrateur doit reporter `G4 REVIEW = CHANGES REQUESTED` dans `docs/project-status.md`.
- Après correction, repasser REVIEW puis les gates aval impactés sur de nouveaux hashes.

---

# Gate G3 — Re-REVIEW indépendante du correctif focus SSE tardif

Date : 2026-08-21  
Reviewer : agent indépendant `g3_review`  
Périmètre : maintien du focus Planning après rerendu SSE tardif, absence de vol de focus et non-régression du candidat G3 V4  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**APPROVED — Gate REVIEW G3 maintenu**

**0 P0, 0 P1 ouvert.** Le correctif conserve l'intention de focus durant 2,5 secondes, la rejoue après chaque `bind()` consécutif à un rerendu et ne reprend pas le focus si l'utilisateur l'a déplacé vers une zone extérieure à la matrice. Le scénario navigateur E2E communiqué confirme qu'après resize et actualisation SSE à 1,2 seconde, le focus reste sur la poignée « Étirer la fin… ».

## Contrôles du correctif

- `restorePlanningKeyboardFocus()` enregistre réservation, bord/cellule et échéance dans `planningKeyboardFocusIntent`, puis tente immédiatement la restauration.
- `bind()` rappelle `applyPlanningKeyboardFocus()` après chaque reconstruction de la page Planning, ce qui couvre le second rendu provoqué par l'invalidation SSE.
- L'intention expire après 2 500 ms et est annulée lorsqu'elle est périmée ; elle ne devient pas un état permanent.
- Avant tout recentrage, le code vérifie `document.activeElement` : un focus actif hors de `.planning-matrix-scroll` est respecté, empêchant le correctif de voler le focus à un contrôle externe, une navigation ou un dialogue.
- La cible reste priorisée : poignée exacte, puis réservation, puis région Planning focusable. Les recadrages Jour et les corrections DST/dailyCells du V4 restent inchangés.
- Limite non bloquante : pendant la courte intention, un déplacement volontaire vers un autre contrôle **dans** la matrice peut être recentré par un SSE tardif. Le comportement protège la continuité de la commande initiatrice ; un futur raffinement pourrait annuler l'intention sur un `focusin` distinct.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --check app.js` | PASS |
| `node --test tests/planning-postproduction.test.js` | **PASS, 29/29**, 0 échec/skip/todo, 105 ms |
| `npm test` hors sandbox | **PASS, 233/233**, 0 échec/skip/todo, 7,960 s |
| `npm run lint` | PASS |
| `npm run build` | PASS, 5 actifs runtime vérifiés |
| `git diff --check` | PASS |
| Preuve navigateur E2E fournie | PASS : poignée « Étirer la fin… » toujours focus après resize + attente SSE 1,2 s |
| Inspection non-vol de focus | PASS : retour immédiat si le focus actif est hors matrice |

Hashes complets du candidat approuvé :

```text
server.js                                faef9ad5d81f82a3bd967baf7e31fc541aa617c79b25bbb238501a3fbe7bcdd4
app.js                                   35826e969bbd14d66a73b1a5ead67081e7ee648e0a0202b524e2450a6dd8a954
planning.css                             1928f4cabc83cfb3d8acb652b64e060ca7fcaefcfa26e5f0fa34d8165083fe19
tests/api.test.js                        165a12998808c0dfd38041abbdab2fea6ec096c981e30c190d50591535eea71c
tests/planning-postproduction.test.js    833ece1c1f383a7a07f824e5e05b66a56daf4e5c7897c8432970b010dcf43c63
docs/api/openapi-v1.yaml                 a70a98f727d02f0dc6c132357f11489a60c0878e1929c7cf8a179d58e36160c5
```

## Handoff intégrateur

- Fichier modifié : `docs/code-review.md` uniquement.
- Conserver `G3 REVIEW = APPROVED — 0 P0/P1` pour les hashes ci-dessus.
- Les gates aval doivent référencer le nouveau hash frontend et la preuve navigateur du focus après SSE.

---

# Gate G3 — Re-REVIEW ultime indépendante du candidat V4

Date : 2026-08-21  
Reviewer : agent indépendant `g3_review`  
Périmètre : fermeture des deux derniers P1 G3, correctifs DST/focus et non-régression S3-A à S3-D  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**APPROVED — Gate REVIEW G3 validé**

**0 P0, 0 P1 ouvert.** Les déplacements et redimensionnements horaires utilisent désormais des instants UTC réels, y compris sur les bascules DST. Les poignées de resize en vue Jour recentrent la période sur leur nouveau bord avant restauration du focus. Les trois séries de constats précédentes sont fermées sans régression détectée sur le candidat exact.

## Fermeture des deux P1 V3

### Navigation horaire aux transitions DST — fermé

- `planningShiftedInstants()` part des instants persistés `startsAt`/`endsAt`, ajoute le delta en millisecondes et reconvertit seulement ensuite vers l'heure civile du site.
- Au printemps, `01:30 + 30 min` devient correctement `03:00`, créneau instantané adjacent malgré l'heure murale inexistante.
- À l'automne, les deux occurrences de 02 h restent distinctes : la première `02:30 + 30 min` atteint la seconde occurrence de `02:00`, et la seconde `02:30 - 30 min` atteint cette même occurrence antérieure de 30 minutes, sans saut de 90 minutes.
- Move complet horaire et resize start/end partagent ce calcul ; la durée positive est contrôlée avant mutation et le rollback restaure le snapshot sur rejet API.

### Continuité des poignées de resize — fermé

- Après un resize non horaire, la vue Jour récupère l'objet serveur actualisé, choisit `resized.date` pour la poignée de début ou `resized.endDate` pour la poignée de fin, met à jour `anchor`, invalide la fenêtre virtuelle puis rerend.
- `restorePlanningKeyboardFocus()` s'exécute après ce recentrage et retrouve la poignée correspondante ; la région Planning focusable reste le dernier fallback en cas de cible indisponible.
- Le même handler est `async`, attend succès ou rollback avant de restaurer le focus et permet donc une séquence de flèches sans perdre le contexte du bord manipulé.

## Contrôles G3 consolidés

- **Création** : clic-glisser avec ghost, formulaire prérempli et aucune mutation avant confirmation humaine.
- **Vue Jour** : grille horaire réelle ; 48 slots ordinaires, 46 au passage à l'heure d'été et 50 au retour à l'heure d'hiver ; occurrences répétées libellées et instants exacts transmis.
- **Fuseau/legacy** : conversion UTC ↔ heure civile via fuseau IANA du site, heures inexistantes refusées, instant ambigu inchangé préservé, aucune promotion implicite d'une réservation legacy vers `sprint3-v1`.
- **Interactions** : move cellule limité à la salle du même jour, move complet, resize, copie/coller, undo/redo, ghosts opérationnels, snapshot et rollback.
- **Clavier/accessibilité** : événements et poignées focusables, raccourcis annoncés, commandes move/resize opérantes, recentrage et restauration/fallback du focus visible.
- **Cellules multi-jours** : chaque cellule `dailyCells` est bornée à son propre intervalle quotidien et ne déborde pas sur les colonnes intermédiaires.
- **Serveur** : alignement réel au snap dans le fuseau IANA, contrôle optimiste de version, statuts terminaux, RBAC/scopes, isolation société/site, conflits et capacité conservés.
- **Calendrier** : week-ends et jours fériés restent explicites verticalement, sans dépendance distante.
- **Contrats/compatibilité** : OpenAPI cohérent avec les champs temporels ; aucun changement de stack, migration destructive ou fallback prototype silencieux.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --check server.js && node --check app.js` | PASS |
| `node --test tests/planning-postproduction.test.js` | **PASS, 29/29**, 0 échec/skip/todo, 111 ms |
| `node --test tests/api.test.js` hors sandbox | **PASS, 30/30**, 0 échec/skip/todo, 1,266 s |
| `npm test` hors sandbox | **PASS, 233/233**, 0 échec/skip/todo, 8,356 s |
| `npm run lint` | PASS |
| `npm run build` | PASS, 5 actifs runtime vérifiés |
| `git diff --check` | PASS |
| Inspection déplacement DST | PASS : delta appliqué aux instants, puis reconversion IANA |
| Inspection resize/focus | PASS : recentrage sur le bord start/end en vue Jour avant restauration de la poignée |

Performance DEV fournie, non réexécutée par cette REVIEW : lecture p95 104,48 ms ; conflit 144,55 ms ; écriture 179,18 ms ; replay 155,70 ms, sous les seuils contractuels.

Hashes complets du candidat approuvé :

```text
server.js                                faef9ad5d81f82a3bd967baf7e31fc541aa617c79b25bbb238501a3fbe7bcdd4
app.js                                   9cb7d996fdbd364f0e8d3ff95d7c43bd8173526f5990381233968e592b120e33
planning.css                             1928f4cabc83cfb3d8acb652b64e060ca7fcaefcfa26e5f0fa34d8165083fe19
tests/api.test.js                        165a12998808c0dfd38041abbdab2fea6ec096c981e30c190d50591535eea71c
tests/planning-postproduction.test.js    a9a982239ca476af3336757298223b05c1fc4438aa6da9545bbda3534c7f82ff
docs/api/openapi-v1.yaml                 a70a98f727d02f0dc6c132357f11489a60c0878e1929c7cf8a179d58e36160c5
```

## P2 / limites non bloquantes

1. Plusieurs assertions frontend inspectent encore les branchements DOM par expressions régulières. Le gate E2E doit conserver un scénario navigateur réel sur séquences clavier, succès/rollback et limites de virtualisation.
2. Le calendrier métier propre à un site reste distinct du calendrier national français actuellement implémenté ; toute extension de ce périmètre devra recevoir son contrat et ses tests.
3. Cette approbation REVIEW ne remplace pas les verdicts indépendants QA, Sécurité, Performance, Intégration et E2E.

## Handoff intégrateur

- Fichier modifié : `docs/code-review.md` uniquement.
- Reporter `G3 REVIEW = APPROVED — 0 P0/P1` dans `docs/project-status.md`.
- Ce verdict porte uniquement sur les six hashes ci-dessus ; toute modification ultérieure du candidat impose une nouvelle analyse d'impact.

---

# Gate G3 — Re-REVIEW terminale indépendante du candidat V3

Date : 2026-08-21  
Reviewer : agent indépendant `g3_review`  
Périmètre : correctifs DST, focus clavier, granularité/cellules multi-jours et non-régression S3-A à S3-D  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**CHANGES REQUIRED — Gate REVIEW G3 refusé**

**0 P0, 2 P1 ouverts.** La grille civile produit maintenant 46 créneaux au printemps et 50 à l'automne, différencie les deux occurrences répétées, refuse l'heure inexistante et préserve l'instant ambigu lors d'une édition inchangée. Le focus est recentré après un déplacement complet en vue Jour et possède une région de repli. Deux interactions exigées restent cependant incorrectes : les commandes horaires par flèches ne suivent pas les créneaux instantanés lors des bascules DST, et les poignées de resize perdent leur contexte lorsque le bord modifié sort de la vue.

## P1 ouverts

### P1-1 — Les flèches horaires sautent 90 minutes ou échouent aux transitions DST

`changePlanningBookingTime()` calcule encore la cible avec `shiftPlanningLocal()` sur l'heure murale, puis appelle `planningZonedIso()` avec la désambiguïsation par défaut `earlier`. Cette logique ne parcourt pas les créneaux réels construits par `planningTimelineSlots()` :

- le 25 octobre 2026, ArrowRight depuis la première occurrence de `02:30` produit `03:00`, soit **+90 minutes instantanées** au lieu de +30 ;
- ArrowLeft depuis la seconde occurrence de `02:30` choisit la première occurrence de `02:00`, soit **−90 minutes** ;
- le 29 mars 2026, ArrowRight depuis `01:30` tente l'heure inexistante `02:00` et rollback, alors que le créneau adjacent réel est `03:00` trente minutes plus tard.

Impact : la grille représente correctement le jour civil, mais le déplacement et le resize clavier ne suivent pas ses colonnes. Durée et position peuvent sauter d'une heure supplémentaire ou l'action peut être refusée sur un créneau valide adjacent. Cela rompt l'exactitude date/sélection de la vue Jour et l'alternative clavier des interactions principales.

Correction attendue : en vue horaire, déplacer les bornes par instants UTC ou par index de `planningTimelineSlots()` plutôt que par chaîne locale ; conserver explicitement l'occurrence ambiguë et couvrir les quatre passages adjacents printemps/automne pour move et resize.

### P1-2 — Une poignée de resize ne reste pas opérante quand son bord sort de la vue

`restorePlanningKeyboardFocus()` possède désormais une cible de repli et le déplacement complet en vue Jour recale `anchor` sur la nouvelle date. Le resize ne recale toutefois jamais `anchor`. Exemple : en vue Jour/Journée, ArrowLeft sur la poignée de début étend la réservation au jour précédent ; la cellule du jour courant reste visible, mais la poignée `start` se trouve désormais sur le jour précédent hors DOM. Le sélecteur de poignée échoue, puis le fallback choisit l'article restant. Le focus est visible, mais l'utilisateur ne peut plus poursuivre la séquence de resize avec les flèches. Le même problème existe pour la poignée de fin et aux bords des fenêtres Semaine/virtualisées.

Impact : la conservation visuelle du focus est améliorée, mais l'alternative clavier du resize n'est pas continue et le contexte d'action est perdu après une seule frappe aux limites de vue.

Correction attendue : recentrer la période/fenêtre sur le bord redimensionné ou restaurer une commande de resize équivalente et annoncée sur la cible de repli ; couvrir une séquence de plusieurs flèches sur poignées start/end, succès et rollback, aux bords Jour/Semaine/virtualisation.

## Corrections validées

- La journée horaire Europe/Paris est construite entre deux minuits civils réels : 46 slots le 29 mars 2026, 50 slots le 25 octobre 2026.
- Les heures répétées sont libellées `(1/2)` et `(2/2)` ; la création depuis une cellule transmet les instants exacts du slot, et une édition non temporelle préserve `startsAt`/`endsAt` d'origine.
- `planningZonedIso()` refuse une heure locale inexistante et permet `earlier`/`later` pour une heure ambiguë.
- Le déplacement complet hors vue Jour met à jour `anchor`, rerend la grille puis restaure le focus ; la région `.planning-matrix-scroll` est focusable et sert de fallback.
- `planningCellInterval()` borne chaque cellule d'une réservation `dailyCells` multi-jours à son intervalle quotidien ; une période 09:00–18:00 ne déborde plus sur les colonnes intermédiaires.
- Les corrections précédentes restent fermées : aucun offset frontend fixe, aucune promotion legacy implicite, validation serveur réelle du snap, grille horaire et commandes clavier présentes.

## Non-régression contrôlée

- Création avec ghost sans écriture anticipée, move cellule/complet, resize, rollback optimiste, copie/coller et undo/redo restent présents.
- Terminalité, versions, RBAC/scopes, isolation site/société, conflits/capacité, week-ends et jours fériés restent cohérents.
- OpenAPI et backend conservent les hashes déjà revus ; aucune migration de stack, dépendance distante ou fallback prototype implicite n'est introduit.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --check server.js && node --check app.js` | PASS |
| `node --test tests/planning-postproduction.test.js` | **PASS, 28/28**, 0 échec/skip/todo, 108 ms |
| `node --test tests/api.test.js` hors sandbox | **PASS, 30/30**, 0 échec/skip/todo, 1,149 s |
| `npm test` hors sandbox | **PASS, 232/232**, 0 échec/skip/todo, 10,279 s |
| `npm run lint` | PASS |
| `npm run build` | PASS, 5 actifs runtime vérifiés |
| `git diff --check` | PASS |
| Test direct grille DST | PASS : 46 slots printemps, 50 automne, occurrences différenciées |
| Test direct déplacement instantané automne | **P1 confirmé** : première `02:30` → `03:00` = +90 min ; seconde `02:30` → première `02:00` = −90 min |
| Inspection resize/focus | **P1 confirmé** : poignée sortie de la vue non retrouvée ; fallback visible sur article/région mais contexte resize perdu |

Performance DEV fournie, non réexécutée par cette REVIEW : lecture p95 104,48 ms ; conflit 144,55 ms ; écriture 179,18 ms ; replay 155,70 ms, sous les seuils contractuels.

Hashes complets du candidat contrôlé :

```text
server.js                                faef9ad5d81f82a3bd967baf7e31fc541aa617c79b25bbb238501a3fbe7bcdd4
app.js                                   7dada2a00e2e5ee23c0f73ba4fe9b6db2222f502198ff32cc574ae2a454fedf1
planning.css                             1928f4cabc83cfb3d8acb652b64e060ca7fcaefcfa26e5f0fa34d8165083fe19
tests/api.test.js                        165a12998808c0dfd38041abbdab2fea6ec096c981e30c190d50591535eea71c
tests/planning-postproduction.test.js    d450d34c61832fbba6ecf9a5efa4906c21cb41d64a448594737a9c28698cd2f3
docs/api/openapi-v1.yaml                 a70a98f727d02f0dc6c132357f11489a60c0878e1929c7cf8a179d58e36160c5
```

## Limites et handoff intégrateur

- Les tests actuels prouvent la construction DST et des branchements de focus par inspection statique, mais pas les séquences interactives move/resize aux bascules et limites de fenêtre.
- Fichier modifié : `docs/code-review.md` uniquement.
- Reporter `G3 REVIEW = CHANGES REQUIRED — 2 P1` dans `docs/project-status.md`; retour DEV requis sur navigation instantanée et continuité des poignées, puis nouvelle REVIEW et gates aval impactés.
- Ce verdict porte uniquement sur les six hashes ci-dessus.

---

# Gate G3 — Re-REVIEW ultime indépendante du candidat V2

Date : 2026-08-21  
Reviewer : agent indépendant `g3_review`  
Périmètre : fermeture des trois P1 du candidat précédent, non-régression complète S3-A à S3-D, consommateurs Planning  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**CHANGES REQUIRED — Gate REVIEW G3 refusé**

**0 P0, 2 P1 ouverts.** Deux des trois P1 précédents sont fermés : le frontend convertit désormais les heures civiles via le fuseau IANA du site en été comme en hiver, et une réservation legacy sans `timePolicyVersion` n'est plus promue lors d'une édition ordinaire. La restauration du focus fonctionne tant que la réservation reste rendue. Elle échoue néanmoins lorsque l'opération déplace l'objet hors de la fenêtre visible. Par ailleurs, le nouveau convertisseur IANA ne traite pas les heures inexistantes ou dupliquées des jours de bascule DST, pourtant explicitement requises par l'architecture.

## P1 ouverts

### P1-1 — Les jours de changement d'heure produisent des créneaux faux ou ambigus

`planningZonedIso()` converge correctement sur les offsets Paris d'été et d'hiver ordinaires. En revanche, le 29 mars 2026, heure inexistante, une saisie `02:00` est silencieusement convertie en `2026-03-29T00:00:00.000Z`, qui se réaffiche `01:00`; `02:30` se réaffiche `01:30`. Le 25 octobre 2026, les heures `02:00–02:59` existent deux fois mais aucune occurrence/offset ne peut être choisie ou distinguée. `planningTimelineSlots()` rend en outre toujours 48 demi-heures, alors qu'une journée Paris de bascule en compte respectivement 46 ou 50.

Impact : une réservation saisie dans un créneau affiché peut être persistée à une autre heure civile et changer après rechargement ; lors du retour à l'heure d'hiver, deux instants distincts sont confondus. Cela contrevient à `docs/architecture.md` (« tests sur changements d'heure ») et au contrat Sprint 3 stockage UTC / saisie dans le fuseau IANA.

Correction attendue : générer les créneaux à partir de la journée civile réelle du fuseau, refuser ou normaliser explicitement les heures inexistantes, désambiguïser les heures répétées et vérifier le round-trip civil avant mutation. Ajouter des tests ciblés sur les deux bascules Europe/Paris.

### P1-2 — Le focus reste perdu quand le déplacement sort de la vue ou de la fenêtre virtualisée

Les handlers attendent maintenant la mutation asynchrone et `restorePlanningKeyboardFocus()` retrouve correctement l'événement ou la poignée lorsque son nœud existe encore. Mais la fonction ne prévoit aucun repli focusable si le sélecteur ne trouve rien. En vue Jour avec granularité Journée ou Demi-journée, ArrowLeft/ArrowRight déplace la réservation au jour voisin sans changer `anchor`; l'objet quitte donc immédiatement le DOM de la vue Jour et `target` vaut `null`. Le même défaut peut survenir aux limites d'une fenêtre virtualisée. Le focus retombe alors hors de l'interaction, ce qui interdit une séquence clavier et viole le critère « conserve un focus visible ».

Correction attendue : après une opération qui sort l'objet du rendu, suivre la date/ressource déplacée ou restaurer le focus sur une cible de repli explicite et pertinente (cellule cible, contrôle de période ou grille), puis couvrir succès et rollback avec un test DOM/E2E sur bord de vue et bord de fenêtre virtuelle.

## P1 précédents fermés

- **Fuseau été/hiver ordinaire** : tous les chemins Planning actifs examinés (`toApiReservation`, déplacement complet, resize, undo/redo, changement horaire et métriques) utilisent `planningZonedIso()`; `fromApiReservation()` reconvertit l'instant API avec `planningLocalParts()`. Aucun `+02:00` fixe ne subsiste dans ces consommateurs.
- **Compatibilité legacy** : `fromApiReservation()` conserve l'absence de `timePolicyVersion`; le formulaire marque `timePolicyTouched=false` et `toApiReservation()` omet granularité, snap et calendrier tant que l'utilisateur ne modifie pas explicitement la politique. Le serveur ne déclenche donc pas `sprint3-v1` sur une édition non temporelle historique.
- **Clavier dans la fenêtre rendue** : événements et poignées sont focusables, les mutations sont attendues, puis le focus est restauré après succès ou rollback par double `requestAnimationFrame`. La lacune restante est précisément le cas où la cible n'est plus rendue.

## Non-régression contrôlée

- La vue Jour conserve 48 créneaux de 30 minutes sur les jours ordinaires et les événements sont positionnés/spannés selon leurs heures.
- La validation serveur du snap réel, la version optimiste, les conflits, scopes, statuts terminaux, ghosts et rollbacks restent inchangés.
- Déplacement cellule/complet, resize, copie/coller, undo/redo, week-ends et jours fériés restent présents.
- OpenAPI, tests API et règles serveur du candidat précédent ont les mêmes hashes ; aucune dérive contractuelle constatée.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --check server.js && node --check app.js` | PASS |
| `node --test tests/planning-postproduction.test.js` | **PASS, 26/26**, 0 échec/skip/todo, 116 ms |
| `node --test tests/api.test.js` hors sandbox | **PASS, 30/30**, 0 échec/skip/todo, 1,262 s |
| `npm test` hors sandbox | **PASS, 230/230**, 0 échec/skip/todo, 8,846 s |
| Test direct `planningZonedIso` / `planningLocalParts` été-hiver | PASS sur 17 août et 17 décembre 2026 |
| Test direct bascule Europe/Paris | **P1 confirmé** : `2026-03-29 02:00` revient `01:00`, `02:30` revient `01:30`; heure répétée d'octobre non désambiguïsée |
| Inspection legacy aller-retour | PASS : `timeGranularity` et `snapMinutes` absents du DTO historique tant que politique non touchée |
| Inspection focus asynchrone | PASS si cible rendue ; **P1 confirmé** si déplacement hors vue, aucun fallback quand `querySelector` retourne `null` |

Hashes complets du candidat contrôlé :

```text
server.js                                faef9ad5d81f82a3bd967baf7e31fc541aa617c79b25bbb238501a3fbe7bcdd4
app.js                                   ca2471b6ed278c0e11f2740c04b98e1a3ce598d481d6e8838844f2325731feba
planning.css                             1928f4cabc83cfb3d8acb652b64e060ca7fcaefcfa26e5f0fa34d8165083fe19
tests/api.test.js                        165a12998808c0dfd38041abbdab2fea6ec096c981e30c190d50591535eea71c
tests/planning-postproduction.test.js    bb9693680d7c039c023413f0cc2ae370a796f550f49bc8ad806392c2a51e518b
docs/api/openapi-v1.yaml                 a70a98f727d02f0dc6c132357f11489a60c0878e1929c7cf8a179d58e36160c5
```

## Limites et handoff intégrateur

- Les tests actuels couvrent été/hiver ordinaires, mais pas les dates exactes de transition DST ni un focus DOM réel après sortie de vue.
- Fichier modifié : `docs/code-review.md` uniquement.
- Reporter `G3 REVIEW = CHANGES REQUIRED — 2 P1` dans `docs/project-status.md`; retour DEV requis sur DST et fallback/follow focus, puis nouvelle REVIEW et gates aval impactés.
- Ce verdict porte uniquement sur les six hashes ci-dessus.

---

# Gate G3 — Re-REVIEW indépendante du candidat corrigé

Date : 2026-08-21  
Reviewer : agent indépendant `g3_review`  
Périmètre : fermeture des trois P1 de la REVIEW G3 initiale, contrats serveur/frontend/OpenAPI et compatibilité des consommateurs  
Nature : revue seule ; aucun code, test, statut ni autre rapport modifié

## Verdict

**CHANGES REQUIRED — Gate REVIEW G3 refusé**

**0 P0, 3 P1 ouverts.** La grille Jour comporte désormais 48 créneaux de 30 minutes, le serveur contrôle l'alignement réel dans le fuseau IANA du site et les événements/poignées exposent des commandes clavier. Ces correctifs ferment les lacunes statiques initiales, mais leurs consommateurs ne respectent pas encore le contrat de bout en bout : le frontend produit un offset fixe incompatible avec l'heure d'hiver, transforme silencieusement les réservations historiques en politique Sprint 3 et détruit le focus après une commande clavier.

## P1 ouverts

### P1-1 — L'offset frontend fixe `+02:00` rend le snapping serveur faux en heure d'hiver

`toApiReservation()` et `changePlanningBookingTime()` construisent encore `startsAt`/`endsAt` avec `+02:00`, indépendamment du fuseau IANA et de la date du site. Le serveur, lui, valide correctement avec `localRateParts(..., site.timezone)`. Pour un site `Europe/Paris` en février, une saisie UI `09:00` devient `09:00+02:00`, soit `08:00` local réel ; une journée `09:00–18:00` ou une demi-journée conforme à l'écran est donc refusée en `422`. Les mêmes chaînes sont découpées directement dans `fromApiReservation()`, sans conversion vers le fuseau du site.

Impact : création, édition et commandes clavier ne respectent pas toute l'année le contrat temporel que le serveur vient de durcir. Le P1 « alignement réel au snap » n'est pas fermé de bout en bout et des réservations peuvent être refusées ou représentées avec une heure de décalage.

Correction attendue : construire les instants à partir du fuseau IANA du site et convertir explicitement API UTC ↔ heure civile du site, sans offset constant ; couvrir au minimum hiver/été, changement d'heure et journée/demi-journée/heure dans un test consommateur réel.

### P1-2 — Une édition UI ordinaire casse la compatibilité des réservations historiques

Les réservations historiques de `data/planify.json` n'ont ni `timeGranularity` ni `timePolicyVersion` et plusieurs utilisent des horaires différents de `09:00–18:00`. `fromApiReservation()` les convertit néanmoins en `timeGranularity: 'day'` et `snapMinutes: 1440`. À la soumission du formulaire, `toApiReservation()` renvoie toujours ces deux champs ; `reservationFrom()` pose alors `timePolicyVersion: 'sprint3-v1'` et `validateReservation()` impose immédiatement les bornes journalières. Une simple modification de titre, notes, statut ou ressource d'une réservation historique peut ainsi échouer en `422`, alors que le PATCH API sans métadonnées conserve correctement l'ancien contrat.

Impact : la compatibilité legacy annoncée par le correctif serveur est contournée par le principal consommateur frontend. Les données existantes deviennent partiellement non éditables sans migration explicite.

Correction attendue : préserver l'absence de politique pour un enregistrement legacy tant que l'utilisateur ne choisit pas explicitement une nouvelle granularité, ou fournir une migration/version de données approuvée et réversible ; ajouter un test UI/API qui édite un champ non temporel d'une réservation historique non alignée.

### P1-3 — Les commandes clavier deviennent inopérantes en séquence car le focus n'est pas restauré

Les événements sont maintenant focusables et les flèches appellent bien move/resize. Cependant chaque commande exécute `render()` avant l'appel API, puis de nouveau après succès ou rollback. Ce rerendu remplace le nœud DOM qui détenait le focus ; aucune clé de restauration ni appel `focus()` ne cible la cellule ou la poignée déplacée/redimensionnée. Après la première flèche, le focus retombe donc hors de la réservation et l'utilisateur ne peut pas poursuivre une série d'ajustements au clavier.

Impact : l'alternative clavier existe uniquement comme action isolée et ne satisfait pas le critère explicite de conservation du focus visible. Les tests actuels vérifient des chaînes et branchements, pas le focus DOM après succès/rejet.

Correction attendue : mémoriser réservation/cellule/bord actif, restaurer le focus après chaque rerendu sur succès et rollback, annoncer le résultat via la zone live et couvrir une séquence de plusieurs flèches dans un test DOM/E2E.

## Contrôles satisfaisants

- `planningTimelineSlots('day', 'hour', ...)` fournit bien **48** créneaux contigus de 30 minutes et la fenêtre virtuelle se positionne initialement vers 08:00.
- Les réservations horaires occupent un nombre déterministe de colonnes selon leur durée ; les granularités demi-journée et journée exposent respectivement les bornes 09–13/13–18 et 09–18.
- Le serveur active la validation temporelle renforcée uniquement avec `timePolicyVersion: 'sprint3-v1'`, calcule les minutes dans le fuseau IANA du site et retourne une erreur de validation sur un instant hors pas.
- Le contrat OpenAPI décrit les granularités, les pas compatibles et la règle d'alignement ; le test API couvre le refus de `:15` et l'acceptation de `:30` au pas de 30 minutes.
- Les événements éditables ont un `tabindex`, un libellé accessible et `aria-keyshortcuts`; les poignées acceptent ArrowLeft/ArrowRight. Les opérations continuent d'utiliser version optimiste, rollback, terminalité et contrôles serveur de scope/conflit.
- Les week-ends, jours fériés français, créations avec ghost, déplacements cellule/complet et redimensionnements restent présents et la suite complète ne détecte aucune régression automatisée existante.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --check server.js && node --check app.js` | PASS |
| `node --test tests/planning-postproduction.test.js` | **PASS, 24/24**, 0 échec/skip/todo, 97 ms |
| `node --test tests/api.test.js` hors sandbox | **PASS, 30/30**, 0 échec/skip/todo, 1,141 s |
| `npm test` hors sandbox | **PASS, 228/228**, 0 échec/skip/todo, 8,245 s |
| Inspection grille Jour | PASS : 48 créneaux de 30 minutes, positionnement/spans présents |
| Inspection validation serveur | PASS isolé : contrôle réel via fuseau IANA sous politique `sprint3-v1` |
| Inspection consommateur temporel | **P1 confirmé** : timestamps frontend toujours suffixés `+02:00` |
| Inspection compatibilité legacy | **P1 confirmé** : défaut frontend `day/1440` retransmis et activation implicite de `sprint3-v1` |
| Inspection clavier/focus | **P1 confirmé** : commandes branchées, mais `render()` remplace le nœud sans restauration du focus |

Hashes complets du candidat contrôlé :

```text
server.js                                faef9ad5d81f82a3bd967baf7e31fc541aa617c79b25bbb238501a3fbe7bcdd4
app.js                                   cdf88fc677050128976acbd9aa40f63afc4a4b6b9764118ca64977e2c0460bd8
planning.css                             1928f4cabc83cfb3d8acb652b64e060ca7fcaefcfa26e5f0fa34d8165083fe19
tests/api.test.js                        165a12998808c0dfd38041abbdab2fea6ec096c981e30c190d50591535eea71c
tests/planning-postproduction.test.js    e15c954219cb01dd79312f4a8d4765310ced20126a1875f3f058eceada21d9b7
docs/api/openapi-v1.yaml                 a70a98f727d02f0dc6c132357f11489a60c0878e1929c7cf8a179d58e36160c5
```

## Limites et handoff intégrateur

- Les 228 tests verts sont nécessaires mais insuffisants : ils ne couvrent ni l'heure d'hiver côté frontend, ni l'édition UI d'un objet legacy, ni la conservation du focus DOM après mutation.
- Fichier modifié par cette revue : `docs/code-review.md` uniquement.
- Reporter `G3 REVIEW = CHANGES REQUIRED — 3 P1` dans `docs/project-status.md`; retour DEV requis, puis nouvelle REVIEW et gates aval impactés.
- Ce verdict porte uniquement sur les six hashes ci-dessus. Toute modification du candidat impose une nouvelle preuve fraîche.

---

# Gate G3 — REVIEW indépendante du Sprint 3 Planning

Date : 2026-08-21  
Reviewer : agent indépendant `g3_review`  
Périmètre : S3-A à S3-D, US-025 à US-032, US-035 à US-037 et US-043 à US-047 ; serveur, frontend, OpenAPI, consommateurs et tests Planning  
Nature : revue seule ; aucun correctif de code, test, contrat ou autre rapport appliqué

## Verdict

**CHANGES REQUIRED — Gate REVIEW G3 refusé**

**0 P0, 3 P1 ouverts.** Les vues civiles, la virtualisation, les ghosts sans écriture anticipée, les rollbacks optimistes, les scopes, la terminalité, les conflits, les week-ends et le calendrier national français sont cohérents. Trois critères G3 obligatoires ne sont cependant pas implémentés de bout en bout.

## P1 ouverts

### P1-1 — La vue Jour ne fournit pas la grille horaire exigée par US-025/045/046

`planningDatesFor('day', ...)` produit une seule date et `planningMatrix()` conserve la même matrice `ressource × jour`, avec une colonne de 260 px. Le sélecteur « Heure · 30 min » modifie uniquement les valeurs proposées au formulaire et les métadonnées persistées ; il ne crée aucun axe horaire, aucun créneau de 30/60 minutes et aucune position temporelle dans la cellule. Deux prestations d'une même salle à des heures différentes restent donc empilées dans la même cellule quotidienne.

Impact : l'utilisateur ne peut ni lire ni manipuler précisément une journée à la granularité horaire. La preuve statique actuelle ne satisfait pas le critère « Vue Jour — granularité horaire configurable » ni l'absence de dérive pixel/date attendue au gate G3.

Correction attendue : rendre, au minimum en vue Jour, un axe horaire déterministe aligné sur le fuseau du site et le pas 30/60 minutes ; positionner les réservations selon début/fin ; couvrir création, déplacement, resize, conflit et changement de pas par tests fonctionnels et E2E.

### P1-2 — Le serveur accepte des horaires non alignés sur `snapMinutes`

`validateReservation()` vérifie seulement la combinaison de métadonnées (`hour` avec 30/60, `halfDay` avec 240, `day` avec 1440). Il ne vérifie jamais que `startsAt` et `endsAt` tombent effectivement sur les bornes annoncées. Un client direct peut donc déclarer `timeGranularity: "hour"`, `snapMinutes: 30` avec une heure telle que `10:17`, ou déclarer une journée avec des horaires arbitraires, et franchir la validation canonique.

Impact : les payloads de drag/resize ne sont pas intégralement revalidés côté serveur, contrairement au contrat Sprint 3. Des réservations impossibles à représenter exactement dans la grille peuvent être persistées, entraînant dérive visuelle et divergences entre clients.

Correction attendue : valider côté serveur l'alignement réel des instants dans le fuseau IANA du site, pour création, PATCH, duplication et commandes de cellule ; retourner `422 VALIDATION_ERROR` sans mutation/audit/SSE ; ajouter les cas négatifs 10:17/30 min, demi-journée hors borne et journée hors borne.

### P1-3 — Déplacement et redimensionnement n'ont pas d'alternative clavier opérante

Les événements Planning sont rendus en `<article draggable>` sans `tabindex`. Les poignées de resize sont des boutons focusables mais n'ont qu'un gestionnaire `dragstart`, sans commande clavier. Le gestionnaire `onkeydown` attaché aux éléments `data-select-cell` ne devient donc pas atteignable sur l'article lui-même ; les raccourcis globaux couvrent copier/coller et annuler/rétablir, pas le déplacement ou le resize. L'ouverture du formulaire par double-clic ne constitue pas une équivalence clavier documentée pour les gestes exigés.

Impact : un utilisateur clavier ou technologie d'assistance ne peut pas exécuter les interactions principales du Sprint 3. Le critère explicite du gate « création, déplacement et resize fonctionnent par souris et clavier » n'est pas démontrable.

Correction attendue : rendre les cellules/événements focusables avec rôle/état cohérents et proposer des commandes clavier explicites pour déplacement unitaire/complet et resize, avec ghost ou annonce `aria-live`, confirmation, rollback et conservation du focus. Ajouter des tests DOM/E2E clavier.

## Contrôles satisfaisants

- Les cinq sélecteurs de vue sont présents ; Mois, 6 semaines et 3 mois utilisent des plages civiles déterministes et une fenêtre virtualisée bornée.
- Le clic-glisser de création peint un ghost puis ouvre seulement le formulaire ; aucun appel API n'est effectué avant confirmation humaine.
- Déplacement complet et resize utilisent un snapshot optimiste et restaurent l'état sur rejet API ; déplacement unitaire reste limité à la salle du même jour conformément à la règle produit antérieure.
- Le serveur refuse les réservations terminales, versions obsolètes, ressources/projets hors scope et dépassements de capacité avant mutation. La cible des exceptions quotidiennes applique `resourceAllowed()`.
- Les week-ends peuvent être affichés ou masqués ; `includeWeekends=false` retire samedi/dimanche du calcul des cellules. Le calendrier `FR-national` est déterministe et limité aux sites `Europe/Paris`.
- Les nouveaux champs sont documentés dans `docs/api/openapi-v1.yaml` et leurs combinaisons autorisées sont cohérentes avec le runtime.
- Aucun accès réseau, SaaS, CDN, dépendance npm ni migration implicite de stack n'est introduit.

## P2 / limites non bloquantes

1. Le contrat Sprint 3 annonce des calendriers nationaux **et site** ; le candidat ne résout que `FR-national` pour `Europe/Paris`. La prise en charge d'un calendrier propre au site reste à spécifier et tester avant de déclarer US-044 exhaustif.
2. Le frontend construit encore les timestamps avec l'offset fixe `+02:00` et découpe directement les chaînes API, alors que la spécification exige stockage UTC et affichage dans le fuseau IANA du site. Ce risque devient bloquant dès qu'une vue horaire traverse l'heure d'hiver ou un site hors Paris ; il doit être traité avec le P1-1/P1-2.
3. Les tests Planning actuels inspectent plusieurs branchements par expressions régulières. Ils ne prouvent pas les interactions réelles du navigateur, la conservation du focus ou le nombre de mutations réseau ; les gates QA/E2E doivent conserver des scénarios instrumentés.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --check server.js` | PASS |
| `node --check app.js` | PASS |
| `node --check tests/api.test.js` | PASS |
| `node --check tests/planning-postproduction.test.js` | PASS |
| `node --test tests/planning-postproduction.test.js` | **PASS, 22/22**, 0 échec/skip/todo, 85 ms |
| `node --test tests/api.test.js` dans le sandbox | Non concluant : `listen EPERM`, restriction locale |
| `node --test tests/api.test.js` hors sandbox | **PASS, 29/29**, 0 échec/skip/todo, 1,064 s |
| Inspection vue Jour/granularité | **P1 confirmé** : une colonne quotidienne, aucun axe/créneau horaire |
| Inspection validation serveur | **P1 confirmé** : compatibilité des métadonnées contrôlée, alignement réel des instants absent |
| Inspection accessibilité des gestes | **P1 confirmé** : articles non focusables et poignées sans action clavier |
| Suite complète | Preuve DEV fournie : **225/225 PASS** ; la QA indépendante reste l'autorité de la preuve complète G3 |

Hashes complets du candidat contrôlé :

```text
server.js                                473a94c9c58b0aece7756766cde55b106dc9b74a6fda281e098a05ee1959dd0b
app.js                                   c5abdac3cf039662dafeef09bcee04f699126a33ea0cfc896c32d918be444b93
planning.css                             e9713e1c83dd2c6af3e2420790ad7d9b5e48087be5f836cb487d9d1339705f6b
index.html                               e4741afedc32c5070196f24c4f8ae0e7965039a59cb0f430445f252f3af496d1
tests/api.test.js                        a8263bb1edb5eaa1f31d6597f7ed3fb79c4f0015130c5a7ce7d0fe226408fb17
tests/planning-postproduction.test.js    f89426c7071037a4616217d7837863f7142e0cd0ea9f6710c987a11b7552de3c
```

## Handoff intégrateur

- Fichier modifié : `docs/code-review.md` uniquement.
- Reporter `G3 REVIEW = CHANGES REQUIRED — 3 P1` dans `docs/project-status.md`.
- Retour DEV requis sur grille horaire Jour, validation serveur du snapping/fuseau et commandes clavier, puis re-REVIEW et tous les gates aval impactés.
- Ne pas déclarer G3 franchi sur la seule base des 225 tests verts : les critères absents sont comportementaux et contractuels.

---

# Gate G2 — Re-REVIEW indépendante du correctif de défilement Planning

Date : 2026-08-21  
Reviewer : agent indépendant `g2_review`  
Périmètre : scroll vertical natif Ressources ↔ grille, synchronisation, virtualisation, axe horizontal, accessibilité et non-régression  
Nature : revue seule ; aucun correctif de code, test, contrat ou autre rapport appliqué

## Verdict

**APPROVED — Gate REVIEW G2 validé**

**0 P0, 0 P1 ouvert.** Le correctif rétablit un défilement vertical natif depuis la colonne Ressources et le synchronise avec la grille sans détourner la molette. La fenêtre virtuelle conserve un tampon de 16 lignes de part et d'autre, restaure les deux axes après rerendu et ne modifie pas le dispositif horizontal.

## Contrôles réalisés

- **Scroll natif Ressources** : `.planning-fixed-column` utilise `overflow-y:auto`; aucun gestionnaire `wheel` ne capture ou ne transforme le mouvement vertical. Le masquage visuel de sa barre ne supprime pas sa capacité de défilement native.
- **Synchronisation bidirectionnelle** : le scroll de la colonne fixe copie `scrollTop` vers la grille ; le scroll de la grille copie `scrollTop` vers la colonne. Le verrou `syncingVertical`, relâché au prochain `requestAnimationFrame`, empêche la récursion et les oscillations.
- **Restauration sans saut** : `planningVirtualState.scrollTop` et `scrollLeft` sont réappliqués à la grille, à la colonne fixe et à la barre horizontale immédiatement puis après calcul de largeur. Le rerendu virtualisé repart donc de la position conservée.
- **Virtualisation** : la fenêtre des ressources est calculée avec un overscan de `16`; le seuil `planningVirtualWindowNeedsRender()` évite un rerendu à chaque cran de molette. Les espaces avant/après maintiennent la hauteur logique des 250 ressources.
- **Axe horizontal inchangé** : `scrollLeft` reste synchronisé uniquement entre la grille et la barre horizontale dédiée. Son interaction molette/clavier, son focus visible et les commandes Home/End/PageUp/PageDown sont conservés.
- **Alignement** : colonne et grille partagent la même hauteur de ligne selon la vue ; le retrait de l'en-tête (`scrollTop - 62`) maintient la fenêtre de ressources alignée sur les cellules.
- **Accessibilité** : le scroll natif n'est pas remplacé par un comportement propriétaire ; les contrôles internes restent atteignables au clavier et la barre horizontale conserve son focus visible. Aucun statut ni contenu n'est rendu dépendant de la position du pointeur.
- **Confirmation PO** : le comportement visuel corrigé a été confirmé par le Product Owner ; la présente revue couvre la cohérence technique et les régressions du candidat exact.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-21.

| Commande / contrôle | Résultat |
|---|---|
| `node --check app.js` | PASS |
| `node --check tests/planning-postproduction.test.js` | PASS |
| `node --test tests/planning-postproduction.test.js` | **PASS, 14/14**, 0 échec/skip/todo, 81 ms |
| `npm test` hors restriction de bind locale | **PASS, 217/217**, 0 échec/skip/todo, 8,170 s |
| Inspection synchronisation verticale | PASS : deux sens présents, garde anti-boucle par frame |
| Inspection restauration/virtualisation | PASS : deux axes restaurés, overscan vertical 16 et seuil de rerendu |
| Inspection axe horizontal | PASS : mécanisme dédié conservé, sans couplage au scroll vertical Ressources |
| Inspection CSS/accessibilité statique | PASS : overflow natif, focus horizontal visible, aucune interception de molette sur la colonne fixe |

Hashes complets du candidat approuvé :

```text
app.js                               ccf24edfa0335db68de28bf1ca03d113a487fbb48e4ad06a529044d1237c0780
planning.css                         2a71e804730932358c1e86cb1b14b6c68b06aafd608408c36935e68862e7bf8a
tests/planning-postproduction.test.js a71a4301162ce6fb64631b5cc320327a1270d6d5d500b7ff4fae40ac1a0732cc
```

## P2 / limites non bloquantes

1. Les tests automatisés valident les calculs et les branchements, mais ne mesurent pas le nombre réel d'événements `scroll`/frames ni les positions pixel par pixel dans plusieurs moteurs de navigateur. Conserver un smoke visuel Chrome/Safari dans l'E2E de release.
2. La colonne Ressources masque sa barre verticale. Le défilement reste natif et la grille offre une barre visible, mais un libellé de région scrollable et un focus explicite amélioreraient encore la découvrabilité pour certains utilisateurs clavier/technologies d'assistance.
3. Cette approbation vaut uniquement pour les trois hashes ci-dessus et le candidat backend G2 déjà approuvé ; tout changement ultérieur impose une nouvelle analyse d'impact.

## Handoff intégrateur

- Fichier modifié : `docs/code-review.md` uniquement.
- Reporter `G2 REVIEW scrolling = Approved — 0 P0/P1` dans `docs/project-status.md`.
- Les gates QA/Performance/E2E doivent conserver le contrôle visuel multi-navigateur et la fluidité sur le jeu 250/10 000 ; ce verdict REVIEW ne les remplace pas.

---

# Gate G2 — Re-REVIEW finale du candidat corrigé

Date : 2026-08-20  
Reviewer : agent indépendant `g2_review`  
Périmètre : fermeture du dernier P1 G2, invariants terminaux, scopes des commandes Planning et non-régression ciblée  
Nature : revue seule ; aucun correctif de code, test, contrat ou autre rapport appliqué

## Verdict

**APPROVED — Gate REVIEW G2 validé**

**0 P0, 0 P1 ouvert.** Le dernier contournement de `entityScopes.resource` est fermé dans le chemin direct et dans la validation commune des exceptions quotidiennes. Les deux P1 initiaux et le P1 résiduel sont désormais fermés sur le candidat exact ci-dessous.

## Fermetures vérifiées

- **Cible du déplacement de cellule** : `moveReservationCell()` exige `resourceAllowed(auth, value)` dès la résolution de la salle cible. Une salle masquée retourne 404 avant construction et persistance de la mutation.
- **Validation commune `dailyCells`** : chaque `cellOverride.targetResourceId` est résolu avec `resourceAllowed(auth, resource)`. Un autre consommateur qui injecterait une exception quotidienne ne peut donc pas contourner le scope par ce validateur.
- **Cas négatif source autorisée → cible masquée** : le test crée une réservation visible sur `resource_3`, tente le déplacement vers `resource_5` masquée, attend 404, puis confirme que la version et `cellOverrides` sont inchangés.
- **Réservation réalisée** : la route et le cœur de `moveReservationCell()` refusent explicitement `completed` avec 409 `RESERVATION_TERMINAL`. La protection ne dépend donc pas uniquement du préfiltre HTTP.
- **P1 précédents** : DELETE respecte toujours l'automate terminal ; duplication complète, duplication de cellule et déplacement exigent toujours `reservationAllowed()` sur la source.

## Consommateurs et non-régression

- La duplication complète et la duplication de cellule continuent à passer par `validateReservation()`, qui contrôle les allocations ordinaires et leurs scopes.
- Le refus de cible masquée intervient avant `Object.assign`, audit et émission SSE ; l'état persistant ne change pas.
- `app.js` et `planning.css` restent inchangés. Les statuts UI, la virtualisation et les consommateurs du contrat serveur précédemment relus ne présentent pas de nouvelle régression P0/P1 issue de ce correctif ciblé.
- Les scénarios API de terminalité, scopes, idempotence, audit et fichiers statiques passent ensemble.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-20.

| Commande / contrôle | Résultat |
|---|---|
| `node --check server.js` | PASS |
| `node --check tests/api.test.js` | PASS |
| `node --test tests/api.test.js` hors restriction de bind locale | **PASS, 29/29**, 0 échec/skip/todo, 1,054 s |
| Inspection `moveReservationCell()` | PASS : source scoped, cible `resourceAllowed`, états `cancelled`/`completed` refusés avant mutation |
| Inspection `validateReservation(cellOverrides)` | PASS : cible active, salle/suite, même société/site et `resourceAllowed` |
| Inspection négatif cible masquée | PASS : 404, version identique, aucune exception ajoutée |
| Suite complète | Preuve DEV fournie sur ce candidat : **216/216 PASS** ; non rejouée par ce reviewer après la preuve API fraîche ciblée |
| Lint/build/diff | Preuves DEV fournies PASS ; aucun changement frontend dans cette correction finale |

Hashes complets du candidat approuvé :

```text
server.js         5434fb65167956549fd474f5fa80bc9e3af9d456397e41a998ec110860f190e4
app.js            76901020ac3e62d9013c8de48d84e37b7f8fd525ce3453aa767ef219c7ea5ae9
planning.css      1b6923060c248d728d6e69aed3fa64a12d0d58d88dd52a8b3151e57d74142606
tests/api.test.js c83494bc655f0ccea4caa3fef41bdc11810b82e737960045f9b2acc6c6f9b32b
```

## P2 / limites non bloquantes

1. Le test de cible masquée prouve directement l'absence de mutation persistée par la version et les exceptions inchangées. Il ne compte pas explicitement les audits et événements SSE avant/après ; l'ordre du code garantit leur non-exécution, mais une assertion dédiée renforcerait la non-régression.
2. Les preuves de fluidité réelle, focus clavier et interactivité du planning virtualisé restent la responsabilité des gates PERFORMANCE/E2E ; ce verdict REVIEW ne les remplace pas.
3. Cette approbation vaut uniquement pour les quatre hashes ci-dessus. Toute modification ultérieure du candidat impose une nouvelle revue d'impact.

## Handoff intégrateur

- Fichier modifié : `docs/code-review.md` uniquement.
- Reporter `G2 REVIEW = Approved — 0 P0/P1` dans `docs/project-status.md`.
- Poursuivre QA, Sécurité, Performance, Intégration et E2E sur exactement ce candidat ; leurs verdicts restent indépendants.

---

# Gate G2 — Re-REVIEW indépendante après corrections Planning

Date : 2026-08-20  
Reviewer : agent indépendant `g2_review`  
Périmètre : fermeture des deux P1 du REVIEW G2 précédent, consommateurs API/UI et non-régression ciblée  
Nature : revue seule ; aucun correctif de code, test, contrat ou autre rapport appliqué

## Verdict

**CHANGES REQUIRED — Gate REVIEW G2 toujours refusé**

**0 P0, 1 P1 ouvert.** La terminalité de l'annulation et le contrôle du périmètre des réservations sources sont corrigés. Le déplacement d'une cellule conserve toutefois un contournement de `entityScopes.resource` sur la salle cible ; G2 reste donc bloqué.

## Fermeture des constats précédents

| Constat | Statut | Preuve |
|---|---|---|
| P1-1 — DELETE d'une réservation `completed` ou déjà `cancelled` | **FERMÉ** | `cancelReservation()` applique désormais `BOOKING_STATUS_TRANSITIONS`; les deux DELETE interdits retournent 409. Les tests vérifient aussi la conservation de l'état et de la version. |
| P1-2 — commandes sur une réservation source hors périmètre | **PARTIELLEMENT FERMÉ** | `duplicateReservation()`, `duplicateReservationCell()` et `moveReservationCell()` exigent maintenant `reservationAllowed(auth, source)`. Les trois cas source cachée → cible autorisée retournent 404. La cible du déplacement de cellule reste cependant hors contrôle d'entité, objet du P1 ci-dessous. |

## P1 ouvert

### P1-1 — Une cellule autorisée peut encore être déplacée vers une salle cachée par `entityScopes.resource`

Dans `moveReservationCell()` (`server.js:2448`), la salle cible est recherchée uniquement par identifiant, société, site, activité et type. Aucun `resourceAllowed(auth, target)` ni `entityAllowed(auth, 'resource', target.id)` n'est appliqué. La validation commune des exceptions `dailyCells` reproduit le même défaut (`server.js:1147-1151`) : elle valide l'existence et le type de la cible, mais pas son appartenance au périmètre du rôle.

Impact : un utilisateur disposant de `planning.write`, autorisé sur la réservation et sa salle source, peut déplacer une journée vers une salle qu'il ne peut ni lister ni consulter, à condition d'en deviner l'identifiant. La mutation, l'audit et l'invalidation SSE sont alors réalisés comme pour une cible autorisée. Les nouveaux tests ne couvrent que le sens inverse — source cachée vers cible autorisée — et ne détectent pas ce contournement.

Correction attendue : exiger le contrôle canonique de ressource sur toute cible de `cellOverrides` avant validation des conflits et avant mutation. Ajouter un test négatif **source/réservation autorisées → salle cible cachée** qui attend 404 et confirme l'absence de modification, d'audit et de SSE. Rejouer ensuite REVIEW et les gates aval impactés.

## Contrôles satisfaisants et non-régression ciblée

- La duplication complète et la duplication de cellule passent par `validateReservation()`, dont le contrôle des allocations ordinaires applique les scopes de ressources.
- Les recherches de réservation source des trois commandes concernées sont maintenant fail-closed par `reservationAllowed()`.
- L'annulation respecte l'automate canonique et ne permet plus de sortir d'un état terminal.
- Les tests API ciblés passent intégralement ; aucune régression n'a été observée dans les 29 scénarios API exécutés.
- `app.js` et `planning.css` sont inchangés par rapport au candidat précédent ; aucun nouveau défaut consommateur P0/P1 n'a été introduit par ce correctif backend.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-20.

| Commande / contrôle | Résultat |
|---|---|
| `node --check server.js` | PASS |
| `node --check tests/api.test.js` | PASS |
| `node --test tests/api.test.js` hors restriction de bind locale | **PASS, 29/29**, 0 échec/skip/todo, 1,050 s |
| Inspection DELETE terminal | PASS : `completed` et second `cancelled` refusés par l'automate |
| Inspection sources duplicate/duplicate-cell/move | PASS : `reservationAllowed()` présent sur les trois recherches |
| Inspection cible move/cellOverrides | **P1 confirmé** : aucun contrôle `entityScopes.resource` sur la salle cible |
| `npm test` complet par ce reviewer | Non rejoué conformément à la demande de verdict terminal immédiat ; la QA doit produire sa preuve complète sur le candidat corrigé |

Hashes complets du candidat contrôlé :

```text
server.js         7412d587fab0a387739076aa852db8aebf0aadee39cbcdfb45d455253fc2d554
app.js            76901020ac3e62d9013c8de48d84e37b7f8fd525ce3453aa767ef219c7ea5ae9
planning.css      1b6923060c248d728d6e69aed3fa64a12d0d58d88dd52a8b3151e57d74142606
tests/api.test.js d233502c33a8ed977d7f60fea16635b1eae2f82abb1be9913520858436bbb3c5
```

## Handoff intégrateur

- Fichier modifié : `docs/code-review.md` uniquement.
- Reporter `G2 REVIEW = CHANGES REQUIRED — 1 P1` dans `docs/project-status.md`.
- Retour DEV strictement limité au contrôle de scope de la salle cible et à son cas négatif, puis nouvelle re-REVIEW sur les hashes corrigés.
- Ce verdict ne valide ni QA, ni Sécurité, ni Performance, ni G2 globalement.

---

# Gate G2 — REVIEW indépendante du candidat Sprint 2

Date : 2026-08-20  
Reviewer : agent indépendant `g2_review`  
Périmètre : US-017 à US-024, US-033/034, US-065 à US-067 et US-069 ; Commercial accepté exploitable ; Planning virtualisé 250 ressources / 10 000 réservations ; API, UI, accessibilité, compatibilité et rollback  
Nature : revue seule ; aucun correctif de code, test, contrat ou autre rapport appliqué

## Verdict

**CHANGES REQUIRED — Gate REVIEW G2 refusé**

**0 P0, 2 P1 ouverts.** La virtualisation, les sept statuts et le parcours commercial couvert par les tests ciblés sont cohérents, mais l'API permet encore de rompre un état terminal et de contourner des scopes lors de commandes Planning. Ces deux défauts bloquent G2 et la release.

## P1 ouverts

### P1-1 — L'annulation API rompt la terminalité d'une réservation réalisée ou déjà annulée (US-069)

Le contrat canonique déclare `completed` et `cancelled` terminaux (`BOOKING_STATUS_TRANSITIONS` contient deux ensembles vides) et l'interface masque bien les actions correspondantes. Pourtant `cancelReservation()` affecte directement `item.status = 'cancelled'` après le seul contrôle de version, sans vérifier `BOOKING_TERMINAL_STATUSES` ni la transition autorisée. `DELETE /api/v1/reservations/{id}` peut donc transformer `completed → cancelled`, ou réannuler une réservation déjà `cancelled` en incrémentant sa version et en ajoutant un nouvel audit/SSE.

Impact : l'historique opérationnel d'une réservation réalisée n'est plus immuable ; l'état réalisé peut disparaître et le journal contient une transition explicitement interdite par le contrat Sprint 2. L'UI ne constitue pas une protection serveur.

Correction attendue : faire appliquer au chemin d'annulation le même automate canonique que le PATCH, refuser tout état terminal avec une erreur 409 stable sans mutation/audit/SSE, et ajouter les tests négatifs `completed → DELETE` et second `cancelled → DELETE` avec vérification de version et journal inchangés.

### P1-2 — Déplacement et duplication contournent les scopes projet/entité sur un identifiant deviné (US-024/033/069)

`duplicateReservation()` et `duplicateReservationCell()` chargent leur source par `companyId`, site et statut, mais sans `reservationAllowed(auth, source)`. La route `/reservations/{id}/duplicate` ne réalise aucun préfiltre canonique. `moveReservationCell()` a le même défaut ; sa route calcule bien un `current` avec `reservationAllowed`, mais n'arrête pas le traitement lorsque ce lookup échoue et appelle quand même le cœur, qui retrouve alors la réservation par société/site seulement.

Impact : un rôle possédant `planning.write` mais limité par `projectIds`, `entityScopes.reservation` ou `entityScopes.resource` peut déplacer ou dupliquer une réservation hors périmètre en devinant son identifiant. La liste et le GET direct restent correctement masqués, ce qui rend le contournement discret.

Correction attendue : utiliser `reservationAllowed(auth, source)` dans chaque commande, retourner 404 avant toute mutation lorsque la source est hors scope, conserver les contrôles sur la ressource cible, et couvrir déplacement, duplication complète et duplication de cellule avec un acteur écrivant à scopes projet/entité restreints.

## Contrôles satisfaisants

- Le viewport calcule des fenêtres bornées sur les axes ressource et temps, conserve les dimensions logiques avant/après et restaure les positions de défilement. Les en-têtes/ressources fixes partagent la géométrie du corps.
- Les sept statuts sont alignés entre serveur et interface ; maintenance et indisponibilité consomment la capacité, portent un libellé textuel et un motif hachuré. Les transitions PATCH illégales sont refusées sans mutation.
- Budget confirmé → Devis, versions commerciales, snapshot fiscal, tarifs automatiques, acceptation, reconnaissance du CA et conversion Planning idempotente sont couverts par la suite Devis. Le rejeu ne duplique pas de réservation et les montants HT/TVA/TTC restent identiques.
- Ressources et capacités supérieures à 1 utilisent les validations serveur canoniques ; l'archivage logique d'une ressource conserve l'historique et reste réservé à l'administration.
- Aucun changement de stack ni dépendance réseau n'est introduit ; la stratégie de rollback reste la restauration atomique du JSON/backup de migration documentée pour cette RC.

## P2 non bloquants

1. Les tests de virtualisation frontend vérifient principalement les fonctions pures et la présence des branchements/CSS. La fluidité réelle, l'interactivité `< 2 s`, le focus clavier après rerendu et la géométrie sous lecteurs d'écran doivent rester des preuves explicites des gates PERFORMANCE/E2E.
2. Le dépôt n'a pas encore de commit initial : tous les fichiers apparaissent non suivis et `HEAD` est inexistant. Les hashes ci-dessous figent donc le candidat de revue, mais l'intégrateur doit établir une baseline Git avant RELEASE pour rendre le rollback et la comparaison de candidat reproductibles.
3. La revue a constaté d'autres chemins historiques de manipulation Planning très concentrés dans `server.js`/`app.js`. Après correction des P1, une relecture ciblée doit confirmer que toutes les commandes de déplacement, copie, annulation, undo/redo appliquent de façon uniforme terminalité, scopes et idempotence.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, UTC `2026-08-20T15:58:52Z`.

| Commande / contrôle | Résultat |
|---|---|
| `node --check server.js` | PASS |
| `node --check app.js` | PASS |
| `node --test tests/planning-postproduction.test.js` | **PASS, 13/13**, 0 échec/skip/todo |
| `node --test tests/domain.test.js` | **PASS, 22/22**, 0 échec/skip/todo |
| `node --test tests/quotes.test.js tests/api.test.js` hors restriction de bind locale | **PASS, 76/76** (47 Devis + 29 API), 0 échec/skip/todo, 4,547 s |
| Exécution API sous sandbox | Non concluante : `listen EPERM`, restriction locale ; relancée avec succès hors sandbox ci-dessus |
| Inspection automate/annulation | **P1-1 confirmé** : `cancelReservation()` ne consulte pas l'automate terminal |
| Inspection scopes déplacement/duplication | **P1-2 confirmé** : trois commandes source sans `reservationAllowed` effectif |
| `npm test` complet par ce reviewer | Non rejoué après les ciblés à la demande de handoff immédiat ; preuve DEV 216/216 à revalider par QA |

Hashes complets du candidat contrôlé :

```text
server.js                                                408e2ca2372c9f149c29a3dd18ac9940209357764b589a5041ed25ab5add507f
app.js                                                   76901020ac3e62d9013c8de48d84e37b7f8fd525ce3453aa767ef219c7ea5ae9
planning.css                                             1b6923060c248d728d6e69aed3fa64a12d0d58d88dd52a8b3151e57d74142606
tests/api.test.js                                        445666eeb944abb833c9fbc555e34ad19e487f054f1a4dc9c6ce41fad0675dc7
tests/quotes.test.js                                     784adb8e917650fe47f772eb9344dc9abc4d12978e3b4df8e2574e5b501b0e05
tests/planning-postproduction.test.js                    1248165d5d8d153fc801f90226c9898c97f59a6279f25fe16d0f9f8b2a77687e
tests/domain.test.js                                     4fc062d534da69e27d2b30106f8d6c805d520179a92d171d250824f70e22896f
docs/specifications/sprint-2-commercial-planning-kernel.md 57b47d9f96335395bc6078ca8ceb17a44620f6e512a3d2644979a8277e250e89
```

## Handoff intégrateur

- Fichier modifié : `docs/code-review.md` uniquement.
- Reporter `G2 REVIEW = CHANGES REQUIRED — 2 P1` dans `docs/project-status.md`.
- Retour DEV limité au respect des états terminaux et des scopes des commandes Planning, avec tests négatifs ; puis re-REVIEW sur les nouveaux hashes et rejeu des gates aval impactés.
- Cette revue ne déclare ni QA, ni Sécurité, ni Performance, ni G2 globalement validés.

---

# Gate G0 — Re-REVIEW finale du diff E2E frontend

Date : 2026-08-19  
Reviewer : agent indépendant `g0_review`  
Candidat : `app.js ad22b4fa…`, `planning.css 7aadb6a0…`, tests fondations `bce34401…`, serveur inchangé `ae82955e…`  
Nature : revue seule ; aucun correctif de code, test ou contrat appliqué

## Verdict

**APPROVED — Gate REVIEW validé**

**0 P0, 0 P1 ouvert.** Le diff frontend rétablit un parcours de création Ressource utilisable, idempotent et accessible sans régression bloquante détectée.

## Contrôles

- Le bouton `Nouvelle ressource` est réservé à `resource.manage`; la dernière composition de `bind()` remplace le gestionnaire générique par `openResourceCreateDrawer`. Le parcours Ressource actif n'appelle donc pas le `prompt()` historique.
- Le drawer expose nom, type, site, capacité et couleur avec exemples, contraintes HTML et erreur serveur visible. L'envoi utilise une clé `Idempotency-Key` stable pendant toute la tentative, puis recharge la liste depuis l'API.
- Le dialogue porte `role="dialog"`, `aria-modal`, un titre référencé et une fermeture étiquetée. L'ouverture mémorise le déclencheur, place le focus dans le premier champ; fermeture, Échap et piège Tab sont présents.
- Le formulaire de réservation est borné à `100dvh - 40px`, scrollable, avec en-tête/actions persistants. La sidebar devient scrollable verticalement avec confinement du surdéfilement; le layout reste utilisable à hauteur laptop.
- Aucun consommateur serveur/API n'est modifié; le contrat de création Ressource et son idempotence précédemment approuvés restent inchangés.

## P2 non bloquants

1. Après création réussie, le drawer est masqué puis la page est rerendue sans restaurer explicitement le focus vers un élément stable; la restauration existe seulement dans `closeStockDrawer()`. Prévoir un focus sur le titre ou le bouton de création après succès.
2. Le test frontend ajouté est une preuve statique de branchement et d'en-tête, pas un vrai test navigateur du focus, du piège Tab, de la soumission/rejeu et des dimensions laptop. Ces vérifications restent à matérialiser dans le gate E2E.
3. La fonction générique historique `add()` contient encore un `prompt()` pour d'autres parcours. Elle n'est plus atteinte depuis le bouton Ressource après composition actuelle, mais sa conservation rend ce résultat dépendant de l'ordre des wrappers `bind()`.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, UTC `2026-08-19T20:05:22Z`.

| Commande | Résultat |
|---|---|
| `node --test tests/foundations.test.js` | **PASS, 15/15**, 0 échec/skip/todo |
| `npm run lint` | PASS |
| `npm run build` | PASS, 5 actifs runtime |
| `npm test` hors restriction de bind locale | **PASS, 195/195**, 0 échec/skip/todo, 7,381 s |
| Inspection composition `bind()` et drawer | PASS, parcours Ressource sans prompt et clé stable |
| Inspection CSS laptop/a11y | PASS statique; validation visuelle laissée au gate E2E |

Hashes complets :

```text
app.js                    ad22b4fa21665fd7e58cf24e7244d73a6adeb06dd794521b93c7e8da9d5395fe
planning.css              7aadb6a01b7bbf33edc8ac449ac184b44a37ff54e6b5c77ee57aad7ed4e1c060
tests/foundations.test.js bce34401ab1af13674ecc77647e1ab1714a46d19dc870057430e48c1cb37c927
server.js                 ae82955eb0b3862adec16396b9e6e3377c6db861e526f4fdc4ef0fd66bf0383f
```

## Handoff

- Fichier modifié : `docs/code-review.md` uniquement.
- Cette approbation vaut uniquement pour les hashes ci-dessus; tout changement ultérieur impose une nouvelle relecture.
- L'intégrateur peut reporter `G0 REVIEW = Approved` et poursuivre les gates aval; le gate E2E doit conserver la vérification visuelle laptop et clavier.

---

# Gate G0 — Re-REVIEW ultime du candidat figé

Date : 2026-08-19  
Reviewer : agent indépendant `g0_review`  
Candidat : `server.js ae82955e…`, `app.js a2ce1f6a…`, tests API `189c4872…`  
Nature : revue seule ; aucun correctif de code, test ou contrat appliqué

## Verdict

**APPROVED — Gate REVIEW validé**

**0 P0, 0 P1 ouvert.** Les deux derniers P1 sont fermés sur le candidat contrôlé et aucune régression P0/P1 n'a été trouvée dans le périmètre impacté.

## Fermeture vérifiée

- **SSE fail-closed** : `sseScopeAllowed()` classe explicitement les familles connues, applique les scopes canoniques ressource/client/projet/devis/réservation et retourne `false` pour toute famille inconnue. Le test unitaire intégré vérifie événement inconnu refusé, ressource autorisée, ressource exclue et projet exclu.
- **Dashboard d'occupation** : `occupancyResponse()` filtre les ressources par `resourceAllowed()` et les réservations par société, site et `reservationAllowed()` — lequel inclut projet, réservation et ressources. Le test API applique simultanément `projectIds` et `entityScopes`, ne restitue que `resource_3` et confirme zéro heure issue des réservations exclues.
- Les corrections précédemment validées restent présentes : LoginResponse alignée, idempotence des commandes sensibles et audit canonique before/after de la gouvernance.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, UTC `2026-08-19T15:54:03Z`.

| Commande / contrôle | Résultat |
|---|---|
| `npm run lint` | PASS |
| `npm run build` | PASS, 5 actifs runtime |
| `npm test` hors restriction de bind locale | **PASS, 194/194**, 0 échec/skip/todo, 7,493 s |
| Inspection ciblée `sseScopeAllowed` | PASS, famille inconnue refusée explicitement |
| Inspection ciblée `occupancyResponse` | PASS, scopes ressource/réservation/projet appliqués |
| Tests ciblés inclus dans `tests/api.test.js` | PASS au sein de la suite complète |

Hashes complets :

```text
server.js          ae82955eb0b3862adec16396b9e6e3377c6db861e526f4fdc4ef0fd66bf0383f
app.js             a2ce1f6adda4e73f538fc7ce37f414454b33cb0c484ebc96f21a6fdf11c6649c
tests/api.test.js  189c4872bab0e7f9ea4b607d5293654583cbef0c504471a5daa465df5c58d6f3
```

## Limites et handoff

- Cette approbation porte sur le candidat et les hashes ci-dessus ; toute modification ultérieure invalide automatiquement le verdict.
- Les deux P2 historiques — duplication de blocs de routes inaccessibles et matrice idempotence non exhaustive pour chaque commande — restent des améliorations non bloquantes.
- Fichier modifié : `docs/code-review.md` uniquement. L'intégrateur doit reporter `G0 REVIEW = Approved` dans `docs/project-status.md` et poursuivre les gates aval sur ce même candidat.

---

# Gate G0 — Re-REVIEW finale indépendante du candidat figé

Date : 2026-08-19  
Reviewer : agent indépendant `g0_review`  
Candidat contrôlé : `server.js da1e4ec8…`, `app.js a2ce1f6a…`, OpenAPI `bd171012…`, tests API `23f32d7c…`  
Nature : revue seule ; aucun correctif de code, test, contrat ou autre document appliqué

## Verdict

**CHANGES REQUIRED — Gate REVIEW refusé**

**0 P0, 2 P1 ouverts.** Les corrections Login, idempotence et audit ferment trois des quatre P1 ciblés. Le filtrage SSE est corrigé pour les familles canoniques connues, mais reste fail-open pour une famille non mappée. L'inspection des scopes étendus révèle en outre une fuite HTTP sur le dashboard d'occupation.

## Fermeture des quatre P1 ciblés

| P1 ciblé | Statut | Preuve |
|---|---|---|
| LoginResponse OpenAPI/runtime | **FERMÉ** | `/auth/login` référence `LoginResponse`, qui exige exactement `user` et `csrfToken`, comme la réponse directe du runtime. OpenAPI parse avec 9 schémas. |
| Idempotence rôles/memberships/scopes et archivage ressource | **FERMÉ** | Les routes actives appellent les commandes partagées basées sur `foundationCommandMarker`; le rejeu conserve résultat/version et n'émet pas de second SSE. Les tests couvrent création/modification rôle, scope membership et archivage ressource. |
| SSE fail-closed et types canoniques | **PARTIEL — P1 ouvert** | `resource`, `client`, `quote`, `reservation`, tarifs et agrégats commerciaux sont désormais mappés correctement. Toutefois, `return ... && (!mappedType || entityAllowed(...))` autorise encore toute famille non mappée sans `entityType`, même lorsqu'un scope d'entité est actif. |
| Audit before/after gouvernance | **FERMÉ** | Les commandes membership/roles/scopes et rôles capturent des snapshots structurés avant/après, avec version et opération idempotente ; la sanitisation canonique reste appliquée. Les tests vérifient rôle et scope réels via `/audit`. |

## P1 ouverts

### P1-1 — Les événements SSE non mappés restent fail-open sous scope d'entité (US-108)

`sseScopeAllowed()` dérive correctement les types connus, puis utilise `(!mappedType || entityAllowed(...))`. Une famille d'événement nouvelle ou oubliée, sans `entity.entityType`, contourne donc entièrement `entityScopes`. Cela ne respecte pas la condition de fermeture précédente « refuser par défaut un type inconnu lorsqu'un scope d'entité est actif » et rend l'isolation dépendante de l'exhaustivité manuelle du mapping.

Impact : une future invalidation ou une famille existante non classée peut exposer identifiant/version d'une entité hors périmètre sans échec visible.  
Correction attendue : catalogue canonique fermé pour le SSE, décision explicite par famille (`scope entity`, `scope projet/site seulement`, ou refus), refus par défaut lorsque des scopes d'entité restreignent la session, et test négatif d'un événement inconnu/non mappé.

### P1-2 — Le dashboard d'occupation ignore les scopes ressource et réservation (US-108)

`occupancyResponse()` filtre seulement société, activité et site. Les ressources ne passent pas par `resourceAllowed()`/`entityAllowed(auth, 'resource', ...)` et les réservations agrégées ne passent ni par `reservationAllowed()` ni par `projectAllowed()`. Le test de scopes vérifie ressources, réservation directe, catalogue, contacts et tarifs, mais n'appelle pas `/api/v1/dashboard/occupancy` après restriction.

Impact : un lecteur limité à `resource_3`, à une liste de réservations vide ou à certains projets peut obtenir les noms, types et taux d'occupation de ressources exclues du même site ; les agrégats peuvent aussi révéler l'activité de réservations hors périmètre.  
Correction attendue : filtrer les ressources avec `resourceAllowed`, les réservations avec `reservationAllowed` et le projet, puis ajouter un test dashboard après application simultanée de `projectIds` et `entityScopes`.

## P2

1. Les anciens blocs de routes gouvernance restent présents après les nouveaux wrappers, bien qu'ils soient rendus inaccessibles par les retours anticipés. Leur duplication augmente le risque qu'un futur réordonnancement réactive une implémentation sans garanties G0.
2. La couverture idempotence approfondie est inégale : les principaux rejeux sont testés, mais la matrice complète même contenu / ordre de clés différent / contenu divergent n'est pas répétée pour chaque commande de gouvernance.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, UTC `2026-08-19T15:43:32Z`.

| Commande / contrôle | Résultat |
|---|---|
| `npm run lint` | PASS |
| `npm run build` | PASS, 5 actifs runtime |
| `npm test` sous sandbox | Non concluant : `listen EPERM`, restriction de bind locale |
| `npm test` relancé hors restriction de bind | **PASS, 193/193**, 0 échec/skip/todo, 7,255 s |
| Parse YAML Ruby | PASS : OpenAPI 3.1.0, **21 chemins / 9 schémas** |
| Inspection OpenAPI/runtime | LoginResponse alignée ; exemples réservation exécutables |
| Inspection idempotence/audit | Commandes actives conformes ; rejeux et snapshots gouvernance présents |
| Inspection scopes HTTP/SSE | Deux failles fail-open détaillées ci-dessus |

Hashes complets vérifiés :

```text
server.js                       da1e4ec8d01279e52043cf846c4f3b94daeb4289c823a112b0a1839190a0ec69
app.js                          a2ce1f6adda4e73f538fc7ce37f414454b33cb0c484ebc96f21a6fdf11c6649c
docs/api/openapi-v1.yaml        bd171012cc0018384d3c3a35ffc5ff639fd1edb27697bd6d14feda36d7aeeae8
tests/api.test.js               23f32d7c96849c2e7b63c3c8722ae90e1b075f66140b298f9044a2fb0205d4ef
packages/audit/index.js         ecd710854ad0f474cd2dd9c56c0e8d2c7a5db1ab94269c729263e1961a607924
packages/auth/rbac.js           e6aa3313d86108b328f7518b824171e0bbd513102df86c075de533af5a984f13
```

## Handoff intégrateur

- Fichier modifié : `docs/code-review.md` uniquement.
- Reporter `G0 REVIEW = Bloqué / CHANGES REQUIRED — 2 P1` dans `docs/project-status.md`.
- Retour DEV limité à `sseScopeAllowed`, `occupancyResponse` et leurs tests négatifs, puis re-REVIEW sur un nouveau candidat figé.

---

# Gate G0 — Re-REVIEW indépendante du candidat corrigé

Date : 2026-08-19  
Reviewer : agent indépendant `g0_review`  
Candidat contrôlé : `server.js bac0e36f…`, `app.js a2ce1f6a…`, `packages/audit ecd71085…`, `packages/auth/rbac e6aa3313…`, OpenAPI `fb8dcb16…`  
Nature : re-review seule ; aucun correctif de code, test, contrat ou autre document appliqué

## Verdict de re-review

**CHANGES REQUIRED — Gate REVIEW refusé**

**0 P0, 4 P1 ouverts.** Deux P1 initiaux sont fermés, trois sont seulement partiellement fermés et un écart contractuel OpenAPI reste présent. La suite complète verte ne couvre pas les chemins bloquants décrits ci-dessous.

## Statut des cinq P1 initiaux

| P1 initial | Statut | Preuve de re-review |
|---|---|---|
| OpenAPI/runtime et exemples | **PARTIEL — P1 ouvert** | Les réservations utilisent désormais `resources`, les réponses RC1 directes sont documentées et les exemples POST/PATCH sont exécutés par `tests/api.test.js`. En revanche, `POST /auth/login` annonce encore `SuccessEnvelope {data,meta}` alors que `server.js` renvoie directement `{user, csrfToken}`; aucun test de contrat ne rejoue cet exemple. |
| Idempotence mutations sensibles | **PARTIEL — P1 ouvert** | POST/PATCH/DELETE réservation et créations/modifications client-projet-ressource principales utilisent un digest stable/replay. Les mutations de sécurité `PUT memberships/{id}/roles`, `PUT memberships/{id}/scopes`, création/modification de rôles et archivage de ressource ignorent toujours la clé d'idempotence. |
| Scopes projet/entité | **PARTIEL — P1 ouvert** | Persistance, contexte serveur, listes/IDs directs et PlanyBot filtrent projet/ressource. Les invalidations SSE contournent le scope d'entité pour les ressources et d'autres agrégats : `sseScopeAllowed()` appelle `entityAllowed(auth, entity.entityType || entity.type || '', entity.id)`; une ressource porte `type='room'|'suite'…`, alors que le scope est enregistré sous `resource`. |
| Audit canonique | **PARTIEL — P1 ouvert** | Le runtime réutilise désormais `appendAudit`, avec sanitisation récursive, opération/origine et before/after; quatre mutations réelles sont testées. Plusieurs mutations critiques de gouvernance (`membership.rolesUpdated`, `membership.updated`, `role.updated`) ne fournissent toujours pas leur état avant/après; le contrat canonique produit donc des champs nuls sur des changements de droits. |
| ADR-002 et statuts ADR | **FERMÉ** | ADR-002 définit journée commerciale, demi-journée, heures réelles, week-end, fériés, intervalles et cas DST inexistants/ambigus avec exemples. Les sept ADR portent le statut `adopté`. |

## P1 ouverts

### P1-1 — Réponse de login OpenAPI incompatible avec le runtime (US-002)

`docs/api/openapi-v1.yaml` référence `SuccessEnvelope` pour le succès de `/auth/login`. `server.js` renvoie `{ user, csrfToken }` sans `data` ni `meta`, comportement également consommé par tous les helpers de tests. Le test « exemples OpenAPI exécutables » ne couvre que les réservations.

Impact : un client généré depuis le contrat échoue dès l'authentification ou lit une structure inexistante.  
Correction : documenter la réponse RC1 directe avec un schéma `LoginResponse`, ou envelopper réellement la réponse avec migration explicite du frontend, puis exécuter l'exemple de login contre le runtime.

### P1-2 — L'idempotence reste absente de mutations sensibles de gouvernance (US-006)

Les routes qui modifient les rôles, les scopes d'une membership et les rôles personnalisés n'appellent pas `foundationCommandMarker` et ne traitent pas `Idempotency-Key`. L'archivage de ressource reste également hors du contrat partagé. Ce sont des mutations sensibles : un retry après perte de réponse peut réappliquer version/audit/événement ou répondre différemment au lieu de rejouer le résultat initial.

Impact : la règle absolue « toute mutation sensible est idempotente » n'est toujours pas satisfaite.  
Correction : appliquer le scope/digest/replay partagé à ces routes, compléter OpenAPI et tester même contenu, ordre de clés différent et contenu divergent.

### P1-3 — Les scopes d'entité ne protègent pas les invalidations SSE (US-108)

Pour `resource.updated.v1`, l'entité transmise possède `type='room'` ou un autre métier. `sseScopeAllowed()` teste donc un scope nommé `room` au lieu de `resource`; comme ce scope n'existe pas, `entityAllowed()` autorise l'événement. Pour les entités sans `entityType`/`type`, la clé vide produit le même fail-open. Seules les réservations bénéficient d'un traitement spécial correct.

Impact : un utilisateur limité à `entityScopes.resource=['resource_3']` peut recevoir l'identifiant/version d'une ressource exclue du même site; les scopes `client` et `quote` ne sont pas non plus correctement dérivés du nom d'événement. C'est une rupture d'isolation serveur temps réel.  
Correction : mapper explicitement chaque famille d'événement vers son type canonique, refuser par défaut un type inconnu lorsqu'un scope d'entité est actif, puis tester SSE après restriction et révocation. Les chemins PlanyBot inspectés filtrent correctement projets, réservations et ressources; aucune régression P1 PlanyBot distincte n'a été trouvée.

### P1-4 — L'audit canonique n'est pas complet sur les mutations de droits (US-004)

`appendAudit` et la sanitisation récursive sont intégrés correctement. Cependant, `membership.rolesUpdated`, `membership.updated` et `role.updated` ne capturent pas l'objet avant/après; ils passent seulement les versions. La création d'une membership ou d'un rôle ne fournit pas non plus systématiquement `after`. Le test actuel vérifie projet, ressource, client et réservation, pas les mutations de gouvernance les plus sensibles.

Impact : il est impossible de reconstruire quels rôles, permissions, statut ou périmètre ont été changés à partir de l'audit, alors que ces mutations conditionnent tous les accès.  
Correction : capturer des snapshots minimaux sanitizés avant/après pour membership/role/scope et ajouter un test API de modification puis lecture de l'audit.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, 2026-08-19.

| Commande / contrôle | Résultat |
|---|---|
| `npm run lint` | PASS |
| `npm run build` | PASS, 5 actifs runtime |
| `npm test` sous sandbox | Non concluant : `listen EPERM`, limitation de bind locale |
| `npm test` relancé hors restriction de bind | **PASS, 192/192**, 0 échec/skip/todo, 7,233 s |
| Parse YAML Ruby | PASS syntaxique : OpenAPI 3.1.0, **21 chemins / 8 schémas** |
| Vérification hashes | Conformes aux cinq hashes de candidat transmis |
| Inspection ciblée OpenAPI ↔ runtime | Réservations alignées; réponse login divergente |
| Inspection scope HTTP/PlanyBot/SSE | HTTP et PlanyBot bornés; dérivation du type SSE incorrecte |
| Fenêtre frontend visible | **Non exécutée : aucun navigateur n'était exposé par le runtime de contrôle (`browsers=[]`)**. Le serveur de prévisualisation local a bien démarré sur `127.0.0.1:8197`; cette limite ne remplace pas une preuve visuelle. |

Hashes complets vérifiés :

```text
server.js                       bac0e36fd49d5b2e1e42fd1616e2a8b2f782f27bb2dc32fa99017ce65fcbbff5
app.js                          a2ce1f6adda4e73f538fc7ce37f414454b33cb0c484ebc96f21a6fdf11c6649c
packages/audit/index.js         ecd710854ad0f474cd2dd9c56c0e8d2c7a5db1ab94269c729263e1961a607924
packages/auth/rbac.js           e6aa3313d86108b328f7518b824171e0bbd513102df86c075de533af5a984f13
docs/api/openapi-v1.yaml        fb8dcb1660a81531dc7426ab2f059617fee25794daed222dc7c533d5398fb2fc
```

## Handoff intégrateur

- Fichier modifié par cette re-review : `docs/code-review.md` uniquement.
- Reporter `G0 REVIEW = Bloqué / CHANGES REQUIRED — 4 P1` dans `docs/project-status.md`.
- Revenir à DEV, corriger les quatre P1, puis rejouer REVIEW et les gates aval sur un candidat figé.
- Re-review minimale : exemple login OpenAPI exécuté, idempotence role/scope, SSE scope ressource/client/quote, audit before/after des droits, et chargement frontend dans une fenêtre réellement visible.

---

# Gate G0 — REVIEW indépendante du Sprint 0 V1

Date : 2026-08-19  
Reviewer : agent indépendant `g0_review`  
Périmètre : US-001/002/003/004/005/006/106/108, sept ADR, OpenAPI, packages de fondation, migrations RBAC, intégration `server.js`/`app.js`, tests, CI et documents Sprint 0  
Nature : revue seule ; aucun code, test, contrat ni autre document modifié

## Verdict

**CHANGES REQUIRED — Gate REVIEW refusé**

Aucun P0 n'a été identifié. Cinq P1 restent ouverts. La suite automatisée est verte, mais elle ne démontre pas les contrats déclarés lorsque le contrat OpenAPI diverge du runtime et que les périmètres projet/entité, l'audit et l'idempotence ne sont pas intégrés de bout en bout. Les sept ADR portent encore le statut `proposé`; ils ne peuvent pas être considérés validés tant que les P1 ci-dessous ne sont pas corrigés puis relus.

Sprint 1 reste bloqué conformément au critère G0 de `docs/specifications/sprint-0-foundations.md`.

## P0 — Critique

Aucun P0 identifié.

## P1 — Bloquants

### P1-1 — Le contrat OpenAPI des réservations n'est pas exécutable contre le runtime (US-002)

- `ReservationCommand` exige `allocations`, tandis que `server.js` ne construit les allocations qu'à partir de `resources` ou `resourceId` (`canonicalAllocations`/`reservationFrom`). Un client conforme au YAML envoie donc un champ que le runtime ignore et sa création échoue à la validation.
- `POST /reservations` et `PATCH /reservations/{id}` annoncent une `SuccessEnvelope`; le runtime renvoie directement la réservation.
- `PATCH /reservations/{id}` annonce `Idempotency-Key`, mais la route appelle `patchReservation` sans lire ni mémoriser cette clé.
- Le document ne fournit pas les exemples de requêtes/réponses exigés par le backlog et la SPEC. Les 16 chemins sont un sous-ensemble/alias de l'API réelle et ne publient pas les domaines minimaux comme contrats stables (`/users`, `/services`, `/pricing`, `/budgets`, `/planning`, `/analytics`).

Impact : un consommateur généré depuis le contrat ne peut pas créer/modifier une réservation de manière fiable; US-002 n'est pas satisfaite.  
Correction attendue : choisir un vocabulaire canonique unique, aligner enveloppes et en-têtes, publier les domaines/exemples requis, puis ajouter un test de contrat qui rejoue réellement les exemples OpenAPI contre le serveur.

### P1-2 — L'idempotence n'est pas appliquée à toutes les mutations sensibles (US-006)

La mise à jour d'une réservation est une mutation sensible et son propre contrat exige une clé, mais `patchReservation(rid, input, auth, res, requestId)` n'a aucun scope/digest/replay. La création de ressource, sa modification, la création/modification client-projet et l'annulation de réservation ne disposent pas non plus d'un contrat idempotent uniforme. Certaines commandes commerciales possèdent un marqueur ad hoc, parfois avec `JSON.stringify(input)` au lieu du digest stable du package partagé.

Impact : après une coupure réseau, un retry ne bénéficie pas partout de la garantie déclarée; le comportement dépend de la route.  
Correction attendue : inventorier les mutations sensibles V1, appliquer le contrat partagé `(société, acteur, commande, cible, clé, digest stable)`, persister le résultat/replay et tester le même payload, un ordre de clés différent et un payload divergent.

### P1-3 — Les périmètres projet et entité ne sont pas implémentés côté serveur (US-108)

`membershipScopes` ne représente que `organization|sites`, `siteIds` et `organizationUnitIds`. `buildUserContext` ne produit ni `projectIds` ni périmètre d'entité. Le package RBAC sait tester `context.projectIds` seulement si ce tableau existe, mais le runtime ne le renseigne jamais; aucun contrôle équivalent n'existe pour l'entité.

Impact : la promesse « société/site/projet/entité » de la SPEC et du backlog est réduite à société/site/unité. Les tests de masquage tenant/site ne prouvent pas les deux scopes manquants.  
Correction attendue : contractualiser et persister les scopes projet/entité, les injecter depuis la membership, les appliquer aux listes et identifiants directs avec masquage `404`, puis tester API et interface pour chaque rôle concerné.

### P1-4 — L'audit intégré ne garantit pas avant/après, opération et origine (US-004)

Le package `packages/audit` définit une entrée propre, mais le runtime utilise sa propre fonction `audit`. Celle-ci stocke acteur/société/action/cible/date et des détails libres; elle n'extrait pas de champs canoniques `versionBefore`, `versionAfter`, `before`, `after`, `operationId` ou `origin`. Plusieurs mutations critiques appellent l'audit sans détail : création/modification de ressource, création/modification client-projet; l'annulation d'une réservation ne conserve pas son état précédent. Le filtre runtime ne réutilise pas non plus le filtre de clés sensibles du package.

Impact : le journal n'est pas une preuve reconstructible uniforme et le contrat testé en isolation ne démontre pas le comportement réel.  
Correction attendue : intégrer un seul constructeur d'audit, rendre obligatoires les champs adaptés à chaque mutation, capturer avant/après et opération/origine, appliquer le masquage partagé, puis vérifier des mutations réelles par l'API.

### P1-5 — Le modèle temps/calendrier reste ambigu et les ADR ne sont pas validables (US-001 / G0)

ADR-002 définit UTC, fuseau IANA, intervalles semi-ouverts, week-ends/fériés explicites et annonce des tests DST, mais ne définit pas la journée commerciale, les demi-journées, les règles d'heures, la politique exacte des jours fériés ni les conversions lors des heures DST inexistantes/ambiguës. Ces points étaient explicitement requis par le prompt Sprint 0. Les sept ADR restent au statut `proposé`.

Impact : deux modules futurs peuvent calculer différemment quantité vendue, durée planifiée et capacité aux limites calendaires.  
Correction attendue : compléter ADR-002 avec une table normative et des exemples DST/week-end/férié/demi-journée, corriger les autres P1, puis faire passer les ADR au statut adopté uniquement après la re-review indépendante.

## P2 — Importants non bloquants après fermeture des P1

1. **US-106 n'est pas prouvée dans l'interface.** La migration additive, rejouable et contrôlée installe bien exactement sept rôles. Les tests couvrent catalogue et autorisation API, mais aucune preuve UI automatisée ne vérifie, pour les sept rôles, visibilité et impossibilité effective d'une action interdite. Ajouter une matrice rôle × action sur API et interface; documenter aussi quel rôle non-admin accepte/valide un devis.
2. **US-003 est davantage un catalogue qu'une intégration complète.** Le journal séquencé/rejouable est tenant-scopé et les types requis existent, mais aucun producteur runtime `ActualConfirmed` n'a été trouvé et les payloads issus de `audit()` se limitent à action/versions. Ajouter les producteurs et schémas de payload nécessaires aux futurs consommateurs Analytics/PlanyBot, plus un test de rejeu multi-types.
3. **US-005 manque de granularité opérationnelle.** `error_id`, logs JSON et métriques protégées existent. Les métriques restent globales (pas de ventilation route/moteur, requêtes lentes ou retard de rejeu), et les erreurs statiques ne suivent pas toutes l'enveloppe. Publier les limites et ajouter les dimensions utiles avant exploitation.
4. **Référentiel incomplet.** Le Master V2, déclaré source prioritaire par l'ordre de lancement, n'est pas fourni. Son absence est bien tracée, mais empêche de certifier la cohérence fonctionnelle exhaustive au-delà des contrats techniques disponibles.
5. **Candidat non figé par Git.** Tous les fichiers apparaissent non suivis et aucun commit candidat n'est disponible. Le hash agrégé ci-dessous permet cette revue, mais l'intégrateur doit figer un même état pour les gates aval.

## P3 — Améliorations

1. Déplacer le mapping RBAC transitoire actuellement dans ADR-004 vers ADR-007 afin de préserver une responsabilité par ADR.
2. Ajouter une table de traçabilité `story → contrat → runtime → test → preuve` dans le rapport Sprint 0; les affirmations DEV sont aujourd'hui plus larges que les tests de fondation.
3. Ajouter une validation OpenAPI sémantique dédiée à la CI, et pas seulement un parse YAML ponctuel.

## Points conformes observés

- L'architecture reste un monolithe CommonJS/JSON local; aucune migration de stack implicite ni dépendance runtime réseau n'a été introduite.
- Les packages de fondation sont courts, CommonJS, sans I/O métier et respectent globalement la direction de dépendances annoncée.
- Le catalogue d'événements est fermé; le journal possède identifiant, séquence, tenant, acteur, cible, payload et rejeu borné.
- Le package d'idempotence produit un digest stable et détecte replay/conflit lorsqu'il est effectivement utilisé.
- La migration RBAC sauvegarde l'état, vérifie son digest, est rejouable et installe exactement les sept rôles standards.
- La CI exécute lint, tests de fondation, suite complète et build sur Node 20.
- Le moteur de scheduling teste projet obligatoire, intervalles, capacité, week-end et DST; Pricing et QuoteConsumption ont des tests unitaires ciblés.

## Preuves fraîches

Environnement : macOS, Node `v26.6.0`, UTC `2026-08-19T14:12:49Z`.

| Commande exacte | Résultat |
|---|---|
| `npm run lint` | PASS |
| `npm run test:foundations` | PASS, 14/14 |
| `npm run build` | PASS |
| `npm test` (sandbox restreint) | Non concluant : 143 échecs `listen EPERM`, limitation d'environnement locale |
| `npm test` (relance autorisée hors restriction de bind local) | **PASS, 188/188, 0 échec, 0 skip, 0 todo**, 7,221 s |
| `ruby -e "require 'yaml'; ... YAML.safe_load(...)"` | PASS syntaxique : OpenAPI `3.1.0`, 16 chemins, 5 schémas |
| `rg` ciblés OpenAPI/runtime/RBAC/audit/événements | Confirment les divergences détaillées ci-dessus |

Hash SHA-256 agrégé du périmètre revu (liste triée : runtime, OpenAPI, ADR, packages, test de fondation, CI, SPEC et rapport) :

```text
62e017ace7b973f39dd270444ef90c47f2bda5195e8f5d5d951797c8ce5901cc
```

Hashes structurants :

```text
server.js                         cc3e6953aecc9b318639222c7277884bb1cb4c0c03a12c6930909f654d945d7d
app.js                            6223528dbe4ce60dab7790ac7930155d49fb20acded9012a56dd652b2393b440
docs/api/openapi-v1.yaml          8ae9568cd8d88b211bf25877d8b8f5a0b0bb3a3267af8b79be3c981c7ff25370
tests/foundations.test.js         de16792a190526b85f5417aa5facdbd5301d5392b389c4c7128e7bc5e44813c5
packages/auth/rbac.js             dec6ffad4e2f4248868f732c7a44ee48599c1613e5fa459a54b244c77611eb90
packages/shared/idempotency.js    0948b1175dabd3ac01a332ed4a495cdd412108c750d3cff0c64f24417e0b0ade
packages/audit/index.js           131d41b1118c6b054c284314165897fdd269ad4ad10357c367071eb01881c9c3
packages/events/index.js          9a4dfe0a24623f818ee3868202649a6506189fd0f89edb6999691324357b34b8
```

## Limites et condition de re-review

- La revue a analysé les sources V1 copiées dans `docs/specifications`, le prompt Sprint 0, les documents et le code; le Master V2 absent n'a pas été reconstitué.
- Le premier `npm test` rouge est exclusivement une restriction de bind du sandbox; la relance autorisée constitue la preuve fonctionnelle fraîche.
- Aucun E2E navigateur n'a été exécuté dans ce gate REVIEW; il relève du gate E2E, mais le test UI RBAC demandé reste à ajouter avant de considérer US-106 entièrement prouvée.
- Après corrections, revenir à DEV puis rejouer REVIEW et tous les gates aval sur le même hash candidat. La re-review doit vérifier au minimum un test OpenAPI→runtime, l'idempotence PATCH réservation, les scopes projet/entité, quatre audits réels et la matrice temps normative.

## Handoff intégrateur

Fichier modifié : `docs/code-review.md` uniquement.  
Statut à reporter par l'intégrateur dans `docs/project-status.md` : `G0 REVIEW = Bloqué / CHANGES REQUIRED`, cinq P1 ouverts.  
Aucune correction de code n'a été appliquée par le reviewer.

---

# Verdict final — revue de code Gate 01

Date : 2026-08-14  
Dernier périmètre contrôlé : câblage drag & drop multi-allocations  
Application et tests inspectés sans modification

## Verdict

**APPROVED**

Le dernier P1 est corrigé. Aucun défaut bloquant ne subsiste dans le périmètre des revues successives.

## Preuves du contrôle final

### Rendu multi-allocations

- `planning()` rend une réservation sur chaque ligne dont l'identifiant apparaît dans `b.allocations` (`app.js:39`).
- `event()` associe chaque occurrence à sa ressource de ligne avec `data-drag-resource` (`app.js:37`).

### Drop d'une allocation

- Le `dragstart` actif sérialise `{ bookingId, sourceResourceId }` dans `application/x-planify`, avec repli `text/plain` (`app.js:50`).
- Le `drop` actif décode ce payload et appelle `dropAllocation(bookingId, sourceResourceId, targetResourceId, date)` (`app.js:50`).
- `dropAllocation()` remplace l'allocation source, déduplique les ressources, conserve les quantités et resynchronise les champs de compatibilité (`app.js:45`).
- `mutate()` envoie ensuite la réservation par `PATCH`; `toApiReservation()` sérialise la nouvelle liste `allocations` dans `resources[]` avec la version optimiste (`app.js:21,44`). La modification est donc persistée côté API.

Le gestionnaire historique installé par `bindBase()` est bien remplacé ensuite par le gestionnaire spécialisé dans la redéfinition de `bind()`; il n'intercepte donc plus le drop final.

### Dashboard

- Les métriques serveur sont ventilées par type et les ressources les plus chargées sont rendues (`app.js:35`).
- Un clic applique le filtre ressource ou type, reprend la date de la période serveur et navigue vers le planning (`app.js:52`).
- Les filtres du planning tiennent compte de toutes les allocations (`app.js:36`).

## Vérifications finales

- `node --check app.js` : réussi.
- Inspection statique ciblée du chemin complet DOM → payload drag → allocation → `PATCH` API.
- Suite complète confirmée lors de la passe précédente : **32 tests réussis, 0 échec** (`npm test`), couvrant domaine, API, authentification, CSRF, permissions, isolation, conflits, override/audit, concurrence optimiste, annulation, fichiers sensibles et dashboard.

## Conclusion

Les cinq P1 de la revue finale ainsi que les deux reliquats frontend ont été fermés. Le code review Gate 01 rend donc le verdict **APPROVED**.

---

## Appendice — Gouvernance du dépôt

Date de contrôle : 2026-08-14  
Périmètre : `AGENTS.md`, `.gitignore` et initialisation Git  
Référence : prompt maître « Développement autonome multi-agents — Planning Post Prod »

### Verdict Gouvernance

**APPROVED**

### `AGENTS.md`

Le contrat de contribution traduit correctement le mandat maître et l'adapte à l'état réel du dépôt :

- hiérarchie explicite entre instructions PO, gouvernance, spécification et architecture ;
- état RC1 réel distingué de la cible TypeScript/React/SQLite, sans masquer la divergence JSON ;
- ownership par chemins couvrant produit, architecture, backend, frontend, persistance, tests, gates et release ;
- séparation auteur/reviewer et interdiction d'auto-approuver son développement ;
- workflow ordonné SPEC → DEV → REVIEW → QA → SECURITY/PERFORMANCE → INTEGRATION → E2E → RELEASE, avec retour au développement après échec ;
- responsabilités correspondant aux agents 00 à 13 du prompt maître, exprimées sous forme d'ownership et de gates opérationnels ;
- règles de non-interruption du PO cohérentes avec l'autonomie demandée et exceptions limitées aux décisions produit, actions irréversibles, données/droits manquants et risques critiques ;
- critères précis de revue, QA, sécurité, performance, intégration, E2E et release ;
- coordination multi-agents, writer unique par fichier, handoff reproductible et rôle exclusif de l'intégrateur ;
- mise à jour obligatoire de `docs/project-status.md` et invalidation d'un ancien `APPROVED` après modification ;
- commandes réellement disponibles dans `package.json`, sans inventer de scripts absents ;
- invariants métier, API, sécurité, autonomie locale et fallback prototype fail-closed conformes au dépôt actuel.

Aucune contradiction bloquante n'a été trouvée entre `AGENTS.md`, le prompt maître et l'état du projet. Le choix d'autoriser `data/planify.json` comme persistance RC1 tout en l'excluant de Git est cohérent : le serveur possède un seed déterministe et `data/.gitkeep` conserve le répertoire.

### `.gitignore`

Les exclusions couvrent les catégories pertinentes :

- métadonnées macOS : `.DS_Store` ;
- secrets locaux : `.env`, `.env.*` ;
- dépendances et sorties : `node_modules/`, `coverage/`, `dist/` ;
- données runtime : `data/*.json` ;
- journaux : `*.log` ;
- exception explicite `!data/.gitkeep`.

Contrôle avec `git check-ignore -v` : `.DS_Store`, `.env`, `node_modules/`, `coverage/`, `dist/` et `data/planify.json` sont bien ignorés; `data/.gitkeep` est réinclus. Les sources applicatives ne sont pas exclues.

### Initialisation Git

- `.git/` est présent et reconnu comme worktree Git ;
- la branche symbolique active est `main` ;
- le dépôt est neuf et ne possède encore aucun commit ; tous les fichiers versionnables apparaissent donc non suivis, ce qui est normal avant le commit initial ;
- `data/planify.json` et `.DS_Store` n'apparaissent pas dans les fichiers à versionner grâce au `.gitignore`.

L'exigence « dépôt Git initialisé sur `main` » est satisfaite. La création du commit initial relève de l'intégrateur/release manager et n'est pas requise pour valider l'initialisation elle-même.

### Conclusion Gouvernance

Le complément de mandat est conforme. Aucun changement de gouvernance, d'exclusion ou d'initialisation Git n'est requis avant handoff à l'intégrateur.

---

## Architecture cible / Specs 0.2 — Revue indépendante

Date : 2026-08-14  
Périmètre : `docs/target-architecture-v1.md`, `docs/architecture-roadmap.md`, `docs/spec-rental-stock.md`, `docs/spec-finance-analytics.md`, `AGENTS.md` et compatibilité avec la RC1  
Nature : Gate REVIEW documentaire ; aucune spec ni fichier applicatif modifié

### Verdict

**CHANGES REQUIRED**

L'architecture cible et la stratégie de migration sont cohérentes, incrémentales et compatibles avec la RC1. Les deux specs 0.2 couvrent correctement sécurité, isolation, concurrence, audit, performance, rollback et E2E. Cependant, quatre P1 rendent encore certains comportements métier non déterministes ou laissent le Gate SPEC explicitement ouvert. Le développement ne doit pas commencer avant leur fermeture.

### P0 — Critique

Aucun P0 identifié.

### P1 — Bloquants avant DEV

1. **État d'un dossier après sortie partielle contradictoire.** `docs/spec-rental-stock.md:168-174` conserve le dossier en `ready` lors d'une sortie partielle, alors que `docs/spec-rental-stock.md:176-180` indique qu'un dossier avec quantité sortie incomplètement retournée reste `out`. Les invariants d'édition/annulation dépendent aussi de cette distinction (`:150-152`). Il faut définir un état canonique après la première unité sortie — par exemple `out` dès toute sortie avec progression par ligne, ou un statut fermé `partiallyOut` — puis préciser les transitions retour, annulation, nouvelle sortie et modification. Sans cela, API, UI et tests peuvent implémenter des machines d'état incompatibles.

2. **Sémantique comptable du journal de stock insuffisante pour reconstruire les soldes.** Les mouvements `allocate`, `release`, `checkout`, `return`, `transfer`, maintenance, quarantaine et `adjustment` partagent un champ `quantity` toujours positif (`docs/spec-rental-stock.md:118-127`), tandis que le solde disponible doit être reconstruit exactement depuis le journal (`:129-133`, critère `:316`). Aucune table d'effets ne dit quels mouvements modifient le stock physique, le réservé et le disponible, dans quel sens, ni comment `fromLocationId`/`toLocationId` affectent chaque agrégat. En l'état, `allocate` puis `checkout` peut être compté deux fois et un `adjustment` positif ne peut exprimer une baisse. La spec doit définir les comptes/projections et l'effet signé de chaque type, y compris compensation et transfert.

3. **État `stale` d'un relevé financier non représenté par le modèle fermé.** Les statuts de relevé sont déclarés fermés à `draft`, `exported`, `archived` (`docs/spec-finance-analytics.md:123-133`), mais une modification source « marque [le draft] `stale` » (`:211-215`) et l'API prévoit `BILLING_DRAFT_STALE` (`:319-326`). `billingDrafts` ne définit ni statut `stale`, ni booléen/motif/versions sources permettant de le calculer (`:139-145`). Il faut choisir et contractualiser un quatrième statut ou un état de fraîcheur orthogonal, ses transitions, sa version et sa représentation API/UI avant d'implémenter recalcul et concurrence.

4. **Le Gate SPEC reste explicitement soumis à des décisions non consignées comme approuvées.** Location/Stock exige encore la validation PO du périmètre visible et des transitions (`docs/spec-rental-stock.md:379-383`). Finance exige la confirmation de six décisions produit/architecture, dont préfacturation, droits, modèle tarifaire, devise et réévaluation (`docs/spec-finance-analytics.md:476-487`). `docs/project-status.md` les marque « Spec terminée, review en cours », sans décision enregistrée ni owners techniques nommés. Conformément à `AGENTS.md` Gate SPEC, ces choix doivent être confirmés et inscrits dans le statut avant DEV ; une adoption du synoptique global ne vaut pas automatiquement validation de ces règles détaillées.

### P2 — Importants, non bloquants une fois planifiés

1. **Ordre des modules 06/07 divergent entre roadmap et spec.** `docs/architecture-roadmap.md:108-112` place Location (06) avant Stock/logistique (07), alors que `docs/spec-rental-stock.md` fait du catalogue, des exemplaires, emplacements et mouvements le socle préalable au workflow de location. La roadmap devrait expliciter soit un lot conjoint 06/07, soit la dépendance réelle « socle Stock → Location », afin d'éviter deux autorités ou modèles de disponibilité temporaires.

2. **Positionnement de Finance 0.2 par rapport à la phase 5 à clarifier.** La roadmap place le module 09 après 06 et 08 avec modèles de fiscalité (`docs/architecture-roadmap.md:108-114`), tandis que `docs/spec-finance-analytics.md` propose volontairement une tranche préfacturation sans fiscalité, location ni commercial. Cette tranche peut être légitime plus tôt, mais la roadmap doit l'identifier comme sous-lot 09a dépendant seulement de Planning/Projets/Tarifs, plutôt que laisser croire que l'ordre directeur est respecté tel quel.

3. **Statut opérationnel ambigu pour l'architecture historique.** `docs/project-status.md` indique simultanément « Architecture & contrats — Terminé » et « Architecture cible v1 — Review en cours ». Renommer la première ligne « Architecture RC1 » ou expliciter son périmètre éviterait qu'un lecteur considère la cible déjà approuvée.

### P3 — Améliorations

1. Ajouter aux deux specs une table compacte `commande → permission → version/idempotence → audit → événement` rendrait les contrôles de couverture plus mécaniques.
2. Ajouter un glossaire transversal des mots `allocation`, `réservation`, `dossier`, `mouvement`, `snapshot`, `projection` éviterait les collisions de sens entre Planning, Stock et Finance.
3. Référencer depuis chaque spec le numéro de module cible (06/07, 09/10) et la phase exacte de roadmap améliorerait la traçabilité.

### Points approuvés par la revue

- La cible est correctement décrite comme monolithe modulaire extractible, sans microservices, cache, bus, GraphQL, IA ou Kubernetes prématurés.
- La RC1 Node/CommonJS/JSON demeure explicitement l'autorité tant qu'un lot de migration n'est pas approuvé.
- La roadmap évite le big bang, conserve `/api/v1`, prévoit seams, strangler, expand/contract, sauvegarde, validation et rollback.
- La bascule JSON → SQLite interdit la conversion silencieuse et exige comparaison, restauration et arrêt contrôlé des écritures.
- Tenant et site viennent du contexte de session ; les erreurs hors périmètre restent non discriminantes.
- Audit, événement après commit, version optimiste, idempotence, pagination, limites et fonctionnement hors ligne sont traités.
- Les specs définissent des critères d'acceptation, jeux de charge, scénarios E2E, matrices de permissions et données de démonstration substantiels.
- Finance sépare correctement préfacturation interne et facture fiscale, utilise des entiers monétaires et la durée UTC réelle.
- Location/Stock sépare ressource planifiable et exemplaire physique, interdit le stock négatif et les overrides d'un état physique indisponible.

### Conditions pour APPROVED

1. Corriger les trois ambiguïtés métier P1 : sortie partielle, effets du journal de mouvements, représentation `stale` des relevés.
2. Consigner les validations Gate SPEC demandées par les deux documents et nommer les owners du contrat partagé, backend, frontend et tests.
3. Aligner la roadmap sur la dépendance réelle Stock/Location et positionner explicitement la tranche Finance 0.2.
4. Repasser cette revue documentaire sur les versions corrigées avant tout changement de code ou de données 0.2.

### Re-review ciblée P1/P2 — 2026-08-14

#### Verdict final SPEC 0.2

**CHANGES REQUIRED**

Les corrections fonctionnelles demandées sont satisfaisantes : machine de sortie/retour déterministe, grand livre reconstructible, `sourceState` financier orthogonal, ordre 07a → 06a → 07 avancé, tranche 09a/10a et autorités Planning/Finance/Analytics clarifiés. Deux reliquats d'ownership Matériel/Stock empêchent encore de fermer complètement le Gate SPEC.

#### Statut des constats précédents

| Constat | Statut | Preuve |
|---|---|---|
| Sortie partielle Rental | **CORRIGÉ** | Catalogue `partiallyOut`/`partiallyReturned`, `checkoutClosed`, diagramme fermé, préconditions de retour et commande `final` définis dans `docs/spec-rental-stock.md:111`, `:201-205`, `:219-255`. |
| Grand livre Stock | **CORRIGÉ** | Legs serveur signés, comptes fermés, formules physique/réservé/disponible, table d'effets, exemple chiffré, séquence/idempotence et invariants de non-négativité définis dans `docs/spec-rental-stock.md:118-185`. |
| État financier `stale` | **CORRIGÉ** | `sourceState=current|stale` est orthogonal à `status`, avec table de transitions, anomalies, modèle persistant et E2E explicite dans `docs/spec-finance-analytics.md:141-177`, `:478`. |
| Décisions Finance | **CORRIGÉ** | Huit décisions exécutables sont adoptées et les choix produit visibles sont fermés dans `docs/spec-finance-analytics.md:510-523`. |
| Owners Finance/Analytics | **CORRIGÉ** | Tableau d'ownership Finance 09a, hook Planning, Analytics 10a, Frontend, QA, Sécurité, Performance et Intégration dans `docs/spec-finance-analytics.md:32-46`. |
| Ordre roadmap 06/07 et 09a | **CORRIGÉ** | La roadmap impose 07a Stock → 06a Location → 07 avancé et positionne 09a/10a (`docs/architecture-roadmap.md:104-126`, carte `:164`). La cible reprend les mêmes dépendances (`docs/target-architecture-v1.md:73-101`). |
| Autorité runtime/migration | **CORRIGÉ** | La cible et la roadmap distinguent explicitement autorité RC1, SPEC de migration et bascule limitée au périmètre intégré (`docs/target-architecture-v1.md:12-18`, `docs/architecture-roadmap.md:12`). |

#### P1 ouverts

1. **Owners Matériel/Stock/Location non désignés.** La condition de sortie indique encore que « l'équipe technique désigne » les owners du contrat partagé, backend/persistance, frontend et tests (`docs/spec-rental-stock.md:457-459`), mais aucun tableau équivalent à Finance ne les nomme et `docs/project-status.md:26-27` conserve seulement des responsables produit génériques. Avant DEV, nommer au minimum les owners `stock_07a`, `rental_06a`, contrat Planning/disponibilité (avec revue Agent 04), frontend, QA, sécurité, performance et intégration, avec critères de handoff.

2. **Autorité de maintenance physique encore chevauchante.** `docs/spec-rental-stock.md:50` place la maintenance simple dans le lot **07a Stock socle** et `:13` donne au module matériel/stock l'autorité de l'état physique. Pourtant `docs/target-architecture-v1.md:69` attribue aussi la maintenance au module 02 Ressources et `:73` au module 06 Location, tandis que la description 07a (`:96`) ne la mentionne pas. Le catalogue cible doit distinguer clairement : maintenance structurelle/indisponibilité d'une ressource planifiable (02), maintenance d'un exemplaire physique (07a ou 06a, un seul writer), et orchestration de disponibilité, afin d'éviter trois modules capables de modifier le même état.

#### P2 ouverts

1. **Statut projet non encore synchronisé avec la re-review.** `docs/project-status.md:25-29` conserve « review en cours » et les anciennes lignes combinées Finance/Analytics. C'est attendu pendant la revue, mais l'intégrateur doit créer les lignes 07a, 06a, Finance 09a et Analytics 10a avec leurs owners et basculer les états uniquement après ce gate.

2. **Libellé de périmètre Rental à actualiser.** `docs/spec-rental-stock.md:17-33` présente kits, transferts et inventaire comme inclus dans le « premier incrément », alors que `:48-54` les place dans un troisième lot après 07a/06a. La séquence est désormais claire, mais renommer « premier incrément » en « programme 0.2 » ou marquer l'inclusion par lot réduirait le risque de livrer trop tôt les routes/UI du lot 3.

#### Conditions restantes pour APPROVED

1. Ajouter le tableau d'ownership/handoff Matériel 07a/Location 06a et synchroniser `docs/project-status.md`.
2. Désigner une autorité unique pour la maintenance d'un exemplaire physique et corriger le catalogue cible/roadmap en conséquence.
3. Rejouer une ultime revue documentaire limitée à ces deux corrections ; aucun autre P0/P1 métier n'est ouvert.

### Re-review finale Rental — 2026-08-14

#### Verdict final SPEC 0.2

**APPROVED**

Aucun P0/P1 ne reste ouvert sur le périmètre documentaire SPEC 0.2. Les derniers constats Rental/Stock sont corrigés de manière cohérente avec la cible et la roadmap ; le développement peut commencer lot par lot sous réserve de repasser tous les gates prévus par `AGENTS.md`.

#### Statut des derniers constats

| Constat | Statut | Preuve |
|---|---|---|
| Owners et handoffs 07a/06a | **CORRIGÉ** | La matrice nomme les owners du contrat partagé, de Stock 07a, Location 06a, Frontend, REVIEW, QA, Performance, Sécurité et Intégration, avec un critère de remise pour chacun (`docs/spec-rental-stock.md:65-77`). L'ordre de writer unique dans `server.js` et le contenu obligatoire de chaque handoff sont explicités (`:79`). |
| Autorité de maintenance physique | **CORRIGÉ** | 07a est l'unique writer de l'état/localisation d'un exemplaire, de `maintenanceRecord`, des legs physiques et des projections (`docs/spec-rental-stock.md:218-220`). Les responsabilités distinctes de 02 Ressources, 03 Planning, 06a Location et 07 avancé sont fermées (`:222-225`) ; les ports autorisés, leurs consommateurs et effets faisant autorité sont publiés (`:227-240`). La roadmap confirme que 07a reste l'unique autorité physique et que 06a ne tient aucun inventaire parallèle (`docs/architecture-roadmap.md:111-113`). |
| Périmètre du lot 3 | **CORRIGÉ** | Kits, transferts métier, inventaires et scan sont explicitement hors du premier incrément 07a/06a (`docs/spec-rental-stock.md:33-42`). Les trois lots et leur ordre contractuel sont séparés (`:57-63`) ; routes (`:377-388`), critères (`:481-487`), E2E (`:503`) et seed (`:507`) du lot 07 avancé sont différés jusqu'à son propre workflow de gates. |

#### Points non bloquants et limites

- `docs/project-status.md` doit être synchronisé par l'owner Intégration après ce verdict, conformément au handoff défini dans la spec. Cette opération administrative aval ne remet pas en cause la fermeture du Gate REVIEW documentaire.
- Les libellés synthétiques « maintenance » des modules 02 et 06 dans `docs/target-architecture-v1.md` restent larges, mais la section d'autorité normative de la spec tranche explicitement leur sens et interdit tout writer physique concurrent. Une référence croisée dans le catalogue cible serait une amélioration P3, pas un défaut bloquant.
- Revue strictement documentaire : aucun fichier applicatif, test, donnée ou spécification n'a été modifié et aucun verdict DEV/QA/SECURITY/PERFORMANCE n'est conféré par cette approbation SPEC.

---

## Gate CODE REVIEW — Stock 07a

Date : 2026-08-14  
Périmètre : `server.js`, consommateurs/tests existants, `AGENTS.md`, `docs/spec-rental-stock.md` et contrats d'architecture  
Nature : revue indépendante du lot backend Stock 07a ; aucun code ni test modifié

### Verdict

**CHANGES REQUIRED**

Aucun P0 n'est identifié, mais cinq P1 restent ouverts. Le seed en mémoire produit un journal cohérent et les mutations utilisent correctement la chaîne d'écriture puis le renommage atomique avant émission SSE. En revanche, l'isolation site, l'intégrité canonique du ledger, la reprise des données RC1 et plusieurs contrats fonctionnels 07a ne sont pas respectés sur l'état courant.

### P0 — Critique

Aucun P0 identifié.

### P1 — Bloquants release

1. **Une demande sans site/emplacement traverse le périmètre de sites autorisés.** Le chemin quantité de `checkStockAvailability` reconstruit tous les mouvements de la société lorsque la ligne omet `siteId` et `locationId`, sans filtrer les emplacements par `siteAllowed` (`server.js:280-299`). `allocateStock` accepte ensuite cette ligne, crée un leg `reserved` sans emplacement et ne rattache pas la commande à un dossier 06a existant (`:303-309`). Preuve reproductible : avec un planificateur limité à `site_paris`, la demande de `stock_battery` — présent uniquement à Boulogne — annonce `available: 8`, puis crée une allocation pour `orderId: "forged-order"`. Le mouvement sans `locationId/siteId` est en outre diffusé par SSE à toute la société. Cela viole l'isolation par référence et par ligne (`docs/spec-rental-stock.md:244`, `:417`). Exiger un site/emplacement autorisé pour une quantité, borner tous les agrégats aux sites de la session et ne permettre l'allocation que via un contexte 06a canonique.

2. **Le ledger accepte des effets non canoniques choisis par le client.** `adjustStock` reprend directement `input.account` et génère un `adjustment` sur n'importe quel compte (`server.js:318-324`), tandis que `validateStockLedger` contrôle surtout l'équilibre global sans table stricte `type → legs/champs` (`:242-260`). Preuve reproductible : un ajustement `{ account: "custody", delta: 2 }` sans `rentalOrderId` est accepté et `validateStockLedger` retourne `{ valid: true }`, créant de la garde externe et augmentant `ownedPhysical` sans sortie. La spec limite pourtant `adjustment` à un leg physique signé et impose les effets fermés (`docs/spec-rental-stock.md:171-188`). Valider les legs canoniques par type dans l'autorité serveur et ne jamais accepter le compte depuis le client.

3. **La conversion additive RC1 n'existe pas et le dépôt démarre sans données Stock.** `ensureStockCollections` ajoute silencieusement des tableaux vides mais ne change pas `schemaVersion`, ne sauvegarde pas le fichier précédent et n'hydrate pas le seed 07a (`server.js:130-146`). Le fichier réel `data/planify.json` est encore en `schemaVersion: 1`; `readDb()` retourne actuellement `0` article, `0` emplacement, `0` exemplaire et `0` mouvement, alors que `makeSeed()` construit un schéma 2. Cela contredit la sauvegarde avant première conversion, la conversion additive et le seed déterministe (`docs/spec-rental-stock.md:507`, `:511-514`). Implémenter une migration explicite, sauvegardée, idempotente et testée, ou livrer un fichier schema 2 compatible avec une procédure de rollback démontrée ; ne pas masquer une donnée ancienne par une hydratation vide.

4. **Le parcours obligatoire quarantaine → maintenance est refusé.** `openAssetMaintenance` exige `asset.status === "available"` et ne sait débiter que `onHandAvailable` (`server.js:325-329`). Un exemplaire retourné `damaged`, donc placé en `quarantine`, reçoit ainsi `409 ASSET_UNAVAILABLE` au lieu d'entrer en maintenance. Le scénario E2E 07a exige explicitement « retour endommagé → quarantaine → ouverture puis clôture de maintenance » (`docs/spec-rental-stock.md:496`) et les effets canoniques autorisent `quarantineOut` vers maintenance (`:184-185`). Ajouter une transition atomique et canonique depuis la quarantaine, avec projection, audit, versions et événements cohérents.

5. **Aucun test automatisé ne couvre le nouveau lot Stock.** `tests/api.test.js` et `tests/domain.test.js` ne contiennent aucun cas Stock, équipement, ledger, idempotence ou maintenance. La suite fraîche est verte (`npm test` hors sandbox : **34/34**), mais elle n'exécute aucun des critères ajoutés aux lignes `441-471` de la spec et n'aurait détecté aucun des quatre défauts ci-dessus. Conformément au Gate DEV d'`AGENTS.md`, ajouter au minimum les tests domaine du ledger et des fenêtres, puis les tests API RBAC/isolation société-site, version, idempotence, atomicité/rollback, migration legacy, audit et SSE avant re-review.

### P2 — Importants

1. **Des routes de commandes internes/hors lot sont publiquement exposées.** `/api/v1/stock/allocations` et `/api/v1/stock/releases` ne figurent pas dans l'API publique du premier incrément (`docs/spec-rental-stock.md:339-375`) et contournent actuellement l'orchestration 06a. `/api/v1/stock/adjustments` active `stock.adjust` alors que la matrice dit explicitement que l'ajustement d'inventaire reste inactif avant le lot 07 avancé (`:414`). Retirer ces routes du routeur 07a ou publier/valider formellement un contrat API cohérent avec le lot et son autorité ; l'ajustement doit rester désactivé.

2. **Le lien optionnel ressource planifiable ↔ exemplaire n'est pas implémenté.** `equipmentAsset.resourceId` n'est ni persisté/validé dans `createEquipmentAsset`/`patchEquipmentAsset` (`server.js:337-338`), ni consulté par la disponibilité Stock ou les conflits Planning. Le critère d'une réservation Planning active bloquant l'exemplaire lié (`docs/spec-rental-stock.md:333-337`, `:462`) reste donc non couvert. Si ce lien est bien dans 07a, l'implémenter avec unicité, société/site et contrôle bidirectionnel ; sinon obtenir une décision SPEC explicite de report.

3. **Les audits et invalidations sont incomplets pour certaines projections.** Plusieurs audits article/emplacement/maintenance omettent `siteId`, `correlationId` ou versions avant/après alors que l'enveloppe est contractuelle (`docs/spec-rental-stock.md:421-425`). `allocateStock` et `releaseStock` changent aussi `equipmentAsset.status/version` mais leurs routes n'émettent que `stockMovement.created.v1` (`server.js:369-370`), laissant un consommateur de la collection équipements potentiellement obsolète. Compléter les détails d'audit et émettre `equipmentAsset.updated.v1` pour chaque projection réellement modifiée après commit.

4. **Les lectures critiques multiplient les balayages complets.** Disponibilité sérialisée parcourt les mouvements pour chaque exemplaire et chaque ligne ; disponibilité quantité et reconstruction recherchent aussi les emplacements par scans imbriqués (`server.js:229-299`). Avec 50 lignes, 2 000 exemplaires et 10 000 mouvements, ce schéma peut devenir quadratique. Indexer en mémoire par société/article/exemplaire/emplacement pendant une requête et faire mesurer le p95 par le gate Performance avant approbation release.

### P3 — Améliorations

1. Canonicaliser récursivement le payload d'idempotence avant hash : `JSON.stringify(payload)` rend deux objets sémantiquement identiques mais ordonnés différemment conflictuels (`server.js:262-267`).
2. Borner ou purger `stockIdempotency` selon une politique documentée afin d'éviter une croissance indéfinie du fichier JSON.
3. Décomposer les fonctions monolignes du domaine Stock et le dispatch des routes pour rendre les préconditions et la revue de sécurité mécaniques.

### Points conformes vérifiés

- `makeSeed()` produit 20 mouvements à séquence unique et `validateStockLedger` les valide ; les soldes initiaux quantité sont reconstructibles depuis les legs.
- Les intervalles Stock utilisent bien le chevauchement semi-ouvert.
- Les mutations passent par `mutate`, qui sérialise les écritures et remplace le JSON par renommage ; une exception avant `atomicWrite` n'altère pas le fichier persistant.
- Les événements SSE des mutations existantes sont déclenchés dans les continuations de `mutate`, donc après persistance réussie, et les replays idempotents n'émettent pas de second événement.
- Les routes kits, transferts métier et inventaires du lot 07 avancé ne sont pas enregistrées.
- Le contrôle de syntaxe `node --check server.js` réussit. `npm test` échoue uniquement dans le sandbox (`listen EPERM`) puis réussit hors sandbox avec **34 tests sur 34** ; cette réussite ne couvre pas Stock 07a.

### Conditions de re-review

1. Fermer les P1 isolation site, effets canoniques du ledger, migration/hydratation RC1 et transition quarantaine → maintenance.
2. Ajouter les tests domaine/API négatifs et de non-régression Stock 07a, puis exécuter `node --check server.js` et `npm test` sur le même état.
3. Retirer/désactiver les routes hors contrat ou publier leur autorité exacte, puis revalider RBAC, audit, SSE et consommateurs Planning/06a.
4. Faire mettre à jour `docs/project-status.md` par l'intégrateur après ce verdict ; la présente tâche est explicitement limitée à `docs/code-review.md`.

### Re-review ciblée des P1 applicatifs Stock 07a — 2026-08-14

#### Verdict sur le code applicatif

**APPROVED — conditionné à la preuve QA Stock 07a**

Aucun P0/P1 **de code** ne reste ouvert parmi les cinq constats ciblés. Cette approbation couvre les corrections de `server.js`; elle ne vaut pas approbation du gate QA. Les tests Stock dédiés restent obligatoires avant intégration/release et doivent être revus sur le même état candidat.

#### Statut des cinq P1

| P1 précédent | Statut code | Preuve de re-review |
|---|---|---|
| Isolation site et source forgée | **CORRIGÉ** | Un article en quantité exige maintenant un `locationId` résolu par `stockLocationFor`; site et emplacement doivent correspondre (`server.js:312-329`). `allocateStock` exige une réservation active de la même société et d'un site autorisé, reprend exactement sa période et impose le même site aux exemplaires/emplacements (`:335-344`). Reproduction négative : un planner Paris obtient `422` sans emplacement, `404` avec l'emplacement Boulogne et `404` pour `forged-order`. |
| Ledger non canonique | **CORRIGÉ** | `validateMovementShape` impose une forme fermée à chaque type (`server.js:254-270`) et `validateStockLedger` vérifie en plus emplacements, source réservation pour `reserved/custody`, séquences, non-négativité et position physique unique (`:271-291`). Un `adjustment` ne peut plus cibler `custody`; l'ancien payload reçoit `403` sans le marqueur interne. |
| Migration/backup RC1 | **CORRIGÉ dans le code** | `migrateLegacyDb` refuse les versions antérieures inconnues, crée une sauvegarde immuable nommée par digest avant l'écriture, ajoute les collections et la trace de migration, puis remplace atomiquement le fichier en schema 2 (`server.js:141-155`). Essai sur copie temporaire du fichier RC1 : schema final `2`, une migration `schema-v1-to-v2`, une sauvegarde unique strictement identique aux octets source. |
| Quarantaine → maintenance | **CORRIGÉ** | `openAssetMaintenance` accepte `available` ou `quarantine`, refuse une maintenance ouverte concurrente et choisit le compte source correspondant avant le leg `onHandMaintenance +1` (`server.js:362-364`). Essai sur `asset_lens_2` : transition vers `maintenance`, legs `onHandQuarantine -1 / onHandMaintenance +1`, ledger toujours valide à 21 mouvements. |
| Tests Stock absents | **À COUVRIR PAR QA — pas de P1 code requalifié** | La suite actuelle passe à **34/34**, mais ne contient toujours aucun test Stock. L'approbation du code est donc conditionnelle à des tests dédiés couvrant précisément migration/backup, isolation société/site, formes du ledger, idempotence, atomicité, maintenance quarantaine, RBAC, audit et SSE. Un échec ou une couverture manquante significative renverra le lot en DEV puis REVIEW. |

#### Route d'ajustement et frontières

- **Correction confirmée :** `/api/v1/stock/adjustments` n'est plus enregistrée. `adjustStock` exige `options.internal === true`, limite l'opération aux articles en quantité et aux comptes physiques autorisés, et refuse exemplaire/compte arbitraire (`server.js:355-360`).
- **P2 restant :** `stock.adjust` demeure annoncé dans les permissions de l'administrateur alors que la capacité doit rester inactive avant le lot 07 avancé (`server.js:39`). Retirer cette permission de `publicUser` jusqu'à l'ouverture du lot évitera d'annoncer une capacité indisponible.
- **P2 restant :** les routes publiques `/api/v1/stock/allocations` et `/api/v1/stock/releases` restent absentes du catalogue API de la spec. Leur implémentation est désormais bornée à une réservation canonique et ne présente plus le P1 d'autorité précédent, mais leur exposition doit être confirmée comme port technique 07a ou déplacée derrière l'orchestration 06a.

#### Limites non bloquantes de cette approbation code

1. La migration préserve correctement une base RC1 en ajoutant des collections vides. Le fichier de démonstration suivi est encore schema 1 : après migration il ne contient donc aucune donnée Stock. L'intégrateur/QA doit livrer ou générer séparément le seed 07a déterministe annoncé par la spec, sans injecter de données de démonstration dans une base utilisateur legacy.
2. `migrateLegacyDb` accepte actuellement toute version `>= 2`; une version future inconnue devrait être refusée plutôt que réécrite par un runtime plus ancien. Classement **P2** de durcissement migration.
3. Les anciens P2 sur le lien optionnel Planning ↔ exemplaire et sur les balayages de performance restent à arbitrer/mesurer par leurs gates propriétaires ; cette re-review ciblée ne les transforme pas en approbation.
4. `node --check server.js` réussit. `npm test` hors sandbox réussit avec **34 tests sur 34**, mais cette suite ne constitue pas la preuve QA Stock demandée.

#### Condition de fermeture complète du gate

Le code applicatif peut être remis à QA. Le gate CODE REVIEW Stock 07a devient pleinement `APPROVED` lorsque les tests Stock dédiés sont présents, verts, relus et qu'aucune correction issue de QA ne modifie l'état ici approuvé. `docs/project-status.md` reste à synchroniser par l'intégrateur après cette preuve.

---

## Gate CODE REVIEW — Frontend Stock 07a

Date : 2026-08-14  
Périmètre : `app.js`, `index.html`, `planning.css`, contrats réels de `server.js`, `docs/ux-rental-stock.md` et `docs/spec-rental-stock.md`  
Nature : revue indépendante frontend ; aucun code ni test modifié

### Verdict

**CHANGES REQUIRED**

Aucun P0 n'est identifié. Six P1 empêchent cependant de considérer les parcours Stock utilisables et accessibles : contrat temporel d'allocation incorrect, sélections fondées sur des identifiants opaques, filtres/onglets instables, réactivation silencieuse d'articles, gestion SSE/concurrence incomplète et navigation/dialogue inaccessibles sur clavier/mobile.

### P0 — Critique

Aucun P0 identifié.

### P1 — Bloquants release

1. **Le DTO d'allocation reconstruit une fenêtre différente de la réservation canonique.** `fromApiReservation` découpe directement les heures UTC de `startsAt/endsAt` (`app.js:29`), puis `allocateFromReservation` les renvoie avec l'offset fixe `+02:00` (`:71`). Ainsi `2026-08-17T07:00:00.000Z` devient `2026-08-17T07:00:00+02:00`, soit `05:00Z`; le serveur exige au contraire l'égalité exacte avec la réservation et répond `422` (`server.js:335-340`). Conserver les instants canoniques du DTO ou effectuer une conversion de fuseau explicite, puis envoyer ces valeurs inchangées à Stock. Cette correction doit aussi éviter l'offset fixe lors des changements heure d'été/hiver.

2. **Affecter/libérer dépend d'identifiants que l'interface ne rend pas disponibles.** Les prompts demandent `stockItemId`, `equipmentAssetId` et `allocationId` (`app.js:71-72`), tandis que les tables montrent nom/SKU/numéro de série mais jamais ces identifiants ni les legs/allocation IDs (`:64-67`). Hors inspection réseau, un utilisateur ne peut donc pas affecter un exemplaire précis ni libérer une allocation. Remplacer les prompts par des sélecteurs bornés aux données autorisées, afficher la réservation/période/site en lecture seule et exposer les allocations actives comme actions contextuelles conformément au flow de préparation (`docs/ux-rental-stock.md:217-259`).

3. **La recherche perd le focus après le premier caractère et les onglets partagent un état incompatible.** Tous les champs `data-stock-filter`, y compris la recherche, déclenchent `render()` sur `input`, ce qui remplace immédiatement le nœud focalisé (`app.js:74`) ; la saisie continue et la position de curseur ne sont pas restaurées. En parallèle, un unique `stock.tab` porte successivement `assets/items` et `balances/movements` (`:15`, `:64-67`) : passer de `Articles` à Stock affiche les soldes sans onglet actif, et passer de `Mouvements` à Parc affiche les articles sans onglet actif. Séparer les états par vue et préserver focus/sélection lors des rerenders ; ajouter les scénarios navigation arrière/avant et saisie multi-caractères.

4. **Enregistrer un article désactivé le réactive silencieusement.** `submitStockDrawer` force toujours `{ unit: "piece", active: true }` pour un article, création comme édition (`app.js:70`). Une simple modification de nom/notes remet donc `active` à vrai sans choix ni confirmation, contrairement à l'annulation logique et au flow explicite de désactivation (`docs/ux-rental-stock.md:145-156`). Ne fournir `active: true` qu'à la création ; en édition préserver la valeur canonique et exposer une commande de désactivation/réactivation explicite, versionnée et confirmée. Les emplacements n'ont également aucun écran permettant leur modification/désactivation malgré le contrat PATCH.

5. **Les invalidations SSE et conflits optimistes ne préservent pas le contexte d'édition.** Deux `EventSource` sont ouverts sur le même endpoint (`app.js:33`, `:36`) : le listener générique lance une hydratation complète pour chaque événement Stock pendant que le listener Stock relit déjà les collections ciblées. Le second appelle ensuite `render()`, ce qui vole le focus dans les filtres/tables. Si un drawer est ouvert, les tableaux sont remplacés mais `activeStockEditor` conserve l'ancien objet sans bannière ; après `VERSION_CONFLICT`, `loadStockData()` recharge les listes sans mettre à jour l'objet/version du formulaire, de sorte qu'un nouvel envoi répète la même version obsolète (`:70`). Unifier le flux SSE, conserver focus/scroll, signaler la version récente sans écraser les champs et obliger une reprise explicite du formulaire (`docs/ux-rental-stock.md:33`, `:344-346`, `:509`).

6. **Le frontend Stock n'est pas utilisable au clavier/modal ni atteignable sur mobile.** Le drawer déclaré `aria-modal="true"` (`index.html:69-73`) place le focus initial et le restitue à la fermeture, mais n'isole pas l'arrière-plan, ne piège pas Tab, et Échap ferme même un formulaire modifié sans confirmation (`app.js:69`, `:76`). Sous `900px`, la sidebar est déplacée hors écran, mais `menuButton` n'a aucun gestionnaire dans `app.js`; les destinations Stock deviennent donc inaccessibles par la navigation mobile. Implémenter piège de focus/inert, gestion des changements non sauvegardés, première erreur focalisée et ouverture/fermeture de la sidebar responsive ; vérifier au clavier et lecteur d'écran.

### P2 — Importants

1. **L'idempotence UI ne survit pas à une réponse perdue.** Chaque tentative d'allocation/release génère une nouvelle clé avec `uid(...)` (`app.js:71-72`). Après commit serveur suivi d'une coupure réseau, le retry utilisateur n'est pas un replay et peut créer une seconde allocation si le stock le permet. Conserver une clé par intention jusqu'à réception/résolution canonique ; la même règle vaut pour les formulaires créateurs de mouvement.

2. **Le filtre Site est visuellement trompeur sur le journal.** `stockPage` filtre les soldes par site, mais `movements` uniquement par recherche (`app.js:66`) ; choisir Paris continue donc d'afficher les mouvements des autres sites autorisés. Envoyer `siteId` à l'API ou filtrer via les legs/emplacements connus et annoncer clairement le périmètre.

3. **Les permissions de navigation sont agrégées au lieu d'être appliquées par destination.** Quand une seule permission de lecture Stock est disponible, les trois liens sont affichés puis certaines pages répondent localement « Accès refusé » (`app.js:18`). Cacher chaque destination selon sa permission précise et refléter l'identité/role réel plutôt que le bloc utilisateur statique « Fernando — Administrateur » (`index.html:32`).

4. **Chargements partiels et pagination ne sont pas gérés.** `loadStockData` agrège six requêtes dans un seul état d'erreur et `listItems` ignore toute page au-delà des 100 premiers résultats (`app.js:28`, `:35`). Une erreur Maintenance masque donc aussi Parc/Stock, et un parc supérieur à 100 entités est tronqué silencieusement. Distinguer les états par collection et implémenter la pagination serveur.

5. **Le niveau de détail reste inférieur au contrat UX.** Le journal ne montre ni origine/destination, dossier, acteur, corrélation ni legs ; le solde n'annonce aucune fenêtre de disponibilité ; la maintenance ne permet pas de choisir/afficher l'emplacement final ; recherche Maintenance et filtre site des articles sont incomplets (`app.js:64-69`). Ces écarts ne créent pas seuls de corruption, mais doivent être planifiés avant validation produit.

6. **Les contrôles de focus visibles ne suivent pas le design system.** Aucun style global `:focus-visible` n'établit le focus 2px avec offset attendu ; la visibilité dépend du navigateur. Ajouter un style commun AA et vérifier les boutons/icônes, liens de navigation, tabs, tables scrollables et champs du drawer.

### P3 — Améliorations

1. Remplacer les fonctions monolignes et les surcharges runtime `render/openStockDrawer/bind` (`app.js:17-20`, `:73`) par des modules ou fonctions nommées afin de réduire le risque d'écrasement involontaire des features RC1.
2. Persister les filtres/onglets dans l'URL et restaurer scroll/sélection, conformément aux URLs cibles de l'UX.
3. Afficher des libellés métier français pour les types de mouvement au lieu des valeurs techniques (`maintenanceIn`, `quarantineOut`, etc.).

### Points conformes vérifiés

- Les routes CRUD article/exemplaire/emplacement et maintenance utilisées par les drawers correspondent aux routes et DTO actuels de `server.js`; les mutations portent `version`, CSRF via `api()` et une `Idempotency-Key` lorsqu'elle est fournie.
- Les actions de création sont masquées selon `equipment.manage`, celles de maintenance selon `maintenance.manage`, et les affectations selon `stock.move`; un lecteur ouvre les drawers en lecture seule.
- Les données métier interpolées dans le HTML passent généralement par `esc()` ou `textContent`; aucun XSS exploitable n'a été identifié sur les DTO validés par le serveur. Les erreurs sont rendues par `textContent`.
- Statut et condition sont affichés avec texte en plus de la couleur. La table est scrollable horizontalement, le drawer devient pleine largeur sous 700px et `prefers-reduced-motion` supprime son animation.
- Aucun écran ou appel pour kits, transferts métier, inventaires, impression QR ou caméra n'a été ajouté.
- Le frontend ne bascule pas silencieusement en prototype après une erreur API/auth : ce mode reste limité au protocole fichier ou au paramètre explicite déjà prévu.
- `node --check app.js` réussit. `npm test` hors sandbox passe **47/47**, dont les tests backend Stock récemment ajoutés, mais aucune assertion n'exerce les nouveaux parcours DOM/frontend.

### Tests frontend manquants

1. Allocation depuis une réservation canonique : UTC/offset/DST, site, article quantité, exemplaires sérialisés et même fenêtre envoyée au serveur.
2. Sélection métier sans identifiants opaques, release depuis une allocation visible et retry avec la même clé idempotente.
3. Saisie de recherche multi-caractères, onglets indépendants, navigation hash/arrière, filtres site et pagination.
4. Édition d'une entité inactive sans réactivation, version obsolète avec reprise, SSE pendant formulaire sale et absence de double abonnement.
5. Matrice admin/planner/viewer sur liens, boutons, drawers readonly et appels directs refusés.
6. Clavier complet : ouverture, ordre Tab, focus trap, Échap avec/sans changement, retour du focus, erreur focalisée et annonce live.
7. Responsive à 390/700/900px : ouverture sidebar, accès aux trois destinations, drawer, tables et cibles tactiles.
8. Fixtures XSS dans noms/SKU/série/motif/erreur, avec vérification qu'aucun HTML/attribut n'est exécuté.

### Limite de preuve visuelle

Le serveur local a démarré correctement sur une base temporaire puis a été arrêté sans artefact restant. Aucun navigateur contrôlable n'était disponible dans cette session ; les constats d'interaction/responsive reposent donc sur l'analyse exécutable du DOM, des handlers et des media queries et doivent être confirmés par QA/E2E dans un navigateur réel.

### Conditions de re-review

1. Corriger les six P1 et ajouter des tests frontend ciblés couvrant leurs régressions.
2. Rejouer `node --check app.js`, `npm test`, puis les parcours navigateur admin/planner/viewer aux largeurs desktop et mobile.
3. Revalider spécialement la coexistence Planning/Stock, le nombre de connexions SSE, la conservation du focus et les DTO exacts capturés côté serveur.
4. Faire synchroniser `docs/project-status.md` par l'intégrateur après verdict ; cette tâche reste limitée au rapport de revue.

### Re-review ciblée des six P1 frontend — 2026-08-14

#### Verdict final Frontend Stock 07a

**APPROVED**

Aucun P0/P1 ne reste ouvert dans le périmètre frontend Stock 07a revu. Les six corrections sont présentes sur l'état courant et leurs contrats correspondent au backend réellement livré. Cette approbation REVIEW ne remplace pas les parcours QA/E2E dans un navigateur réel.

#### Statut des six P1

| P1 précédent | Statut | Preuve de re-review |
|---|---|---|
| Fenêtre temporelle d'allocation altérée | **CORRIGÉ** | `fromApiReservation()` conserve désormais `startsAt` et `endsAt` canoniques, et `submitAllocationDrawer()` les transmet sans reconstruction ni offset fixe dans `window` (`app.js:30`, `:74`). Le DTO correspond à la comparaison canonique imposée par `allocateStock` (`server.js:335-340`). |
| Identifiants opaques pour affecter/libérer | **CORRIGÉ** | Le drawer expose des sélecteurs libellés pour réservation, article, emplacement et exemplaires sérialisés ; la libération propose les allocations actives reconstruites depuis le journal, avec réservation/article/exemplaire visibles (`app.js:72-74`). La sélection est fonctionnelle : `FormData.getAll('assetIds')` alimente `equipmentAssetIds` et `assetVersions`, tandis que la quantité et l'emplacement choisis alimentent la ligne envoyée. |
| Recherche et onglets instables | **CORRIGÉ** | Les états d'onglet sont séparés en `equipmentTab` et `stockTab` (`app.js:15-16`). La recherche remplace le rerender par un filtrage différé des lignes, ce qui conserve le champ et le focus pendant une saisie multi-caractères (`:79`). |
| Réactivation silencieuse et emplacement non éditable | **CORRIGÉ** | L'état actif de l'article est un contrôle explicite initialisé depuis l'entité et envoyé tel quel (`app.js:21`, `:71`). Le gestionnaire d'emplacements ouvre un formulaire d'édition et envoie un `PATCH` versionné (`:21`, `:71`, `:79`). Le backend possède réellement `patchStockLocation()` avec version, unicité, interdiction de désactiver un emplacement non vide, audit et SSE (`server.js:374`), ainsi que la route `PATCH /api/v1/stock/locations/:id` sous permission `equipment.manage` (`:391-401`). |
| Double SSE et reprise de conflit | **CORRIGÉ** | Stock ajoute son listener à l'unique `eventStream` au lieu d'ouvrir un second `EventSource`; la session ferme et réinitialise ce flux (`app.js:27`, `:34`, `:37`). Un drawer ouvert n'est plus rerendu par l'invalidation ; une entité concurrente ou un `409` propose un rechargement explicite avant réédition (`:37`, `:71`). |
| Dialogue clavier et navigation mobile | **CORRIGÉ** | Le drawer piège Tab, gère Échap avec confirmation si le formulaire est sale et restitue le focus à l'élément déclencheur (`app.js:81`). Le bouton mobile ouvre/ferme la sidebar et maintient `aria-expanded`; un clic de navigation la referme (`:81`). Les contrôles Stock ont un focus visible renforcé et le drawer reste pleine largeur sous 700 px (`planning.css:3-4`). |

#### Points P2 restant ouverts

1. **Les choix d'allocation ne sont pas encore filtrés en cascade.** Le drawer permet une sélection valide et le serveur refuse toute incohérence, mais il affiche simultanément tous les emplacements actifs et tous les exemplaires disponibles autorisés, sans les réduire au site de la réservation, à l'article et à l'emplacement sélectionnés (`app.js:73-74`). Filtrer dynamiquement ces options améliorerait le feedback et éviterait des réponses `SITE_MISMATCH`/`NOT_FOUND` prévisibles.
2. **La libération dépend de la page de mouvements chargée.** `activeAllocationChoices()` reconstruit les soldes depuis `stock.movements`, alors que `listItems()` ne charge que la première page serveur (`app.js:29`, `:36`, `:72`). Au-delà de 100 mouvements, une allocation ancienne peut disparaître ou être reconstruite incomplètement. Un endpoint d'allocations actives ou une pagination exhaustive est requis avant montée en volume.
3. **Accessibilité perfectible hors blocage.** Le focus est piégé et `aria-modal` est présent, mais l'arrière-plan n'est pas marqué `inert` et une erreur de soumission est annoncée par `role="alert"` sans déplacement explicite du focus. À confirmer et durcir lors du gate E2E accessibilité.
4. Les P2 de la revue initiale concernant permissions de navigation par destination, identité statique, pagination générale et niveau de détail UX restent hors de cette correction ciblée.

#### Vérifications fraîches

- `node --check app.js` : réussi.
- `node --check server.js` : réussi.
- `npm test` hors sandbox le 2026-08-14, Node.js compatible avec le contrat `>=20` : **47 tests réussis, 0 échec**, durée environ 2,9 s.
- La première exécution dans la sandbox a échoué sur les seuls appels `listen` avec `EPERM`; la même suite exécutée avec ouverture de ports locaux autorisée est entièrement verte.
- Inspection statique du chemin UI complet : sélection visible → `FormData` → DTO canonique → routes allocation/release, et formulaire emplacement → `PATCH` serveur réel.

#### Tests frontend encore manquants

1. Test DOM du drawer d'allocation quantité et sérialisée, incluant changement de réservation/article/emplacement, versions d'exemplaires et payload exact.
2. Test de libération avec plusieurs allocations, pagination de mouvements et replay de la même clé idempotente après réponse réseau perdue.
3. Test navigateur du focus trap, Échap sale/propre, retour du focus, annonce d'erreur et navigation sidebar à 390/700/900 px.
4. Test SSE dans un drawer sale et test de reprise d'un `VERSION_CONFLICT` jusqu'à succès avec la version fraîche.

#### Limite et handoff

Aucun navigateur contrôlable n'était disponible dans cette re-review ; l'approbation repose sur l'analyse des handlers/DTO, la syntaxe et la suite Node complète. QA/E2E doit encore exécuter les parcours admin/planner/viewer dans un navigateur. Conformément au périmètre demandé, seul `docs/code-review.md` a été modifié ; la synchronisation de `docs/project-status.md` reste à l'intégrateur.

---

## Gate final INTEGRATION REVIEW — Stock 07a

Date : 2026-08-14  
Périmètre final : `server.js`, `app.js`, `index.html`, `planning.css`, `tests/stock.test.js`, rapports QA/Sécurité/Performance et consommateurs Stock 07a  
Nature : revue indépendante d'intégration après correctifs sécurité ; aucun code ni test modifié

### Verdict final Stock 07a

**APPROVED**

Aucun P0/P1 n'est ouvert sur l'état candidat Stock 07a contrôlé. Les corrections backend, sécurité, tests et frontend sont cohérentes entre elles ; les gates QA, Sécurité et Performance portent chacun un verdict `APPROVED` dans le périmètre qui leur appartient.

### P0 — Critiques

Aucun.

### P1 — Bloquants intégration/release

Aucun.

### Preuves finales

- Les empreintes du rapport QA correspondent exactement aux fichiers courants : `server.js` `0c5ca5e8…02f4`, `app.js` `03561141…6815` et `tests/stock.test.js` `418a32ef…b5b`.
- QA rend **APPROVED**, avec **51 tests réussis sur 51**, zéro échec et zéro test ignoré. Les scénarios Stock incluent ledger, isolation site, source/période canonique, idempotence, maintenance, migration/backup, RBAC, audit et SSE.
- Les régressions de sécurité finales couvrent l'Origin hostile/loopback, le rejeu idempotent après perte de site ou révocation d'acteur, ainsi que la fermeture SSE après logout et révocation persistée. L'inspection du serveur confirme les contrôles d'origine avant mutation/authentification, la revalidation d'autorité avant restitution d'un résultat idempotent et la revalidation périodique des clients SSE.
- Le rapport Sécurité rend **APPROVED**, sans vulnérabilité critique/élevée ouverte. Le rapport Performance rend **APPROVED** dans la limite contractuelle du MVP local mono-processus.
- Le frontend Stock approuvé consomme les routes réelles : sélection d'allocation lisible, instants de réservation canoniques, versions d'exemplaires, libération idempotente, `PATCH` emplacement réel, permissions visibles, flux SSE unique et reprise explicite des conflits.
- `node --check server.js` : réussi sur l'état final.
- `node --check app.js` : réussi sur l'état final.
- La présente passe n'a pas relancé un serveur après la preuve QA 51/51 déjà fraîche et liée par empreintes au même candidat.

### Conclusion d'intégration

Le lot Stock 07a satisfait le Gate final CODE/INTEGRATION REVIEW : **APPROVED, zéro P0/P1**. Ce verdict couvre le socle 07a uniquement ; il n'étend pas le périmètre aux workflows Location 06a, au lot Stock avancé, ni au Gate Release global.

---

## Gate SPEC REVIEW — Fondations 01 / 02 / 04 → 03

Date : 2026-08-14  
Périmètre : décision PO, `AGENTS.md`, `docs/target-architecture-v1.md`, `docs/architecture-roadmap.md`, `docs/spec-organization-01.md`, `docs/spec-resources-02.md`, `docs/spec-project-planning-sequence.md` et état opérationnel du dépôt  
Nature : revue indépendante de spécifications ; aucune spec ni fichier applicatif modifié

### Verdict

**CHANGES REQUIRED**

La direction produit est correctement capturée : ordre séquentiel, organisations isolées, structure juridique et opérationnelle, salles à forte volumétrie, équipement sélectionné par exemplaire sérialisé du Parc, projet obligatoire et planning projeté en cellules salle × jour sur des périodes jour/semaine/mois. Toutefois, neuf P1 laissent encore des autorités ou modèles incompatibles entre les trois lots. Le DEV des fondations ne doit pas démarrer avant leur fermeture.

### P0 — Critiques

Aucun P0 identifié.

### P1 — Bloquants avant DEV

1. **L'architecture directrice contredit encore l'ordre PO obligatoire.** La roadmap place correctement `01 Organisation → 02 Ressources → 04 Projets → 03 Planning` (`docs/architecture-roadmap.md:50-58`) et les nouvelles specs rendent le projet obligatoire. Mais le catalogue cible continue d'indiquer que 04 est une dépendance « facultative » de Planning (`docs/target-architecture-v1.md:70`). Il attribue en outre les clients à la fois au socle 01 et au module 04 (`:68`, `:71`). L'autorité directrice doit être mise à jour : 04 devient un prérequis obligatoire de toute nouvelle planification et un owner unique doit être désigné pour le client.

2. **La chaîne de migrations et le nom canonique du tenant ne sont pas composables.** Organisation impose `organizationId` aux nouvelles entités (`docs/spec-organization-01.md:67`, `:77`) mais laisse le choix entre conserver `companyId` ou renommer toutes les collections (`:314-325`). Projets/Planning continue d'imposer `companyId` (`docs/spec-project-planning-sequence.md:74`, `:95`, `:278`) et réserve pourtant à lui seul `schemaVersion 2 → 3` (`:349-351`), alors que les lots Organisation puis Ressources doivent être intégrés auparavant. Définir une décision unique `companyId`/`organizationId`, les alias transitoires autorisés, une suite de versions/migration IDs ordonnée pour 01 → 02 → 04/03, le writer de chaque bascule, les entrées/sorties de comptage et un rollback sans perte. Le rollback avec écritures nouvelles doit explicitement requérir l'autorité PO prévue par `AGENTS.md`, pas seulement un « opérateur » non défini.

3. **Les gates Organisation → Ressources utilisent des champs incompatibles.** Ressources exige un « nom d'usage » et une « activité principale » (`docs/spec-resources-02.md:31-38`), alors que `tradeName` est facultatif et qu'Organisation ne modélise qu'un ensemble `activities`, sans activité principale (`docs/spec-organization-01.md:81-104`). Organisation publie `organizationUnitId` pour le rattachement d'une ressource (`:191-200`) ; Ressources persiste un `serviceId` non typé (`docs/spec-resources-02.md:82-90`) alors que le socle distingue précisément unité interne et `serviceOffering` (`docs/spec-organization-01.md:129-139`). Sans alignement, une organisation valide peut être indéfiniment refusée par R2 et deux implémentations peuvent choisir des références de service différentes.

4. **Le client obligatoire n'a aucun contrat de lot exécutable.** Les trois specs exigent `client → projet/émission → planning` et l'E2E nominal crée un client (`docs/spec-organization-01.md:14-22`, `docs/spec-project-planning-sequence.md:338`), mais aucune ne définit le modèle canonique du client, ses routes, permissions, états, validation organisation/site, migration ni critères d'acceptation. Le catalogue cible partage en plus implicitement cette responsabilité entre 01 et 04. Publier le contrat client et son owner avant le contrat Projet ; sinon la première étape obligatoire du lot 04 ne peut pas être développée ni testée.

5. **Le vocabulaire Projet/Émission diverge au niveau d'un enum faisant autorité.** Le gate P1 d'Organisation exige `projectType: "program"` pour une émission (`docs/spec-organization-01.md:201-204`), tandis que la spec 04 impose `kind: "emission"` et n'autorise que cette valeur (`docs/spec-project-planning-sequence.md:72-91`). Choisir un champ et une valeur canoniques, documenter l'adaptateur/migration éventuel et faire utiliser le même DTO par le gate Organisation, l'API Projet et Planning.

6. **Ressources 02 contourne potentiellement l'autorité physique Stock 07a.** La spec crée `equipmentUnitId` et `/equipment-units/search` (`docs/spec-resources-02.md:121-136`, `:224`) alors que le Parc intégré publie des articles et `equipmentAsset` ; elle demande aussi à l'affectation de salle d'écrire un « mouvement de localisation » dans sa mutation (`:249-257`). Or l'architecture et la spec Stock ont désigné Stock 07a comme writer unique de l'état/localisation physique. Définir le contrat partagé exact (`equipmentAssetId`, version, site, emplacement), la commande/port appelée par Ressources, la représentation d'une salle comme emplacement éventuel, l'atomicité intermodule et le handoff Stock. Ressources peut posséder l'historique d'installation, mais ne doit pas créer un second journal physique.

7. **Le DTO Planning ne peut pas représenter le matériel qu'il prétend réserver.** Ressources précise que le matériel n'est pas une `resource` (`docs/spec-resources-02.md:72-77`), mais Planning encode toutes les allocations complémentaires par `{ resourceId, quantity }` (`docs/spec-project-planning-sequence.md:95-105`, `:230-244`) tout en promettant du matériel quantitatif et sérialisé (`:188-198`). Il manque un discriminant et les références/versions Stock nécessaires. Définir une union fermée, par exemple personne `resourceId`, article quantitatif `stockItemId + locationId + quantity`, exemplaire `equipmentAssetId + version`, ainsi que la portée série/cellule, le contrôle sur chaque date et le résultat atomique de réservation/libération.

8. **Les owners techniques et handoffs ne sont pas désignés.** Les en-têtes nomment seulement des owners Product/Domain pour 01 et 02, et la spec 04/03 n'a pas d'owner (`docs/spec-organization-01.md:6`, `docs/spec-resources-02.md:6`, `docs/spec-project-planning-sequence.md:1-7`). Aucun tableau ne distribue migrations partagées, contexte tenant, clients/projets, ressources, Planning, Stock port, frontend, tests, sécurité, performance et intégration, ni ne définit le critère de remise entre `01 → 02 → 04 → 03`. Cela ne satisfait pas l'ownership transversal et le writer unique exigés par `AGENTS.md`. Ajouter une matrice owner/handoff et préciser quels gates aval doivent être rejoués après chaque contrat partagé.

9. **Le modèle Ressource humaine est contradictoire sur les sites.** Le modèle commun impose exactement un `siteId` (`docs/spec-resources-02.md:82-90`), tandis que la personne possède plusieurs « sites d'intervention » et services secondaires (`:113-118`) sans collection ni entité d'affectation correspondante. Choisir un site principal plus une relation bornée versionnée, ou limiter réellement la personne à un site dans ce lot ; préciser ensuite comment Planning valide une cellule sur chacun des sites autorisés.

### P2 — Importants, non bloquants une fois contractualisés

1. **Deux mécanismes Organisation sont cités sans modèle ni commande.** O2 autorise `nonApplicable` avec motif pour des prestations post-production (`docs/spec-organization-01.md:181`) sans champ/entité/API associé. La désactivation d'un site dépend d'un « site actif de remplacement » (`:119-127`) sans `replacementSiteId` ni commande de réaffectation. Les rendre explicites ou retirer ces branches.
2. **L'autorisation multi-site d'un projet est indéfinie.** Planning accepte un projet dont `primarySiteId` égale le site courant « ou [qui est] explicitement autorisé » (`docs/spec-project-planning-sequence.md:134`), mais le modèle Projet ne contient ni `allowedSiteIds` ni relation d'autorisation. Fermer cette règle avant les tests d'isolation.
3. **La surcharge d'indisponibilité structurelle n'est pas harmonisée.** Ressources permet conceptuellement un override Planning d'une salle non disponible (`docs/spec-resources-02.md:145-155`), tandis que Planning décrit surtout l'override de conflit et l'interdiction absolue des états physiques indisponibles (`docs/spec-project-planning-sequence.md:148-152`, `:188-198`). Établir une matrice raison de disponibilité → surchargeable/non surchargeable → permission/audit.
4. **La sémantique `following` doit être définie pour les séries multi-salles et les exceptions.** Préciser l'ordre par `localDate`, si toutes les salles d'une même date suivent, et le traitement des cellules déjà déplacées/annulées ; le simple libellé « occurrence et suivantes » (`docs/spec-project-planning-sequence.md:58-64`, `:172-186`) n'est pas suffisant pour une mutation atomique déterministe.
5. **La limite de 500 cellules mérite une règle UX explicite face aux 120 salles.** Elle est saine pour borner les écritures, mais une semaine sur 120 salles produit déjà 840 cellules. Indiquer si cette sélection est interdite avec estimation préalable, fractionnée en séries indépendantes, ou traitée par une commande administrative dédiée, sans promettre d'atomicité globale non disponible.
6. **La validation juridique doit être versionnée par pays.** Le modèle couvre correctement identité, siège, contact, immatriculation, TVA, devise et locale, mais les règles de normalisation/contrôle des identifiants hors France et la gestion d'une forme `other` restent implicites. Publier une policy versionnée et distinguer validation de format de vérification officielle, déjà exclue du lot.

### P3 — Améliorations

1. Ajouter un glossaire transversal unique pour `organization/company/société`, `service/unité/prestation`, `resource/person/equipmentAsset` et `project/program/emission`.
2. Ajouter une matrice `gate amont → port publié → erreur stable → owner consommateur → test de contrat` pour rendre la stricte séquence vérifiable mécaniquement.
3. Normaliser les enums (`temporarily_unavailable` vs conventions camelCase) et préfixer uniformément toutes les routes par `/api/v1` dans les tableaux Projet/Planning.
4. Ajouter aux migrations un manifeste commun avec version source/cible, checksum, totaux par tenant, issues, date, writer et preuve de restauration.

### Points conformes et complets

- Le mandat PO le plus récent est explicitement déclaré prioritaire sur le MVP : aucune nouvelle réservation sans projet validé et aucun contournement du parcours séquentiel.
- Organisation 01 décrit un véritable tenant multi-organisations avec contexte de session opaque, scopes site/service, non-divulgation inter-tenant, audit borné et SSE revalidé.
- Le profil organisationnel couvre identité juridique, siège, contacts, activités, fuseau, devise, langue, sites, unités, prestations, membres, rôles et activation progressive sans dépendance SaaS.
- Ressources 02 couvre les types de salles attendus, l'historique d'affectation sérialisée, la prévention de double affectation, les ressources humaines minimales, la pagination et un benchmark de 500 ressources dont au moins 120 salles de montage.
- La saisie libre d'un numéro de série est interdite : l'utilisateur doit sélectionner un exemplaire canonique du même tenant/site et le serveur doit le relire.
- Planning formalise correctement la cellule `salle × jour civil`, les vues jour/semaine/mois sur le même modèle, les intervalles semi-ouverts, les journées DST de 23/25 h, les séries bornées, les previews, l'atomicité, les scopes de déplacement et les réservations historiques horaires.
- Les trois specs prévoient isolation, RBAC, CSRF/Origin, version optimiste, idempotence, audit après validation, SSE après commit, migration sauvegardée, rollback, volumétrie, performance et scénarios E2E substantiels.

### Conditions pour APPROVED

1. Aligner l'architecture cible et tous les DTO sur l'ordre obligatoire `01 → 02 → 04 → 03`, avec client et projet obligatoires.
2. Fermer les contrats tenant/service/projet et publier une séquence unique de migrations JSON, versions et rollback.
3. Publier les ports Stock/Ressources/Planning pour les exemplaires et articles, sans second writer physique.
4. Compléter le modèle des ressources humaines et des allocations complémentaires Planning.
5. Nommer les owners techniques, writers et handoffs de chaque lot puis repasser cette revue SPEC avant DEV.

---

## Re-review SPEC finale — Fondations 01 / 02 / 04 → 03

Date : 2026-08-14  
Périmètre : `docs/target-architecture-v1.md`, `docs/architecture-roadmap.md`, `docs/spec-organization-01.md`, `docs/spec-resources-02.md`, `docs/spec-project-planning-sequence.md`  
Nature : re-review indépendante ciblée des neuf P1 et des P2 structurants ; aucune spec ni application modifiée

### Verdict final SPEC

**CHANGES REQUIRED**

Les corrections ont fermé cinq des neuf P1 initiaux et cinq des six P2 structurants. La direction d'architecture, l'ordre métier, les ports Stock, l'union d'allocations, le modèle humain multi-site et les bornes Planning sont désormais nettement mieux contractualisés. Le gate ne peut toutefois pas être approuvé : quatre contrats transverses restent incompatibles et la chaîne de migrations publiée par Planning n'est pas celle annoncée par Organisation/Ressources.

### P0 — Critiques

Aucun.

### P1 — Bloquants avant DEV

1. **La chaîne de versions et ses owners restent contradictoires.** La chaîne normative la plus complète annonce `Organisation v2→v3`, `Ressources v3→v4`, `Clients/Projets v4→v5`, `Planning v5→v6` (`docs/spec-project-planning-sequence.md:471-480`). Organisation annonce au contraire Clients/Projets en v4 puis « Ressources 03 » en v5, et son rollback s'arrête à `v5→v4→v3` (`docs/spec-organization-01.md:340`, `:357`). Sa matrice mélange également modules et rôles : l'étape 02 devient « Frontend 02 », Ressources est appelée 03 et Planning n'a pas de handoff (`:442-449`). Enfin, la spec Ressources ne déclare ni entrée v3, ni sortie v4, ni identifiant immuable/digest/handoff (`docs/spec-resources-02.md:410-421`). Publier exactement la même chaîne v2→v6 et les mêmes owners/writers dans les trois specs ; réserver les numéros 02/03/04 aux modules ou aux migrations de façon non ambiguë.

2. **Le tenant canonique n'est toujours pas uniforme.** La cible interdit explicitement `organizationId` comme champ alternatif et impose `companyId`/`company_id` (`docs/target-architecture-v1.md:111-119`). Ressources persiste encore `organizationId`, le publie dans son handoff Stock et le dérive de la session (`docs/spec-resources-02.md:83`, `:215`, `:238`). Projets/Planning qualifie aussi `organizationId` d'« interface amont éventuelle » (`docs/spec-project-planning-sequence.md:69`), alors que la cible et Organisation disent qu'aucun alias n'est accepté. Remplacer ce champ dans Ressources et supprimer ou circonscrire l'adaptateur non autorisé ; aucun port, DTO, audit ou persistance validé ne doit mélanger les deux clés.

3. **Deux contrats Client et Projet se déclarent canoniques mais ne décrivent pas les mêmes entités.** Organisation rend `primaryContact` obligatoire, ajoute `kind`, données légales et état `onHold`, et expose `hold/resume` (`docs/spec-organization-01.md:179-187`). La spec owner 04 exige à la place `displayName`, `activity`, `allowedSiteIds`, rend le contact facultatif et n'autorise que `draft|active|archived` (`docs/spec-project-planning-sequence.md:73-92`). Pour Projet, Organisation autorise six `kind`, un brouillon et `onHold` (`docs/spec-organization-01.md:189-193`), tandis que 04 n'autorise que `kind="emission"`, utilise `on_hold`, `planningReadiness` et `allowedSiteIds` (`docs/spec-project-planning-sequence.md:94-117`). Puisque 04 est l'owner unique, Organisation doit référencer un contrat publié unique ou reprendre exactement ses champs, états, transitions, routes, permissions et règles de site.

4. **La stratégie des réservations historiques sans projet est mutuellement exclusive.** La roadmap exige un Projet technique visible « Non affecté — reprise RC1 » avant activation du writer Planning (`docs/architecture-roadmap.md:91-103`). Organisation interdit d'affecter un faux projet (`docs/spec-organization-01.md:352`) et Planning conserve au contraire `legacyUnassigned=true`, modifiable seulement par rattachement/annulation (`docs/spec-project-planning-sequence.md:503-504`). La cible exige pourtant qu'aucune réservation active n'arrive au handoff Planning sans projet (`docs/target-architecture-v1.md:87-88`). Une seule règle produit doit être choisie et propagée avec son effet sur statut actif, visibilité, migration, compatibilité `/api/v1`, comptages et condition de handoff.

### Statut des neuf P1 initiaux

| P1 initial | Statut | Résultat de la re-review |
|---|---|---|
| 1. Ordre architecture / owner client | **CORRIGÉ** | La cible rend 04 obligatoire pour Planning, fixe `01→02→04→03` et attribue Client/Projet exclusivement à 04 (`docs/target-architecture-v1.md:70-88`). |
| 2. Tenant + chaîne de migrations | **OUVERT** | `companyId` est fixé dans la cible/Organisation, mais Ressources conserve `organizationId` et les versions v4/v5/v6 ne concordent pas. Voir P1 1–2 ci-dessus. |
| 3. Gates Organisation → Ressources | **CORRIGÉ** | `primaryActivity`, exigences d'activité et `organizationUnitId` sont maintenant modélisés ; `serviceId` n'est plus l'autorité de rattachement d'une ressource. |
| 4. Contrat Client absent | **PARTIEL** | Modèles/routes/permissions existent, mais deux variantes incompatibles se disent canoniques. Voir P1 3. |
| 5. Enum Projet/Émission | **PARTIEL** | `program` est correctement adapté vers `emission`, mais les enums `kind` et états divergent encore entre Organisation et 04. Voir P1 3. |
| 6. Autorité physique Stock 07a | **CORRIGÉ** | Stock est writer unique ; Ressources appelle des ports assign/unassign versionnés et ne tient pas de second ledger (`docs/spec-resources-02.md:125-147`). |
| 7. DTO allocations Planning | **CORRIGÉ** | L'union fermée personne/quantité Stock/exemplaire sérialisé et le port atomique Stock sont définis (`docs/spec-project-planning-sequence.md:150-174`, `:279-287`). |
| 8. Owners et handoffs | **PARTIEL** | Des matrices existent, mais Organisation attribue encore les mauvais numéros/versions et omet le handoff Planning ; Ressources n'annonce pas sa migration v3→v4. Voir P1 1. |
| 9. Ressource humaine multi-site | **CORRIGÉ** | `primarySiteId`, `personSiteAssignments` et `personOrganizationUnitAssignments` versionnés couvrent le multi-site (`docs/spec-resources-02.md:105-119`). |

### P2 structurants

1. **Override d'indisponibilité calendaire encore incohérent — OUVERT.** Ressources autorise une indisponibilité calendaire manuelle avec `planning.override_unavailability` (`docs/spec-resources-02.md:169-180`, `:231`), mais Planning ne publie pas cette permission et affirme que seul un conflit de capacité temporelle est surchargeable (`docs/spec-project-planning-sequence.md:264-277`, `:389`). Aligner matrice, permission, code d'erreur et audit dans les deux modules.
2. **`nonApplicable` et `replacementSiteId` — CORRIGÉ.** Les décisions, motifs, audit et réaffectation explicite sont modélisés dans Organisation.
3. **Périmètre multi-site Client/Projet — CORRIGÉ.** `allowedSiteIds`, intersection de scopes et contraintes client→projet sont définis (`docs/spec-project-planning-sequence.md:80-117`).
4. **Sémantique `following` — CORRIGÉ.** Ordre, lane, exceptions et mapping de salles sont explicités (`docs/spec-project-planning-sequence.md:236-244`).
5. **Plafond 500 cellules / 120+ salles — CORRIGÉ.** L'estimation préalable avertit à 480 cellules et refuse 600 sans fractionnement implicite (`docs/spec-project-planning-sequence.md:200-210`).
6. **Policy juridique pays — CORRIGÉ.** Version, validations de forme et absence de vérification officielle sont explicitement distinguées dans Organisation.

### P3 — Améliorations restantes

1. Le scénario E2E « ordre 01→04 » est ambigu (`docs/spec-project-planning-sequence.md:467`) : écrire soit les quatre modules `01→02→04→03`, soit les quatre identifiants de migration `foundation-01…foundation-04`.
2. Dans Planning, « writers 03 et 04 » désigne l'ordre des migrations, alors que les modules fonctionnels sont 04 puis 03 (`docs/spec-project-planning-sequence.md:480-501`). Utiliser systématiquement les identifiants immuables pour éviter l'inversion.
3. Le glossaire cible inclut équipement/licence dans Ressources 02 tandis que la spec Ressources limite sa catégorie à `room|person|other` (`docs/target-architecture-v1.md:115`, `docs/spec-resources-02.md:83-91`). Distinguer explicitement capacité logique planifiable et `equipmentAsset` physique Stock.

### Conditions de revalidation

Le prochain contrôle peut être ciblé sur quatre preuves documentaires : chaîne unique v2→v6 avec owners/handoffs complets ; `companyId` exclusif ; modèle/API Client et Projet uniques sous autorité 04 ; décision unique de reprise des réservations sans projet. Le P2 d'override doit également être aligné avant que les contrats Resources/Planning soient implémentables sans interprétation.

Conformément au périmètre demandé, seul `docs/code-review.md` a été modifié. La mise à jour de `docs/project-status.md` reste au responsable d'intégration.

---

## Re-review SPEC stricte après handoffs Owners

Date : 2026-08-14  
Périmètre : quatre P1 et P2 `planning.override_unavailability` de la re-review précédente, sur les trois specs de fondation et les deux documents d'architecture  
Nature : revue indépendante finale des documents publiés par les quatre owners ; seul ce rapport est modifié

### Verdict

**CHANGES REQUIRED**

Les handoffs ferment le double contrat Client/Projet. Ils corrigent aussi l'ordre des owners et les versions numériques `v2→v3→v4→v5→v6`. En revanche, trois P1 restent ouverts : les identifiants déclarés immuables ne concordent pas, un alias tenant reste explicitement admis par la spec owner 04, et la représentation du Projet technique de reprise diverge encore entre architecture, Organisation et Planning. Le P2 d'override n'est pas fermé.

### Statut des quatre P1

| P1 contrôlé | Statut | Preuve |
|---|---|---|
| Chaîne migrations / owners | **PARTIEL — OUVERT** | Les versions et owners sont désormais ordonnés partout : ORG-01 v2→v3, RES-02 v3→v4, PROJ-04 v4→v5, PLAN-03 v5→v6. Mais Organisation déclare les identifiants immuables `foundation-01-organization-v2-to-v3` … `foundation-04-planning-v5-to-v6` (`docs/spec-organization-01.md:330-339`) et Ressources reprend `foundation-02-resources-v3-to-v4` (`docs/spec-resources-02.md:412-429`), tandis que Planning exige exclusivement `ORG-01-v2-to-v3` → `RES-02-v3-to-v4` → `PROJ-04-v4-to-v5` → `PLAN-03-v5-to-v6` (`docs/spec-project-planning-sequence.md:423`, `:475-484`). Un fichier migré conformément à l'une des specs est donc refusé par l'autre. |
| Tenant canonique | **PARTIEL — OUVERT** | Ressources a bien remplacé ses DTO, ports et handoffs par `companyId` (`docs/spec-resources-02.md:42`, `:85`, `:217`, `:240`). La spec owner 04 continue néanmoins d'autoriser `organizationId` comme « nom d'interface amont éventuel » traduit par un adaptateur (`docs/spec-project-planning-sequence.md:69`), alors que la cible dit qu'il n'est pas un champ alternatif et impose exclusivement `companyId`/`company_id` dans contrats et persistance (`docs/target-architecture-v1.md:126-134`). Les mentions servant à rejeter un champ entrant sont conformes ; cette autorisation d'interface amont ne l'est pas. |
| Contrat Client/Projet unique | **CORRIGÉ** | Organisation ne redéfinit plus le modèle ni l'API et référence explicitement les sections de la spec owner 04 (`docs/spec-organization-01.md:179-183`, `:219`). Les champs, états, `allowedSiteIds`, `planningReadiness` et `kind="emission"` ont maintenant une autorité unique. |
| Reprise des réservations sans projet | **PARTIEL — OUVERT** | Tous les documents choisissent désormais un vrai Client/Projet technique et interdisent `legacyUnassigned`. Cependant le contrat exact diverge : la cible impose Client `MIGRATION-RC1`, Projet `MIGRATION-RC1-<siteId>`, `systemManaged`, `migrationPurpose`, `scopeSiteId` et audit `reservation.project.backfilled` (`docs/target-architecture-v1.md:93-104`) ; Planning persiste `RC1-TECHNICAL`, `RC1-NON-AFFECTE-<suffixe>`, seulement `technicalPurpose` et audit `reservation.projectBackfilled` (`docs/spec-project-planning-sequence.md:495-522`). Organisation décrit encore par endroits un Projet « par organisation » (`docs/spec-organization-01.md:356`, `:417`, `:451`) alors que l'architecture et Planning exigent un Projet par couple société/site. Ces objets, filtres et audits ne sont pas interopérables sans choix implicite. |

### P2 — Override d'indisponibilité

**OUVERT.** Ressources distingue deux permissions : `planning.override_unavailability` uniquement pour l'indisponibilité calendaire manuelle, mais conserve `planning.override_conflict` pour conflit temporel Stock et dépassement de capacité (`docs/spec-resources-02.md:171-182`, `:233-236`). Planning déclare au contraire `planning.override_conflict` ancien et supprimé, emploie `planning.override_unavailability` pour les conflits de capacité salle/personne, et ne contient pas la ligne normative d'indisponibilité calendaire manuelle (`docs/spec-project-planning-sequence.md:264-277`, `:386-389`, `:522`). Choisir soit deux permissions aux périmètres fermés, soit une permission unique avec une matrice identique ; aligner ensuite migration de rôles, codes d'erreur, preview, audit et cas négatifs.

### Corrections vérifiées

- Les owners/writers fonctionnels et les handoffs sont maintenant nommés dans l'ordre requis, sans attribuer le numéro 02 au frontend Organisation.
- Ressources publie une vraie migration v3→v4 avec sauvegarde, digest, comptages, idempotence, rollback et handoff v4.
- Organisation délègue correctement Client/Projet à l'owner 04 au lieu de publier une seconde machine d'états.
- La stratégie `legacyUnassigned` est supprimée au profit d'entités techniques visibles et d'un `projectId` non nul après PLAN-03 ; le désaccord restant porte sur leur DTO canonique et leur cardinalité, pas sur le principe.

### Conditions d'approbation

1. Employer les quatre mêmes identifiants immuables de migration dans les cinq documents.
2. Retirer de la spec 04 l'autorisation d'un champ/interface amont `organizationId`, ou modifier explicitement la cible si cet adaptateur est réellement voulu.
3. Publier un seul DTO Client/Projet technique de reprise, une cardinalité par `companyId/siteId`, un seul événement d'audit et les mêmes codes déterministes.
4. Aligner exactement la matrice et le catalogue de permissions d'override entre Ressources et Planning.

Conformément au périmètre demandé, aucun document de spec, fichier d'architecture, code ou test n'a été modifié ; seule cette section a été ajoutée à `docs/code-review.md`.

---

## Ultime re-review SPEC — canons littéraux

Date : 2026-08-14  
Périmètre : `docs/target-architecture-v1.md`, `docs/architecture-roadmap.md`, `docs/spec-organization-01.md`, `docs/spec-resources-02.md`, `docs/spec-project-planning-sequence.md`  
Nature : comparaison stricte des littéraux, DTO, cardinalités, audits/événements et permissions ; aucune modification hors du présent rapport

### Verdict SPEC

**CHANGES REQUIRED**

Les identifiants de migration, le tenant canonique et la matrice des deux overrides sont maintenant alignés. La cardinalité de reprise est également commune : un Client technique par `companyId`, un Projet technique par couple `companyId`/`siteId`. Un P1 subsiste cependant dans le contrat propriétaire PROJ-04 : ses DTO et événements de création ne recopient pas le canon déclaré « exact » par l'architecture.

### P0

Aucun.

### P1 — Bloquant restant

1. **Le DTO et les audits/événements de reprise PROJ-04 divergent encore du canon exact.** La cible et la roadmap imposent pour le Client technique les champs exacts `id`, `companyId`, `name`, `code`, `active`, `systemManaged`, `migrationPurpose`, `version`, `createdAt`, `updatedAt`, et pour le Projet `id`, `companyId`, `siteId`, `clientId`, `name`, `code`, `status`, `color`, `systemManaged`, `migrationPurpose`, `version`, `createdAt`, `updatedAt`; elles interdisent explicitement le champ supplémentaire `scopeSiteId` (`docs/target-architecture-v1.md:97-144`, `docs/architecture-roadmap.md:104-110`). La spec PROJ-04 décrit au contraire le Client avec `legalName`, `displayName`, `activity`, `allowedSiteIds`, `status`, sans `name`, `active`, `systemManaged` ni `migrationPurpose` (`docs/spec-project-planning-sequence.md:503`), et le Projet avec `kind`, `primarySiteId`, `allowedSiteIds`, `planningReadiness`, `scopeSiteId`, sans le `siteId` canonique ni `color` (`:515-532`). Elle emploie en outre `client.created`/`project.created` et `client.updated.v1`/`project.updated.v1` (`:547`) quand l'architecture et Organisation exigent exactement `client.recovery.created`/`project.recovery.created` et `client.recovery.created.v1`/`project.recovery.created.v1` (`docs/target-architecture-v1.md:136-144`, `docs/spec-organization-01.md:356-358`). Un writer ne peut satisfaire simultanément ces contrats.

### Axes désormais conformes

| Axe | Statut | Preuve |
|---|---|---|
| Identifiants immuables | **CORRIGÉ** | Les cinq documents utilisent la chaîne littérale `foundation-01-organization-v2-to-v3` → `foundation-02-resources-v3-to-v4` → `foundation-04-projects-v4-to-v5` → `foundation-03-planning-v5-to-v6`, sans alias court. |
| Tenant | **CORRIGÉ** | `companyId` est exclusif dans DTO/API/événements ; les occurrences de `organizationId` décrivent seulement son rejet explicite `400 FIELD_NOT_ALLOWED` (`docs/spec-project-planning-sequence.md:69`, `:313`; `docs/spec-organization-01.md:15`). |
| Cardinalité de reprise | **CORRIGÉE** | Tous les documents prescrivent un Client technique par société concernée et un Projet technique par société/site, puis 100 % des réservations rattachées avant le handoff Planning. |
| Audit/événement du rattachement | **CORRIGÉ** | Le rattachement utilise partout `reservation.project.backfilled` puis `reservation.project.backfilled.v1`, avec `migrationId="foundation-03-planning-v5-to-v6"`. |
| Deux overrides | **CORRIGÉ** | `planning.override_conflict` couvre capacité/conflit de réservation ou Stock surchargeable ; `planning.override_unavailability` couvre uniquement le calendrier manuel. Les deux sont distincts, cumulés si les deux causes existent, et possèdent motifs/audits séparés (`docs/target-architecture-v1.md:252-261`, `docs/spec-resources-02.md:171-186`, `docs/spec-project-planning-sequence.md:269-286`, `:393-397`). |

### Condition unique d'approbation

Faire recopier par `docs/spec-project-planning-sequence.md` les deux DTO techniques exacts de l'architecture, sans `scopeSiteId` ni champs alternatifs, et remplacer ses audits/événements de création par les quatre noms `*.recovery.created[.v1]` canoniques. Une dernière vérification littérale ciblée suffira ensuite.

Conformément au mandat, seul `docs/code-review.md` a été modifié.

---

## Revue indépendante finale runtime — Organisation 01 / 01b fiscal

Date : 2026-08-14  
État revu : `server.js` SHA-256 `9058ba9fa49175a6876544f17234cbf78f2b2db197855339043518a96ca620a3`, `app.js` SHA-256 `46a21e1e8c8cff0fa006d7493491f36e9b41ccbf057edf12aa926f5cfd9236c2`, `index.html` SHA-256 `12e47ebf352face70fda1cc83307df1eb40ca62474d0715a7c86448fd6cf46fd`, `planning.css` SHA-256 `ed3613392c652c185a69f584235509dbaf167127e06d2ba8094476354e06aeff`  
Références : `docs/spec-organization-01.md`, `docs/ux-organization-01.md`, constats P1 runtime antérieurs du présent rapport  
Indépendance : le reviewer n'a écrit ni `server.js`, ni `app.js`, ni `index.html`, ni `planning.css`; cette passe n'apporte aucune correction applicative ou de test

### Verdict REVIEW final

**CHANGES REQUIRED — 0 P0, 5 P1.**

Les sept constats P1 Organisation historiques sont fermés sur le code courant, mais cinq écarts du parcours fiscal/activité empêchent encore le candidat d'entrer au gate QA final puis en intégration.

### P1 — Bloquants

1. **Une organisation nouvellement créée ne peut pas franchir la sous-étape fiscale 2.** La création laisse légitimement `taxIdentifiers=[]`, `defaultVatRateId` absent et ne crée aucun taux (`server.js:711`). Or le formulaire Territoire envoie seulement `taxCountry`, `vatStatus` et les versions (`app.js:140`), tandis que `PATCH /fiscal-profile` revalide immédiatement le profil entier et exige déjà les identifiants FR ainsi qu'un taux actif/applicable (`server.js:742-757`). Le catalogue de taux et les identifiants ne sont accessibles qu'aux sous-étapes 3 et 4, encore verrouillées (`app.js:127-135`). Le premier clic « Enregistrer et continuer » retourne donc `422` sans chemin UI permettant de satisfaire les champs demandés. Il faut un contrat serveur/UI cohérent de brouillon validé par sous-étape, ou une commande atomique complète rendue éditable avant validation, sans contourner l'ordre O1.

2. **La revalidation fiscale et le focus d'erreur ne respectent pas le parcours fermé approuvé.** Modifier `taxCountry` ou `vatStatus` ne recharge pas la policy, ne retire/ajoute pas dynamiquement l'exigence TVA et ne purge pas explicitement les identifiants/taux incompatibles; le listener ne fait que réduire des compteurs locaux (`app.js:144-147`). Lors d'un `missingFields` fiscal, `showOrgError` se limite au résumé de l'écran courant et tente une correspondance sur le dernier segment du chemin (`app.js:143`) : `fiscalProfile.taxIdentifiers.businessRegistration` ne correspond à aucun contrôle, et la première sous-étape fautive n'est pas rouverte. Cela contredit le retour automatique et le focus exact exigés par `docs/ux-organization-01.md:174,221-223`.

3. **La validation fiscale explicite est enregistrée trop tôt.** Chaque `PATCH /fiscal-profile` réussi, y compris une sauvegarde intermédiaire des sous-étapes 2 à 4, écrit immédiatement `fiscalValidatedAt` et `fiscalValidatedBy` (`server.js:758-760`). La migration et le contrat O1 imposent au contraire que ces métadonnées restent absentes jusqu'à la confirmation humaine de la sous-étape 5 (`docs/spec-organization-01.md:114,436`). Le runtime confond donc mutation de brouillon et validation explicite, ce qui fausse la complétude et la traçabilité de l'approbation fiscale.

4. **Une modification des activités peut rendre O1 impossible à corriger depuis l'interface.** Le formulaire autorise de changer `activities`, mais réutilise les anciennes `activityRequirements` dès qu'elles ne sont pas vides (`app.js:139`). Le serveur refuse ensuite toute exigence liée à une activité retirée et exige toutes les catégories Post-production/Laboratoire nouvellement choisies (`server.js:602-617`). L'UI ne présente aucun contrôle de décision `enabled/nonApplicable` ni ne recalcule les exigences à partir du nouvel ensemble : par exemple passer de Location à Post-production produit `422 activityRequirements` sans correction possible. Il faut reconstruire/faire éditer les exigences conformément aux activités courantes, y compris les motifs `nonApplicable`.

5. **Le rejeu de la migration 01b n'en vérifie pas l'intégrité avant de l'accepter.** Dès que le marqueur existe, `migrateOrganizationFiscalV3` retourne la base sans comparer digest, versions de policy, comptages ni contenu attendu (`server.js:247-250`). La SPEC impose au contraire qu'un marqueur présent ne soit accepté que si ces preuves sont conformes et que toute divergence arrête la migration (`docs/spec-organization-01.md:440`). Dans l'état actuel, une base v3 marquée mais altérée peut être considérée prête pour RES-02; le test ne couvre que l'absence de duplication au rejeu. Il faut valider le handoff publié et ajouter un cas de marqueur/contenu divergent refusé.

### Fermetures vérifiées des sept P1 antérieurs

- Les permissions effectives proviennent de `membershipRoles` et `roles.permissions`; login, `/auth/me`, changement de contexte et revalidation SSE reconstruisent ce contexte. Une révocation devient effective à la requête suivante (`server.js:324-347`, `:381`, `:678-699`).
- Les listes et mutations d'unités, prestations et memberships appliquent les scopes site/unité et restent non révélatrices; les champs tenant fournis par le client sont rejetés.
- La migration v2→v3 conserve les rôles legacy sans promotion générale et les trois organisations de démonstration ne sont injectées que pour `makeSeed`/`resetData` reconnu (`server.js:156-166`, `:221-245`).
- Les exigences Post-production/Laboratoire et les gates aval sont contrôlés côté serveur; suspend/archive, rôles, scopes et remplacement de site sont présents avec versions et dépendances.
- L'idempotence Organisation contrôle clé, cible, acteur/autorité et empreinte; audit et SSE restent rattachés au tenant courant avec `requestId` et enveloppes fiscales sans identifiants.

### Autres observations non bloquantes

- **P2 — résidu de scalaires fiscaux dans l'aperçu :** la page Organisation affiche encore `registrationNumber` (`app.js:99`), champ supprimé par 01b et explicitement interdit dans l'UX fiscale. Le rendu est échappé, mais produit aujourd'hui une valeur vide/`undefined` et entretient deux sources d'autorité.
- L'inspection XSS n'a trouvé aucune interpolation utilisateur non échappée sur le parcours fiscal courant : texte et attributs libres passent par `esc`/`inputValue`; les résumés d'erreur sont échappés. Les fieldsets/legends, labels, textes de statut, `focus-visible`, reflow mobile et réduction d'animation sont présents. Les défauts de focus sémantique précis sont couverts par le P1 n°2.

### Condition de re-review

Corriger les cinq P1, ajouter les régressions de création O1 fraîche, changement territoire/statut, validation explicite, changement d'activités et divergence du marqueur 01b, puis rejouer REVIEW et tous les gates aval affectés. Le vert automatisé éventuel ne remplace pas ces scénarios UI/contrat actuellement absents.

---

## Revue indépendante SPEC — extension fiscale Organisation 01 et fondation Devis

Date : 2026-08-14  
Périmètre : `docs/spec-organization-01.md`, cohérence avec `docs/target-architecture-v1.md`, `docs/architecture-roadmap.md`, `docs/spec-finance-analytics.md`, `docs/ux-organization-01.md` et l'état de fondation publié  
Nature : revue documentaire indépendante ; aucune modification de la SPEC ni du code

### Verdict

**CHANGES REQUIRED — 0 P0, 4 P1.**

L'extension est saine sur plusieurs invariants structurants : pays fiscal et devise sont explicites ; les identifiants sont structurés et policy-versionnés ; les taux utilisent des points de base entiers ; le taux français proposé à `2000` est modifiable et non codé comme vérité légale ; O1 exige un taux actif/applicable ; les DTO refusent les champs tenant et les flottants ; permissions fiscales, isolation, contrôle optimiste, audit masqué et SSE après commit sont définis ; le seed est multi-tenant et fictif. La fondation Devis impose également HT/TVA/TTC en unités mineures, arrondi `roundHalfUp` par ligne, total par somme des lignes, snapshot immuable et override limité à un `vatRateId` configuré avec permission dédiée (`docs/spec-organization-01.md:121-131`, `:184-196`, `:204-212`, `:279-367`, `:407-421`).

Ces qualités ne suffisent toutefois pas à rendre la SPEC développable sans ambiguïté sur les quatre points bloquants suivants.

### P1 — Bloquants avant DEV

1. **L'extension réécrit sémantiquement une migration déclarée immuable et déjà publiée.** La SPEC ajoute profil fiscal, `fiscalProfileVersion` et `vatRates` à `foundation-01-organization-v2-to-v3` (`docs/spec-organization-01.md:369-393`), alors que `docs/project-status.md:38` fige déjà cette chaîne et que le runtime/tests connaissent déjà cet identifiant et le schéma v3. Une base ayant exécuté la première forme de v2→v3 ne rejouera pas légitimement le même identifiant et restera dépourvue des nouveaux champs ; changer le contenu sous le même ID invaliderait digest, rollback et preuve d'idempotence. La SPEC doit publier une migration additive distincte depuis chaque état réellement supporté, ou définir avant DEV une nouvelle baseline/version de schéma et une matrice de compatibilité/rollback qui ne modifie jamais l'historique de `foundation-01-organization-v2-to-v3`.

2. **Le contrat UX O1 contredit le nouveau modèle fiscal et rend le gate impossible à implémenter fidèlement.** La SPEC canonique exige `taxCountry`, `vatStatus`, `taxIdentifiers`, `defaultVatRateId` et, sous `FR@1`, SIREN/SIRET plus TVA conditionnelle (`docs/spec-organization-01.md:121-131`, `:218-222`, `:330-349`). L'UX expose encore les scalaires `registrationNumber`, `establishmentNumber`, `vatNumber`, marque SIRET/TVA non requis et affirme que la TVA ne bloque jamais O1 (`docs/ux-organization-01.md:158-176`, `:465-473`). Il faut aligner le parcours, les champs, les erreurs/focus, le choix du taux et les états registered/exempt/notApplicable avant DEV ; le plan QA doit ensuite couvrir ce contrat au lieu de l'« identifiant légal » générique actuel (`docs/qa-plan-foundations-0.3.md:51`).

3. **La frontière et l'owner du futur Devis ne sont pas contractuellement raccordés à l'architecture Finance/Commercial.** L'architecture place les devis dans le module 08 Commercial, dépendant de 09 (`docs/target-architecture-v1.md:75-76`), tandis que la roadmap reporte fiscalité et facturation à des incréments 09 postérieurs (`docs/architecture-roadmap.md:177-190`) et que Finance 09a exclut explicitement TVA et pièce fiscale (`docs/spec-finance-analytics.md:7-16`). Organisation 01 parle seulement d'un « futur owner Devis » et publie des permissions futures (`docs/spec-organization-01.md:204-212`) sans désigner le writer, le port versionné, la dépendance 08↔09 fiscal ni le handoff. La SPEC/architecture doit nommer l'autorité : module 08 pour le devis commercial et module 09 fiscal pour règles/calculs, ou une autre décision explicite ; elle doit confirmer que Finance 09a reste inchangé et positionner la migration/activation correspondante dans la roadmap.

4. **La fondation monétaire et le snapshot Devis ne sont pas encore déterministes pour toutes les devises/taux autorisés.** `currency` accepte tout ISO 4217 (`docs/spec-organization-01.md:102`, `:131`), mais « unité mineure » ne publie ni exposant versionné de devise ni règle pour les devises à 0 ou 3 décimales ; la borne d'entier sûr est reportée au futur (`:210`). Le snapshot emploie en outre « adresse applicable », « identifiants nécessaires » et « date fiscale » sans DTO, ordre de sélection, fuseau/date civile ni règle multi-taux (`:208-212`). Le contrat publié doit au minimum figer `currencyMinorUnitExponent`/version de catalogue, les bornes d'entiers, `taxDate` et sa zone d'interprétation, les champs exacts de l'adresse et des identifiants snapshotés, et préciser si `vatRateId/rateBps` est porté par chaque ligne. Sans cela, deux writers conformes peuvent produire des montants ou snapshots différents.

### Conditions de re-review

- conserver l'identifiant v2→v3 immuable et publier une trajectoire additive depuis le v3 déjà exécuté ;
- aligner l'UX O1 et le plan QA sur le DTO fiscal structuré et le taux par défaut ;
- attribuer explicitement le contrat Devis aux modules 08/09 avec port, dépendances et ordre de livraison ;
- rendre déterministes l'exposant monétaire, les bornes, la date fiscale, le DTO snapshot et la granularité du taux.

Après ces corrections documentaires, rejouer REVIEW SPEC. Aucun développement fiscal ou Devis ne doit commencer avec ces P1 ouverts. Ce verdict ne remet pas en cause le taux FR proposé à 20 % modifiable, les points de base, le modèle d'autorisation/isolation/audit ni l'exclusion de l'implémentation Devis du lot Organisation.

Conformément au mandat, seul `docs/code-review.md` a été modifié ; la mise à jour de `docs/project-status.md` reste à la charge de l'intégrateur.

---

## Gate CODE REVIEW — Organisation 01

Date : 2026-08-14  
Périmètre : `server.js`, `tests/organization.test.js`, consommateurs backend existants, `docs/spec-organization-01.md`, architecture cible/roadmap et `docs/ux-organization-01.md`  
Nature : revue indépendante après handoff backend ; aucun code ni test modifié

### Verdict

**CHANGES REQUIRED**

Le candidat corrige bien l'enchaînement v1→v2→v3 et le tenant SSE d'une Company, et la suite annoncée par l'intégrateur atteint 62/62. Ce résultat ne couvre toutefois pas plusieurs invariants bloquants. L'implémentation ne peut pas être approuvée tant que RBAC/scopes, gates O1–O3 et aval, migration, transitions et audit ne correspondent pas au contrat.

### P0

Aucun P0 identifié.

### P1 — Bloquants

1. **Les rôles Organisation persistés ne font pas autorité.** `getSession()` charge membership et scope, mais `has()` consulte uniquement `permissions[auth.user.role]`, le rôle legacy de `users` (`server.js:246-260`). Les mutations de `/memberships/:id/roles` modifient `membershipRoles` sans changer les permissions effectives (`:633-634`). Une révocation ne retire donc pas les droits d'un legacy admin et l'attribution d'un rôle Organisation à un autre profil ne les accorde pas. Les lectures `companies`/Company ne contrôlent même pas `organization.read` (`:597-615`). C'est un contournement direct du RBAC contractuel.

2. **Les scopes site/unité ne protègent pas les nouveaux référentiels.** Les listes génériques filtrent les sites, mais pas `organizationUnits`, `serviceOfferings`, adresses ou contacts (`server.js:623-624`). Les créations/modifications relisent seulement le tenant dans `validateChild`, sans `siteAllowed(auth, …)` ni vérification qu'une unité sélectionnée appartient aux sites autorisés (`:562-568`, `:625-627`). `/memberships` retourne tous les membres du tenant (`:629`) et la mise à jour des scopes accepte une unité d'un site absent de `siteIds` (`:635-636`). Un responsable borné à un site peut donc lire ou viser des données d'un autre site dès qu'un rôle lui donne la permission correspondante.

3. **La migration élève les privilèges et injecte des données de démonstration.** Pour chaque utilisateur historique, `migrateOrganizationV2ToV3()` lie sans distinction le rôle `organizationAdmin` (`server.js:191-197`), au lieu de préserver le rôle et les scopes. Elle ajoute aussi systématiquement Eliote Props Prod, Eliote Location et FAV Location à toute base v2 et rattache le platform admin à ces tenants (`:167-173`, `:189-200`). La spec sépare migration additive des données existantes et seed de démonstration ; une migration de production ne doit ni créer des tenants de démo ni promouvoir les lecteurs/planificateurs.

4. **O2 est contournable et les gates Organisation ne protègent pas les modules aval.** `validateCompanyFields()` valide seulement les entrées présentes dans `activityRequirements`; il n'exige jamais les décisions Montage/Étalonnage/Mixage/PAD pour `postProduction` ni Laboratoire pour `laboratory` (`server.js:510-527`). `organizationCompleteness()` boucle ensuite sur cette liste éventuellement vide (`:529-545`), ce qui permet de valider O2 sans les décisions obligatoires. Surtout, les créations Ressource, Client, Projet et Réservation ne relisent ni `company.status === active`, ni `onboardingStage === ready`, ni le service de préconditions Organisation (`:657-666`, `:681-684`). Le parcours séquentiel exigé reste donc contournable par API.

5. **Des commandes et transitions obligatoires ne sont pas implémentées.** Les routes `POST /companies/:id/suspend`, `POST /companies/:id/archive`, `POST /roles` et `PATCH /roles/:id` annoncées par la spec sont absentes ; seul `GET /roles` existe (`server.js:637`). Le PATCH générique d'un site autorise `active=false` sans rechercher ressources/réservations futures et sans exiger `replacementSiteId`/stratégie (`:627`). Les transitions `active↔suspended`, archivage terminal et protection des données référencées ne peuvent pas être testées ni garanties.

6. **L'idempotence annoncée n'existe pas pour les créations Organisation.** Les tests envoient des clés sur Company, Site, Unité et Prestation (`tests/organization.test.js:163-166`, `:239-266`), mais aucune de ces routes ne lit `idempotency-key` (`server.js:601-605`, `:623-625`). Un rejeu retourne au mieux un conflit de doublon, et peut produire une seconde écriture lorsque les contraintes ne suffisent pas. Cela ne satisfait pas la création idempotente ni la reprise après réponse réseau perdue.

7. **L'audit Organisation est incomplet et parfois rattaché au mauvais tenant.** `audit()` prend toujours `companyId` depuis l'ancien contexte `auth.user.companyId` et ne reçoit `requestId` que si chaque appel le remet dans `details` (`server.js:289`). Les appels Organisation ne le transmettent pas. Lors de la création d'une Company, l'audit est donc écrit sous le tenant précédemment actif, avant que la session bascule sur la nouvelle Company (`:601-605`), et tous les audits du lot perdent leur `requestId`. Cela casse isolation, traçabilité et contrat d'audit.

### P2 — Importants

1. La limitation de débit prévue pour création d'organisation, invitation et changement de contexte n'est pas présente ; seul le login utilise `loginAttempts` (`server.js:40-42`, `:573-580`).
2. Le PATCH d'une membership ne revalide pas `defaultSiteId` dans le tenant alors que POST le fait (`server.js:630-632`), ce qui permet une référence incohérente même si elle ne confère pas directement un droit.
3. La validation d'O3 vérifie l'existence d'un administrateur global, mais aucun test ne démontre la couverture explicite/héritée de chaque site, les rôles effectifs ou la révocation du dernier administrateur.

### Couverture et preuves

- Handoff intégrateur : `node --check server.js` réussi et `npm test` annoncé **62/62** après correction de la chaîne v1→v2→v3 et de l'émission SSE Company.
- La QA préparatoire avait d'abord observé 55/62 et localisé ces deux défauts ; ils sont corrigés dans l'état inspecté.
- `tests/organization.test.js` couvre migration/backup de base, seed, création, rejet d'alias, O1 incomplet, création Site/Unité/Prestation, lecteur legacy, version, Origin, contexte, audit/SSE.
- Manquent des régressions automatisées pour chacun des P1 ci-dessus : rôle attribué/révoqué réellement effectif, scopes négatifs par relation, migration d'un viewer sans promotion ni seed, O2 post-production/laboratoire, gates aval, suspend/archive, remplacement de site, rejeu idempotent et audit du nouveau tenant avec `requestId`.
- Aucun handoff QA final daté n'était encore écrit dans `docs/qa-report.md` au moment du verdict ; le vert annoncé ne compense pas les cas contractuels absents.
- L'UX frontend, le focus, le responsive, la purge visuelle du contexte et les E2E navigateur restent hors du code backend livré et devront être revus dans leurs lots dédiés.

### Conditions de re-review

Corriger les sept P1, ajouter les tests négatifs correspondants, puis rejouer REVIEW et QA sur le même état. `APPROVED` exige zéro P0/P1 ; 62 tests verts avec ces chemins non couverts ne suffit pas.

Conformément au mandat, seul `docs/code-review.md` a été modifié.

---

## Vérification littérale finale — DTO techniques et événements recovery

Date : 2026-08-14  
Périmètre : dernier P1 de l'ultime re-review, limité aux DTO Client/Projet techniques et aux quatre noms de création recovery  
Nature : contrôle indépendant ciblé ; seul le présent rapport est modifié

### Verdict final SPEC

**APPROVED**

Aucun P0/P1 ne reste ouvert dans le périmètre SPEC Fondations 01 → 02 → 04 → 03.

### Preuves de fermeture du dernier P1

- Le Client technique de `docs/spec-project-planning-sequence.md:498-515` contient exactement `id`, `companyId`, `name`, `code`, `active`, `systemManaged`, `migrationPurpose`, `version`, `createdAt`, `updatedAt`, avec les valeurs canoniques `Reprise RC1`, `MIGRATION-RC1`, `true` et `rc1_project_backfill`. Il correspond champ pour champ à `docs/target-architecture-v1.md:97-112`.
- Le Projet technique de `docs/spec-project-planning-sequence.md:527-547` contient exactement `id`, `companyId`, `siteId`, `clientId`, `name`, `code`, `status`, `color`, `systemManaged`, `migrationPurpose`, `version`, `createdAt`, `updatedAt`, avec les valeurs canoniques. Aucun `scopeSiteId`, `technicalPurpose` ou autre champ de périmètre alternatif ne subsiste dans ce DTO.
- La cardinalité est explicite : un Client technique par `companyId` concerné et un Projet technique par couple `companyId`/`siteId`; le rattachement relit désormais `companyId` et `siteId` exacts (`docs/spec-project-planning-sequence.md:498`, `:527`, `:552`).
- Les créations emploient exclusivement les audits `client.recovery.created` et `project.recovery.created`, puis après commit les événements `client.recovery.created.v1` et `project.recovery.created.v1`, avec les payloads canoniques et `migrationId="foundation-04-projects-v4-to-v5"` (`docs/spec-project-planning-sequence.md:562-586`). Les anciens noms concurrents ne figurent plus dans le chemin de reprise.

### Conclusion

Le dernier P1 est fermé. Les cinq documents sont cohérents sur les identifiants immuables, `companyId`, les DTO/cardinalités de reprise, les audits/événements recovery et les deux permissions d'override. Le Gate REVIEW de la SPEC Fondations est **APPROVED** ; ce verdict autorise le passage au gate DEV selon l'ordre et les handoffs documentés, sans préjuger des gates code, QA, sécurité, performance, intégration ou release futurs.

Conformément au mandat, seul `docs/code-review.md` a été modifié.

---

## Statut contrôlant — extension fiscale postérieure

Le verdict `APPROVED` ci-dessus porte sur la baseline Fondations antérieure à l'extension fiscale. La revue indépendante postérieure intitulée **« Revue indépendante SPEC — extension fiscale Organisation 01 et fondation Devis »** dans le présent document contrôle cette extension : **CHANGES REQUIRED — 0 P0, 4 P1**. Aucun DEV fiscal ou Devis n'est autorisé avant fermeture et re-review de ces quatre constats.

---

## Re-review indépendante SPEC — extension fiscale corrigée

Date : 2026-08-14  
Périmètre revu : corrections apportées à `docs/spec-organization-01.md` pour migration fiscale, frontière Commercial/Finance et déterminisme monétaire/Devis  
Exclusion d'indépendance : `docs/ux-organization-01.md` n'est pas jugé dans cette passe, car le présent reviewer a rédigé sa correction

### Verdict SPEC fiscal corrigé

**APPROVED — 0 P0, 0 P1 dans le périmètre indépendamment revu.**

Les trois P1 de SPEC éligibles à cette re-review sont fermés. Le quatrième constat antérieur, relatif au contrat UX O1, exige une revue indépendante par un autre reviewer avant le DEV frontend ; il ne devient pas implicitement approuvé ici.

### Fermeture des constats

1. **Migration additive : FERMÉ.** `foundation-01-organization-v2-to-v3` est désormais déclaré historique, déjà exécuté et strictement immuable ; aucun champ fiscal, taux ou port n'y est rétro-injecté (`docs/spec-organization-01.md:421-425`). L'extension utilise le nouvel identifiant littéral `foundation-01b-organization-fiscal-v3`, avec préconditions sur schéma 3 et digest 01, absence des writers aval, sauvegarde, mutation atomique, audit de migration masqué, digest/comptages, idempotence et rollback dédiés tout en conservant `schemaVersion=3` (`:405-440`, `:448-450`). RES-02 exige explicitement le marqueur 01b (`:409-419`, `:554-560`). Ce contrat évite le rejeu ou la mutation sémantique de la migration historique.

2. **Owner et port Devis : FERMÉ.** Commercial 08 est nommé owner/writer des devis ; Finance 09a reste limité à la valorisation interne et n'est ni writer du snapshot ni autorité du taux fiscal (`docs/spec-organization-01.md:206-210`). `CompanyFiscalProfilePort.v1` publie une commande précise, un contexte d'autorité, une date fiscale civile, un fuseau résolu serveur, la sélection du taux par défaut ou l'override autorisé, puis un DTO de snapshot fermé (`:210-238`). Le handoff vers Commercial 08, ses erreurs et ses fixtures/tests sont explicites (`:246`, `:552-560`) et restent compatibles avec la responsabilité Devis du module 08 dans `docs/target-architecture-v1.md:75` et l'exclusion fiscale de Finance 09a dans `docs/spec-finance-analytics.md:15`.

3. **Déterminisme monétaire et fiscal : FERMÉ.** Le snapshot fixe adresse, identifiants ordonnés, `taxDate`, `taxTimezone`, version de profil, devise, exposant et version de catalogue, ainsi qu'un taux document unique ; les taux mixtes sont explicitement interdits dans ce premier lot (`docs/spec-organization-01.md:212-240`). Les exposants autorisés sont fermés à 0/2/3 ; les montants int64 non négatifs sont sérialisés en chaînes décimales, calculés en entier exact, contrôlés à chaque étape et refusés sur overflow (`:242-244`). La formule `floor((lineNetHt × rateBps + 5000) / 10000)` fixe l'arrondi half-up par ligne, puis les totaux sont la somme des lignes avec invariant TTC = HT + TVA. Les critères exigent exposants, demi-unité, somme multi-lignes, maximum int64 et overflow (`:497-503`). Deux writers conformes ne disposent plus de choix divergent sur ces points.

### Dépendances hors verdict

- La SPEC consigne encore que `docs/architecture-roadmap.md` doit intégrer le marqueur 01b avant intégration (`docs/spec-organization-01.md:419`). Cette mise à jour appartient à l'owner Architecture ; elle ne rouvre pas la décision de migration désormais non ambiguë, mais reste une condition d'intégration documentaire.
- La correction d'UX O1 et du plan QA doit recevoir un verdict indépendant. La présente re-review ne couvre ni leur qualité, ni le code, ni les migrations exécutées, ni les gates QA/sécurité/performance.

### Statut contrôlant

Le précédent statut **CHANGES REQUIRED — 0 P0, 4 P1** est remplacé, pour la SPEC fiscale corrigée et le périmètre ci-dessus, par **APPROVED — 0 P0, 0 P1**. Le DEV backend fiscal peut entrer au gate DEV selon le workflow ; le DEV frontend reste conditionné à la re-review UX indépendante.

Conformément au mandat, seul `docs/code-review.md` a été modifié ; `docs/project-status.md` reste à mettre à jour par l'intégrateur.

---

## Re-review indépendante UX — extension fiscale Organisation 01

Date : 2026-08-14  
Périmètre : `docs/ux-organization-01.md`, limité au parcours O1 fiscal, catalogue TVA, permissions/isolation, concurrence, audit/SSE, erreurs, accessibilité et aperçu fiscal du futur Devis  
Référence normative : `docs/spec-organization-01.md` dans son état fiscal **APPROVED**  
Indépendance : le reviewer n'a pas rédigé `docs/ux-organization-01.md` et n'a modifié ni cette UX ni la SPEC

### Verdict UX fiscal

**CHANGES REQUIRED — 0 P0, 2 P1.**

Le contrat UX ne doit pas entrer au DEV frontend tant que les deux divergences ci-dessous ne sont pas corrigées puis revues indépendamment.

### P1 — Bloquants avant DEV frontend

1. **Le sous-parcours O1 fiscal fermé n'est pas aligné sur l'ordre normatif.** La SPEC impose exactement `Identité légale` → `Territoire et statut fiscal` → `Identifiants structurés` → `Devise et taux par défaut` → `Validation`, avec `Suivant` piloté par la complétude serveur (`docs/spec-organization-01.md:252-256`, `:479`). L'UX décrit une page O1 par sections, puis regroupe tout le fiscal dans une seule section dont l'ordre est territoire → devise → statut → identifiants → taux (`docs/ux-organization-01.md:160-185`). Elle ne définit donc ni les cinq sous-étapes, ni leur verrouillage/progression, et place la devise avant les identifiants. Deux implémentations conformes au document UX pourraient contourner la séquence fermée exigée. Il faut décrire explicitement ces cinq sous-étapes dans cet ordre, leur action **Suivant**, leur restitution des `missingFields` et la conservation du brouillon entre sous-étapes.

2. **L'adresse publiée dans l'aperçu Devis possède une source alternative interdite par le snapshot canonique.** L'UX annonce « adresse légale ou de facturation retenue » (`docs/ux-organization-01.md:241-245`), alors que `CompanyFiscalProfilePort.v1` retourne exactement l'adresse légale principale `registeredOfficeAddress` et exclut toute source implicite (`docs/spec-organization-01.md:212-238`). Cette alternative peut faire prévisualiser une donnée qui ne sera pas figée par Commercial 08. L'aperçu doit nommer et afficher uniquement le siège légal principal validé ; il peut rester partiel et en lecture seule, mais ne doit proposer ou suggérer aucune adresse de facturation distincte.

### Contrôles conformes sans P0/P1 supplémentaire

- **Champs O1 :** `taxCountry`, `currency`, `vatStatus`, `taxIdentifiers[]` structurés et `defaultVatRateId` sont présents ; SIREN/SIRET et TVA conditionnelle sous `FR@1` sont explicités, les anciens scalaires ne sont ni affichés ni envoyés (`docs/ux-organization-01.md:164-195`).
- **Catalogue TVA :** code, libellé, `rateBps`, période semi-ouverte, état, version, chevauchement, remplacement atomique du défaut et création d'une nouvelle période sont couverts. Le taux français à 20 % est une proposition clairement modifiable, jamais une constante (`:195`, `:226-239`).
- **Permissions et isolation :** les quatre permissions fiscales restent indépendantes de `organization.manage`; listes, relations, changement de contexte et refus inter-tenant sont non révélateurs (`:228-239`, `:493-505`).
- **Versions, audit et SSE :** `version` et `fiscalProfileVersion`, comparaison sans fusion automatique, audits masqués et invalidations fiscales après succès sont décrits. Les événements d'un autre `companyId` sont ignorés et ne deviennent pas une autorité de données (`:247-260`, `:475-491`).
- **Erreurs et accessibilité :** erreurs reliées aux champs, résumé avec focus, refus neutres, conservation de saisie, clavier, reflow, contrastes, annonces et masquage accessible sont spécifiés (`:247-258`, `:475-489`, `:507-544`).
- **Aperçu Devis :** hors écart d'adresse ci-dessus, le panneau exige `fiscalProfile.read`, reste en lecture seule et n'offre ni lignes, ni calcul HT/TVA/TTC, ni override ; l'immuabilité future est expliquée (`:241-245`, `:505`, `:559`).

### Condition de re-review

Corriger uniquement le séquencement explicite des cinq sous-étapes O1 et la source `registeredOffice` de l'aperçu, puis refaire une passe indépendante ciblée. Aucun test runtime n'a été exécuté : il s'agit d'une revue documentaire UX/SPEC. Conformément au mandat, seul `docs/code-review.md` a été modifié ; `docs/project-status.md` reste à mettre à jour par l'intégrateur.

---

## Re-review UX fiscale ciblée — fermeture des deux P1

Date : 2026-08-14  
Périmètre : corrections de `docs/ux-organization-01.md` relatives au stepper interne O1 et à l'adresse du snapshot Devis  
Nature : revue documentaire indépendante ; le reviewer n'a modifié ni l'UX, ni la SPEC, ni le code applicatif

### Verdict UX final

**APPROVED — 0 P0, 0 P1.**

Les deux P1 de la revue UX fiscale précédente sont fermés. Aucun nouveau constat bloquant n'est relevé dans le périmètre ciblé.

### Preuves de fermeture

1. **Stepper O1 exact et fermé : CORRIGÉ.** Le document définit explicitement un stepper interne distinct contenant exactement cinq sous-étapes dans l'ordre normatif `Identité légale` → `Territoire et statut fiscal` → `Identifiants structurés` → `Devise et taux par défaut` → `Validation` (`docs/ux-organization-01.md:162-172`). Une seule sous-étape est modifiable ; la suivante reste visible et verrouillée jusqu'à validation serveur. Une erreur bloque la progression, le retour sur une étape validée est permis, mais toute modification la repasse à valider et reverrouille toutes les suivantes (`:174`).

2. **Ordre de la devise : CORRIGÉ.** La devise appartient exclusivement à la sous-étape 4, après acceptation serveur des identifiants structurés en sous-étape 3 (`docs/ux-organization-01.md:201-217`). La règle responsive conserve ce même ordre et interdit explicitement de déplacer Devise avant Identifiants (`:510`).

3. **Validation et verrouillage aval : CONFORMES.** La sous-étape 5 est une synthèse ; seul le succès de la complétude serveur termine O1 et déverrouille O2. Les `missingFields` rouvrent la première sous-étape concernée, reverrouillent les suivantes et replacent le focus sur l'erreur (`docs/ux-organization-01.md:221-223`). Les critères UI reprennent exactement ces comportements, y compris l'interdiction d'un accès direct de contournement (`:548-551`).

4. **Source d'adresse du snapshot : CORRIGÉ.** L'aperçu du futur Devis utilise exclusivement l'adresse `registeredOffice` principale validée. Il exclut explicitement toute substitution par une adresse de facturation, opérationnelle ou secondaire (`docs/ux-organization-01.md:240-244`). Le critère UI et le scénario E2E exigent la même source, y compris lorsqu'une adresse de facturation distincte existe (`:558`, `:586`).

### Conclusion contrôlante

Le statut précédent **CHANGES REQUIRED — 0 P0, 2 P1** est remplacé, pour le périmètre UX fiscal ciblé, par **APPROVED — 0 P0, 0 P1**. Le contrat UX O1 peut entrer au gate DEV frontend sous réserve des autres gates et handoffs du dépôt. Aucun test runtime n'a été exécuté, la présente passe portant exclusivement sur la cohérence documentaire.

Conformément au mandat, seul `docs/code-review.md` a été modifié.

---

## Statut contrôlant — revue runtime Organisation 01 / 01b

La re-review UX documentaire ci-dessus approuve le contrat, pas son implémentation. Le verdict runtime postérieur consigné dans la section **« Revue indépendante finale runtime — Organisation 01 / 01b fiscal »** (`server.js` `9058ba9f…`, `app.js` `46a21e1e…`) contrôle le candidat courant : **CHANGES REQUIRED — 0 P0, 5 P1**. Les tests automatisés verts ne ferment pas ces constats. Une nouvelle re-review du code est requise après correction et couverture des cinq P1.

---

## Re-review indépendante finale runtime — fermeture Organisation 01 / 01b

Date : 2026-08-14  
Périmètre : `server.js`, `app.js`, `index.html`, `planning.css` et régressions Organisation 01/01b  
Empreintes : `server.js` `5e72c97cbaa42efc3d2fd805e76e2d21307cb4d5b81729b09b7f63d78e2ac82e`, `app.js` `bc7cff11e527652846a162d6fc048cde184b17f3db54f079c1f222f0d58ad1f9`, `index.html` `12e47ebf352face70fda1cc83307df1eb40ca62474d0715a7c86448fd6cf46fd`, `planning.css` `ed3613392c652c185a69f584235509dbaf167127e06d2ba8094476354e06aeff`  
Indépendance : le reviewer n'a modifié ni `server.js`, ni `app.js`, ni les actifs frontend revus

### Verdict runtime final

**APPROVED — 0 P0, 0 P1.**

Les cinq P1 runtime précédents sont fermés sur les empreintes ci-dessus. Ce verdict remplace le statut contrôlant `CHANGES REQUIRED — 0 P0, 5 P1` immédiatement antérieur uniquement pour ce candidat.

### Fermeture des cinq P1

1. **PATCH fiscal progressif : FERMÉ.** La mutation du profil ne requiert plus les identifiants ou le taux d'une sous-étape ultérieure lorsque seuls territoire et statut sont fournis. La régression d'une organisation fraîche valide ce contrat sans contourner la version ni la permission.

2. **Invalidation de policy et restitution UI : FERMÉ.** Un changement de pays/policy invalide les identifiants incompatibles, le taux par défaut et la validation fiscale (`server.js:789`). Le client recharge la complétude serveur, rattache les `missingFields` à la première sous-étape concernée et y replace le parcours (`app.js:88-89`, `app.js:142`, `app.js:149`).

3. **Autorité de validation fiscale : FERMÉ.** Toute modification fiscale remet `fiscalValidatedAt` et `fiscalValidatedBy` à `null`; seule la validation explicite de l'étape identité les renseigne et écrit l'audit `company.fiscalProfile.validated` (`server.js:746-747`, `server.js:789`).

4. **Exigences d'activité : FERMÉ.** Le consommateur actif de l'identité régénère `activityRequirements` à partir des activités soumises (`app.js:109`, `app.js:140`), sans réutiliser la collection devenue obsolète.

5. **Intégrité du marqueur 01b : FERMÉ.** Le marqueur porte un `integrityDigest` SHA-256 déterministe couvrant digest de sortie, policies et comptages ; le rejeu exige aussi la sauvegarde et le digest source (`server.js:247-273`, `server.js:302`). La falsification d'un `outputDigest` pourtant syntaxiquement valide est refusée avec `MIGRATION_MARKER_CONFLICT`.

### Contrôles transverses

- Les permissions effectives du login et du changement de société restent dérivées des memberships/rôles ; les permissions fiscales administrateur sont présentes et absentes du viewer.
- Les routes fiscales conservent RBAC, isolation non révélatrice, contrôle de version, audit attribué au tenant et invalidations SSE sans identifiants fiscaux.
- Les écritures DOM du parcours restent échappées par les helpers existants ; le stepper expose état courant/verrouillage, erreurs reliées et reprise de focus. Aucun nouveau défaut XSS ou accessibilité P0/P1 n'a été identifié.
- Du code frontend historique non actif conserve encore quelques anciens champs scalaires et une logique d'exigences antérieure. Il ne contrôle pas le binding runtime actuel ; son retrait ciblé est recommandé en **P2** afin de réduire le risque de réactivation accidentelle.

### Preuves exécutées

- `npm test -- tests/organization.test.js` : **30 réussis, 0 échec, 0 ignoré**, 6 035,07 ms.
- `npm test` : **81 réussis, 0 échec, 0 ignoré**, 6 069,39 ms.
- `node --check server.js`, `node --check app.js`, `node --check tests/organization.test.js` et `git diff --check` : succès.
- Environnement : Node v26.6.0, Darwin 25.5.0 arm64.

### Conclusion contrôlante

Le gate REVIEW runtime Organisation 01/01b est **APPROVED** sur les empreintes publiées, sans P0/P1 ouvert. Le P2 de nettoyage n'est pas bloquant et ne vaut pas approbation des gates Security, Performance, Integration, E2E ou Release, qui conservent leurs preuves propres. `docs/project-status.md` reste à actualiser par l'intégrateur conformément à la limite de fichiers de ce mandat.

---

## Re-review sécurité des DTO Organisation — fermeture du P1 fiscal

Date : 2026-08-14  
Candidat : `server.js` `a5807cf8a3a64d1b28959f78dde741cad453fca79b076746a4ec59b9d00e7d7c`, `tests/organization.test.js` `c6b3a53e8c3d59246dd24909daed9dd17b2b4d5dd5866c3c6af48279a045ba6f`  
Verdict : **APPROVED — 0 P0, 0 P1.**

Le DTO générique `companyDto` retire les identifiants et métadonnées fiscales ; les listes et détails société l'appliquent même lorsque l'appelant possède `fiscalProfile.read`. La route dédiée `/companies/:id/fiscal-profile` demeure l'unique surface de restitution et conserve son contrôle RBAC et son isolation. La régression exerce ce cas avec un viewer auquel seule la permission de lecture fiscale nécessaire est accordée.

Les erreurs optimistes ne réintroduisent pas cette fuite : PATCH, validation, activation, suspension et archivage passent désormais `companyDto` à `requireVersion`, de sorte que `409 VERSION_CONFLICT.details.current` reste filtré (`server.js:689`, `server.js:751-757`). Les réponses de succès de ces mutations sont également sérialisées par le DTO public.

Preuve disponible sur ce candidat : `npm test` exécuté indépendamment au gate Security, **82 réussis sur 82, 0 échec**, code 0. La tentative ciblée du présent reviewer a été bloquée par l'interdiction sandbox d'écouter sur loopback puis interrompue au niveau de l'autorisation ; elle n'est pas comptée comme preuve verte supplémentaire. Le contrôle syntaxique de `tests/organization.test.js` et `git diff --check` réussissent.

Ce verdict ferme le P1 de divulgation fiscale sur les DTO génériques et les détails de conflit. Il ne modifie pas les limites Performance, Integration, E2E et Release.

---

## Gate REVIEW indépendant — Commercial 08 / Projet, Budget, Devis et Planning

Date : 2026-08-16  
Candidat : `server.js` `cb3aea8d3b7c06f20b7dd38037bc4647ff076f208b49ade1be6afbd250206c1b`, `app.js` `adadb12811959fa2da5f07412909d8713bdea4a0284491ec452037b091a59f16`, `planning.css` `39dd4614c30b500c284f1c12b06a2662524e6b2d82e1c4dd173fbd4346c0ff01`, `tests/quotes.test.js` `9079cba3e0d09e7f906111aa6a51ba21d42a9385900f0803bdecb2fac9444bad`  
Références : prompt maître Commercial 08 complet, `AGENTS.md`, `docs/spec-quotes-postproduction.md`  
Indépendance : aucun fichier applicatif ou test n'a été modifié par le reviewer

### Verdict

**CHANGES REQUIRED — 0 P0, 9 P1.**

La suite verte confirme l'absence de régression déjà couverte, mais plusieurs exigences centrales peuvent être contournées ou ne sont pas implémentées. Le lot ne peut pas passer au gate QA tant que ces P1 ne sont pas corrigés et couverts.

### P1 — Bloquants release

1. **Le rattachement direct d'une réservation contourne la protection contre la double facturation.** `linkBookingsToQuoteLine` ne recherche les doublons que dans le document courant (`server.js:920-921`) et la route `POST /quotes/:id/lines/:lineId/bookings` l'appelle sans prévisualisation ni confirmation inter-document (`server.js:1216-1217`). Reproduction : importer une réservation dans un premier devis, créer un second devis du même projet, puis appeler cette route sur une ligne du second ; la liaison réussit sans `COMMERCIAL_DOUBLE_BILLING_CONFIRMATION_REQUIRED` ni trace `duplicateConfirmed`. Le contrôle existe uniquement sur `/import-reservations` (`server.js:1212-1214`). Le test direct `tests/quotes.test.js:110-113` ne couvre pas le cas inter-document.

2. **La priorité tarifaire `projet > client > catalogue` n'est pas respectée.** `rateForSource` fait un simple `.find()` parmi les taux projet ou globaux et ne comporte aucun niveau client (`server.js:898`). L'ordre du tableau peut donc faire gagner un taux catalogue sur un taux projet ; un tarif client ne peut jamais être choisi. `quoteLineFromInput` consomme directement ce résultat (`server.js:912-915`). Les tests vérifient seulement qu'un tarif catalogue existe (`tests/quotes.test.js:171-177`), sans matrice de priorité.

3. **La conversion Budget → Devis est absente.** Il n'existe ni route, ni commande UI, ni test de conversion ; Budget et Devis sont seulement stockés dans deux collections. Le workflow obligatoire doit créer un nouveau Devis à partir d'un Budget sans détruire ni transformer le Budget source, avec snapshot et lien de traçabilité. Une recherche des commandes de conversion dans `server.js`, `app.js` et `tests/quotes.test.js` ne retourne aucune implémentation.

4. **Les remises commerciales ne sont pas modélisées ni calculées.** La liste fermée des champs d'une ligne omet tout champ de remise (`server.js:907-915`), les calculs et totaux n'en tiennent pas compte (`server.js:917`), et l'espace de travail ne permet ni saisie ni restitution de remise (`app.js:345`). Cela empêche les remises par ligne/section demandées et rend impossible un PDF client conforme sur ce point.

5. **L'historique de versions n'est ni numéroté correctement ni consultable.** `captureCommercialVersion` réutilise le maximum existant au lieu de l'incrémenter : après la première capture, tous les enregistrements gardent le même `versionNumber` (`server.js:897`). En outre, l'unique endpoint d'historique retire systématiquement `snapshot` et aucun endpoint de détail ne permet de relire une version antérieure (`server.js:1225-1226`). Le test actuel entérine même `snapshot === undefined` sans vérifier la séquence (`tests/quotes.test.js:171-177`). Les V1/V2/V3 et avenants ne sont donc pas auditables comme documents immuables.

6. **Le PDF client n'est pas une restitution fidèle et immuable du document.** Il relit le nom du projet et du client dans les collections vivantes au lieu d'utiliser un snapshot commercial (`server.js:932`) : une modification ultérieure change le PDF régénéré d'un devis envoyé/accepté. Il tronque aussi silencieusement à 32 lignes (`server.js:933`) alors que l'API en autorise 500 (`server.js:1223`) ; les totaux portent alors sur plus de lignes que le détail affiché. Les remises, conditions, zone de validité/signature et sous-totaux attendus ne sont pas produits. Le test PDF ne contrôle que l'en-tête, `TOTAL HT` et l'absence de coûts/marges (`tests/quotes.test.js:193-196`).

7. **Des données commerciales et internes sont exposées sans permission `quote.read`.** Le résolveur RBAC ne classe comme commercial que `/quotes*` et `/quote-catalog` (`server.js:1002-1004`). Par conséquent `/rate-cards` retourne notamment `costUnitMinor` sans permission Devis (`server.js:1188`), `/projects/:id/dashboard` retourne coûts et marges (`server.js:1233`), et `/reservations/:id/commercial-links` est autorisé par `planning.read` puis révèle numéros/statuts de documents (`server.js:1239`). Un rôle personnalisé authentifié, dans le tenant mais privé de `quote.read`, peut consulter ces informations. Aucun test négatif de permission ne couvre ces trois routes.

8. **La sélection commerciale par en-tête de jour inclut des réservations invisibles.** Le gestionnaire sélectionne toutes les réservations de `state.bookings` contenant la date, sans appliquer le projet, le site, le statut ni les filtres de la matrice visible (`app.js:331`). Un clic sur une colonne affichée peut donc préparer/importer des réservations masquées, potentiellement d'un autre projet ; l'erreur n'apparaît qu'à la prévisualisation serveur. La sélection par ressource s'appuie, elle, sur les cellules DOM visibles. Ce décalage rend la sélection jour dangereuse et non conforme au principe « ce qui est sélectionné visuellement est importé ».

9. **Le cycle bidirectionnel et les contrôles UI restent incomplets.** Aucune commande API/UI ne délie une réservation d'une ligne ; l'acceptation d'un devis lié ne propose pas la confirmation explicite des réservations prévue ; l'espace ligne fixe toujours le détail sur `quote.lines[0]` et ne rend pas les autres lignes sélectionnables (`app.js:345`). Enfin les boutons Nouveau Budget/Devis des onglets et les actions statut/version/avenant sont injectés sans garde `quote.manage` (`app.js:342`, `app.js:360`, `app.js:366`), contrairement aux cartes projet (`app.js:341`). Le serveur refuse les mutations non autorisées, mais l'interface ne respecte pas les permissions visibles ni le parcours clavier attendu.

### Contrôles conformes dans l'état inspecté

- Budget et Devis sont bien des types/collections distincts ; créer un document ne crée pas de réservation.
- Les mutations de ligne et de statut utilisent le contrôle optimiste `version`; la création de document possède une clé d'idempotence liée à l'acteur et au tenant.
- Les statuts `sent` et `accepted` bloquent les mutations de contenu, et les successeurs sont de nouveaux brouillons avec identifiants distincts.
- Le snapshot fiscal vérifie organisation/site, permission d'override TVA, applicabilité du taux et copie les données légales (`server.js:881-892`). Les calculs monétaires utilisent `BigInt`, bornes int64 et arrondi half-up (`server.js:868-879`); coût et marge restent absents du PDF.
- Les routes principales Devis appliquent auth, CSRF/Origin, `quote.read`/`quote.manage`, isolation société/site, audit puis SSE après écriture. Les événements SSE ne transportent pas le détail monétaire.
- Les trois modes d'import et la prévisualisation inter-document existent sur `/import-reservations`; les écarts Devis/Planning sont calculés sans synchronisation silencieuse.
- La sélection Booking, le clic droit et `Maj+F10` existent. Aucun P0/P1 statique supplémentaire n'est relevé sur l'alignement des lignes, le fond week-end, le cadre Aujourd'hui ou le login. Leur comportement visuel réel reste à démontrer en E2E navigateur.

### Preuves exécutées

- `node --check server.js` : succès.
- `node --check app.js` : succès.
- `node --test tests/quotes.test.js` : **25 réussis, 0 échec, 0 ignoré**, environ 531 ms.
- `npm test` : **122 réussis, 0 échec, 0 ignoré**, 6 437,68 ms.
- `git diff --check` : succès.
- Environnement : Node v26.6.0, Darwin arm64.

### Tests manquants avant re-review

- double liaison inter-document via la route `/lines/:lineId/bookings`, avec refus puis confirmation traçable ; déliaison et absence de suppression du Planning ;
- priorité de taux projet/client/catalogue, override manuel, taux inactif et isolation client ;
- conversion Budget → Devis, conservation du Budget, snapshots/versionNumbers successifs et relecture exacte de chaque version ;
- remises ligne/section, arrondis/overflow après remise, marge et totaux PDF ;
- PDF de plus de 32 lignes, données projet/client modifiées après envoi, conditions/validité/signature et absence de toute donnée interne ;
- rôles personnalisés sans `quote.read` sur rate cards, dashboard et liens commerciaux ; références client/site inter-tenant lors du PATCH Projet ;
- sélection jour avec filtres projet/site/statut, sélection d'une ligne autre que la première, visibilité des actions en lecture seule et parcours clavier/focus ;
- acceptation avec réservations liées et confirmation explicite, audit/SSE/idempotence des nouvelles commandes ;
- E2E navigateur sur login, alignement ressource/cellule, week-ends, cadre Aujourd'hui, clic droit clavier/souris, responsive et persistance après rechargement.

### Condition de re-review

Corriger les neuf P1 et ajouter les cas négatifs correspondants, puis rejouer REVIEW et tous les gates aval impactés sur la même empreinte. Le vert **122/122** ne vaut pas approbation de comportements absents ou non exercés. Conformément au mandat, seul `docs/code-review.md` a été modifié ; `docs/project-status.md` reste à actualiser par l'intégrateur.

---

## Re-REVIEW indépendante Commercial 08 — fermeture des neuf P1

Date : 2026-08-16  
Candidat : `server.js` `b948492386cb4eb835bde53877d2346136996893fe58d5bbc4724a8e702559e4`, `app.js` `77696c3bdc2e4e9fc40d71152b6685d7c96bda77f86cd08efb536385e5d07ce2`, `planning.css` `3f1dc03e58e83dfbbea00a47c57a188e96428fd12ab0fa31f9b9d771831f81be`, `tests/quotes.test.js` `1b950f3cc1b2ff3abdb55d4705acae817ced8e5a57ea775ef8e683de095aa1ef`  
Références : prompt maître Commercial 08, `AGENTS.md`, `docs/spec-quotes-postproduction.md` et constats du gate REVIEW précédent  
Indépendance : aucun code, actif frontend, test ou spécification n'a été modifié par le reviewer

### Verdict final REVIEW

**APPROVED — 0 P0, 0 P1.**

Les neuf P1 du verdict précédent sont fermés sur les empreintes ci-dessus. Deux observations P2 d'accessibilité/présentation restent à traiter sans bloquer le passage au gate QA ; l'E2E navigateur demeure un gate aval distinct.

### Statut des neuf P1

1. **Liaison directe et double facturation : FERMÉ.** La liaison directe recherche désormais les liens des autres documents, exige `confirmDuplicateBookingIds` et retourne `COMMERCIAL_DOUBLE_BILLING_CONFIRMATION_REQUIRED` en son absence (`server.js:937-940`, `server.js:1236-1237`). La décision est conservée dans `line.linkTrace` et l'audit. La déliaison dédiée recalcule l'état de la ligne sans modifier la réservation (`server.js:1238-1239`). Le test `tests/quotes.test.js:261-267` démontre refus, confirmation, audit et Planning inchangé.

2. **Priorité tarifaire et override manuel : FERMÉ.** `rateForSource` ordonne explicitement projet, client puis catalogue et départage par version (`server.js:915`). La route de création de tarif valide tenant, source, projet/client exclusifs, montants et permissions (`server.js:1206`). Une saisie de prix explicite devient `priceOrigin="manual"` avec acteur/date/origine antérieure (`server.js:929-932`). Les tests `:270-278` exercent les trois niveaux, le taux inactif, l'override et une référence client invalide.

3. **Conversion Budget → Devis : FERMÉ.** `POST /quotes/:budgetId/convert-to-quote` exige version, permission, CSRF et clé d'idempotence ; il crée une nouvelle identité dans `quotes`, conserve le Budget, copie ses snapshots et lignes, inscrit `sourceBudgetId`, version initiale, audit et SSE (`server.js:1221-1222`). Le test `:281-285` vérifie conservation et rejeu idempotent.

4. **Remises exactes : FERMÉ.** La remise de ligne en points de base est calculée en `BigInt`, half-up avant TVA (`server.js:889-895`), stockée avec son motif et intégrée à la marge (`server.js:924-932`). La remise document, son montant TVA séparé et les totaux sont recalculés sans flottants (`server.js:934`). Les routes et l'UI couvrent remise ligne/document, conditions et validité (`server.js:1212-1216`, `server.js:1252`, `app.js:369-373`). Les tests incluent demi-unité et résultat multi-lignes (`tests/quotes.test.js:61-63`, `:281-289`).

5. **Versions et snapshots accessibles : FERMÉ.** `captureCommercialVersion` incrémente strictement le maximum (`server.js:914`), la migration renumérote les historiques de façon déterministe (`server.js:251-262`) et la route de détail retourne le snapshot seulement après contrôle du document, du tenant et de l'identifiant de version (`server.js:1247-1250`). L'UI Historique charge la liste puis le détail échappé (`app.js:372`). Le test obtient `[1, 2]` et relit le contenu complet de V1 (`tests/quotes.test.js:286-287`).

6. **PDF multipage, fidèle au snapshot et sans données internes : FERMÉ.** Le PDF refuse un document sans snapshot commercial, utilise uniquement `fiscalSnapshot`, `commercialSnapshot` et les champs figés du document, parcourt toutes les lignes, pagine, puis restitue remises, HT/TVA/TTC, conditions, validité et signature (`server.js:948-952`). Il ne sérialise aucun coût ou champ de marge. Les tests vérifient plus de 32 lignes, pagination, projet live modifié non repris, contenu commercial et absence de coûts/marges (`tests/quotes.test.js:193-200`, `:281-289`).

7. **RBAC et isolation des surfaces adjacentes : FERMÉ.** `/rate-cards`, `/projects/:id/dashboard` et `/reservations/:id/commercial-links` exigent maintenant `quote.read`; `/rates` exige `quote.manage` en écriture (`server.js:1019-1021`). Les filtres société/site restent appliqués par les handlers. Un rôle personnalisé limité à `planning.read` reçoit 403 sur les trois lectures (`tests/quotes.test.js:300-304`), et les références client/site étrangères d'un projet sont rejetées.

8. **Sélection Planning visible : FERMÉ.** Le handler d'en-tête de jour reconstruit la sélection à partir des seuls `[data-select-booking]` présents dans les cellules DOM visibles de cette date (`app.js:377-378`), comme la sélection ressource. Les filtres et le projet actif ne peuvent plus introduire silencieusement des bookings masqués.

9. **Cycle bidirectionnel, acceptation, panneau et permissions UI : FERMÉ pour P0/P1.** La déliaison est exposée dans le panneau sélectionné et préserve le Planning (`app.js:374`). L'acceptation liée demande puis transmet la liste exacte des bookings, tandis que le serveur bloque toute liste incomplète et audite la confirmation (`app.js:363`, `server.js:1223-1224`). Les lignes deviennent sélectionnables au clic, à Entrée et Espace et pilotent le panneau (`app.js:374-376`). Les contrôles de mutation sont retirés sans `quote.manage`, y compris dans les onglets Projet (`app.js:376`, `app.js:379-380`); le serveur reste l'autorité.

### P2 — Importants non bloquants

1. **Ligne sélectionnée visuellement ambiguë.** La règle historique `.quote-lines-panel tbody tr:first-child` continue de surligner systématiquement la première ligne (`planning.css:55`) tandis que `.is-selected` surligne la ligne réellement choisie (`planning.css:63`). Après sélection d'une autre ligne, deux lignes paraissent actives. Remplacer la règle `:first-child` par le seul état `.is-selected`.

2. **Focus clavier incomplet sur les lignes et le menu contextuel.** Les lignes reçoivent `tabIndex=0`, mais la règle de focus Commercial ne couvre que boutons, liens et champs (`planning.css:46`) : le focus du `<tr>` n'est pas explicitement visible. En outre, `Échap` ferme le menu Planning sans restaurer le focus à l'élément déclencheur (`app.js:324-326`). Ajouter un style `tr[data-quote-line-row]:focus-visible` et mémoriser/restaurer le déclencheur du menu.

### Preuves exécutées

- `node --check server.js` : succès.
- `node --check app.js` : succès.
- `node --test tests/quotes.test.js` : **32 réussis, 0 échec, 0 ignoré**, 835,20 ms.
- `npm test` : **129 réussis, 0 échec, 0 ignoré**, 6 367,77 ms.
- `git diff --check` : succès.
- Environnement : Node v26.6.0, Darwin arm64.
- Tentative de contrôle UI avec le skill navigateur local : aucun navigateur n'était connecté/disponible. Aucun résultat visuel ou E2E n'est donc revendiqué ; les observations UI de cette revue reposent sur l'inspection des handlers, du DOM produit et des styles. Le smoke navigateur reste explicitement dû au gate E2E.

### Conclusion contrôlante

Le statut précédent **CHANGES REQUIRED — 0 P0, 9 P1** est remplacé, pour ce candidat et ces empreintes, par **APPROVED — 0 P0, 0 P1**. Toute modification ultérieure de `server.js`, `app.js`, `planning.css` ou des contrats Commercial invalide cette approbation jusqu'à revalidation. Conformément au mandat, seul `docs/code-review.md` a été modifié ; la mise à jour de `docs/project-status.md` appartient à l'intégrateur.

---

## Re-review ciblée — finition des deux P2 UI Commercial 08

Date : 2026-08-17  
Candidat : `server.js` `d2b8860e00fbb62759cba7398c2a785c618b7bbcb478f1368a8d58162a2c7753`, `app.js` `3d1aa2eec1a227f866de70d8d6cced7bace11b7b2797be4d7151360b06558c17`, `planning.css` `10d881ae348f1ae6052a4c82cc905b0fe5296a996fa0fef7b8c1973c137ea2df`, `tests/quotes.test.js` `d6fb8bd2fe8603d4e4be2b2612ac2fe3f519741df3feafb408b4342611101bb9`  
Périmètre : état neutre et sélection explicite des lignes Devis ; focus clavier et menu contextuel Planning ; non-régression Planning/login/Devis  
Indépendance : aucun code, style ou test modifié

### Verdict

**CHANGES REQUIRED — 0 P0, 1 P1.**

La finition introduit une exception bloquante à l'ouverture d'un document sans sélection explicite. Le P2 de surlignage implicite reste également ouvert. Les suites Node vertes ne couvrent pas l'exécution DOM de ce chemin.

### P1 — Régression bloquante

1. **L'état neutre fait échouer le binding de l'espace Devis.** Dans `bindCommercial` (`app.js:376`), la branche sans ligne sélectionnée contient `else quotesModule.selectedLineId=nulldocument.querySelectorAll(...)`. `nulldocument` est un identifiant inexistant. Le nouveau wrapper (`app.js:382`) initialise précisément `selectedLineId` à `null` lorsqu'aucun choix explicite n'existe, puis appelle ce binding : l'ouverture initiale d'un devis avec des lignes lève donc `ReferenceError: nulldocument is not defined` avant l'installation des handlers de lignes. Le panneau neutre est produit dans le HTML, mais l'écran n'est pas fonctionnel et aucune ligne ne peut ensuite être sélectionnée.

   Correction attendue : séparer explicitement l'affectation `quotesModule.selectedLineId = null;` de `document.querySelectorAll(...)`, puis ajouter un test DOM/comportemental qui ouvre un devis sans sélection, constate le panneau neutre, sélectionne une ligne au clic et au clavier, et vérifie l'absence d'exception.

### Statut des deux P2

1. **Première ligne sélectionnée implicitement : OUVERT.** Le nouvel état mémorisé par document, le panneau neutre et les attributs `aria-selected="false"/"true"` vont dans le bon sens. Cependant l'ancienne règle `.quote-lines-panel tbody tr:first-child` subsiste dans `planning.css:55` et applique toujours fond et barre violette à la première ligne, indépendamment de `.is-selected`. La première ligne paraît donc active avant tout choix et deux lignes peuvent paraître actives après sélection d'une autre. La règle `.is-selected` de `planning.css:63` ne neutralise pas ce style historique.

2. **Focus clavier et restauration du menu : PARTIELLEMENT FERMÉ.** `tr[data-quote-line-row]:focus-visible` fournit désormais un contour explicite. Le menu mémorise le déclencheur exact pour clic droit via la capture `contextmenu`, et pour `Maj+F10` via l'élément actif ; `closePlanningContextMenu()` restaure ce déclencheur avec `focus({ preventScroll: true })` après Échap ou clic extérieur tant qu'il reste connecté. Les handlers d'action passent également par cette fermeture, mais certaines actions enchaînent immédiatement un changement de route, un `render()` ou l'ouverture du drawer qui déconnecte le déclencheur ou déplace volontairement le focus. Un test DOM doit fixer le comportement attendu pour chaque sortie, particulièrement « Effacer la sélection » et les actions de navigation. Ce point reste P2 et n'est pas la cause du verdict bloquant.

### Régressions et couverture

- Aucun nouveau P0/P1 backend, Planning métier ou login n'a été trouvé dans l'inspection ciblée ; les tests existants restent verts.
- Le test UI de `tests/quotes.test.js:351-365` est uniquement textuel (`assert.match`). Il confirme la présence de symboles/styles mais n'exécute ni `bindCommercial`, ni la sélection, ni la restitution réelle du focus. Il laisse donc passer le `ReferenceError` et la règle `:first-child` contradictoire.
- Tests manquants : ouverture réelle d'un Devis avec zéro sélection ; état visuel initial sans classe ni style implicite ; clic/Entrée/Espace sur une autre ligne avec unicité de `.is-selected` et `aria-selected`; focus visible ; retour exact après Échap, clic extérieur et chaque action du menu ; smoke login → planning → devis.

### Preuves fraîches

- `node --check server.js` : succès.
- `node --check app.js` : succès ; cette commande valide la grammaire mais ne résout pas les identifiants au runtime.
- `node --test tests/quotes.test.js` : **34 réussis, 0 échec, 0 ignoré**, 2 403,62 ms.
- `npm test` : **131 réussis, 0 échec, 0 ignoré**, 6 522,88 ms.
- `git diff --check` : succès.
- Environnement : Node v26.6.0.

### Condition de re-review

Corriger le `ReferenceError`, supprimer le style `:first-child` implicite et ajouter une preuve DOM ciblée des états/focus. Le gate REVIEW ne peut revenir à **APPROVED** qu'après revalidation sur les nouvelles empreintes. Seul `docs/code-review.md` a été modifié ; l'intégrateur reste owner de `docs/project-status.md`.

---

## Re-review finale — correctif UI Commercial 08

Date : 2026-08-17  
Candidat : `server.js` `d2b8860e00fbb62759cba7398c2a785c618b7bbcb478f1368a8d58162a2c7753`, `app.js` `51a60fa544995ed39bdb6a8d30b25dfc1a49479f612360bf1fb46c2441e148e0`, `planning.css` `2cd4c6a5ed1b109dc33aeb0780e13b2eef8ab6e68fbc43c15402a294ee1aaeb6`, `tests/quotes.test.js` `d322de70e36288f854ac0a70b86610029a90a4a7a36e51e3e2ba89b57d3d710f`  
Indépendance : aucun code, style ou test modifié

### Verdict final contrôlant

**APPROVED — 0 P0, 0 P1. Les deux P2 UI sont fermés.**

- **Binding sans sélection et panneau neutre : FERMÉ.** `app.js:376` sépare maintenant correctement `quotesModule.selectedLineId = null;` de l'itération DOM. Il n'existe plus aucune occurrence de `nulldocument`. Le wrapper explicite initialise l'état à `null`, conserve le panneau « Sélectionnez une ligne », retire toute classe active et pose `aria-selected="false"`; clic, Entrée ou Espace enregistrent ensuite le choix par document, appliquent l'unique `.is-selected`, mettent à jour `aria-selected` et rendent le détail.
- **Surlignage implicite : FERMÉ.** La règle historique `.quote-lines-panel tbody tr:first-child` a disparu de `planning.css`. Le fond et la barre violette ne sont produits que par `tr[data-quote-line-row].is-selected` (`planning.css:63`).
- **Focus clavier et menu Planning : FERMÉ.** Les lignes ont un `:focus-visible` explicite. Le déclencheur du menu est mémorisé depuis l'événement capturé pour le clic droit ou depuis l'élément actif pour `Maj+F10`; la fermeture par Échap, clic extérieur ou handler d'action passe par `closePlanningContextMenu()` et restaure ce déclencheur exact avec `focus({ preventScroll: true })` lorsqu'il est encore connecté. Les actions ouvrant un drawer ou changeant de route transfèrent ensuite légitimement le focus vers la nouvelle vue.
- **Régressions : aucune P0/P1 nouvelle trouvée.** Les chemins Planning, login et Devis couverts par la suite restent verts. La preuve UI ajoutée verrouille aussi l'absence littérale de `nulldocument` et de la règle `:first-child`, ainsi que la présence des états et du focus.

### Preuves fraîches

- `node --check server.js` : succès.
- `node --check app.js` : succès.
- `node --test tests/quotes.test.js` : **34 réussis, 0 échec, 0 ignoré**, 2 444,52 ms.
- `npm test` : **131 réussis, 0 échec, 0 ignoré**, 6 893,69 ms.
- `git diff --check` : succès.
- Environnement : Node v26.6.0.

Ce verdict remplace le **CHANGES REQUIRED — 0 P0, 1 P1** de la re-review immédiatement précédente pour les seules empreintes ci-dessus. Le smoke navigateur complet reste du ressort du gate E2E ; aucun défaut P0/P1 n'est ouvert au gate REVIEW. Seul `docs/code-review.md` a été modifié, conformément au mandat.

---

## Gate REVIEW indépendant — Clients 05

Date : 2026-08-17  
Candidat : `server.js` `f10765451609ba8001ffc17911391ebc0d71afa0e227a5f03d0d445e64693cc9`, `app.js` `eca9729ce84607d3a58b2b7abfae14b92cb2958c4f90151f7d3473de82c9e0a5`, `planning.css` `44022c414a04498d706dbe0e33eaff986ab93e8ce0f878109f69898f72f47004`, `tests/clients.test.js` `a7247ad96cadf2279e8295dbc8175e28490bcedb7cbe2c16ff953eb75ed42a22`, spécification `317bd38489f454eeed59d11bcc9410ac03c3ca95f55bab68ad5302b5acafef1d`  
Périmètre : comptes/contacts, grille XLSX, tarification, consommateurs Devis/snapshot/PDF, UI Clients et non-régression générale  
Indépendance : aucun code, style ou test modifié

### Verdict

**CHANGES REQUIRED — 0 P0, 3 P1.**

La suite est verte, mais trois critères explicites restent enfreints et ne sont pas couverts par les tests Clients.

### P1 — bloquants release

1. **La création d'un contact n'est pas réellement idempotente.** Dans `server.js:1588`, `requireVersion({ version: input.clientVersion }, client)` est exécuté avant `clientCommandMarker(...)`. La première création incrémente la version du client ; le rejeu strict de la même requête et de la même `Idempotency-Key`, avec le même corps, échoue donc en `409 VERSION_CONFLICT` avant de consulter le marqueur, au lieu de restituer le contact créé sans duplication. Le contrat impose l'idempotence des créations. Déplacer la détection/restitution du marqueur avant le contrôle de version, tout en conservant le conflit si la clé porte un corps différent, et ajouter le rejeu exact au test.

2. **Un prix manuel catalogue ou sans tarif contourne `quote.overridePrice`.** `quoteLineFromInput` (`server.js:1113`) ne refuse un prix modifié que si `protectedRate = rate && (rate.projectId || rate.clientId)` est vrai. Un planificateur sans permission peut donc remplacer un tarif catalogue, ou saisir librement un prix lorsqu'aucun tarif n'existe. `docs/spec-clients-05.md:16` qualifie toute saisie manuelle d'override réservé à `quote.overridePrice`. Le test actuel (`tests/clients.test.js:29`) ne couvre que le remplacement d'un tarif client. La permission et la trace doivent s'appliquer à toute valeur manuelle différente du prix résolu, quelle que soit son origine.

3. **Les téléphones démesurés sont acceptés par troncature silencieuse.** `clientInput` (`server.js:1183-1188`) et `clientContactInput` (`server.js:1190-1193`) passent l'entrée dans `cleanString(..., 40)` avant toute validation de longueur ; aucune erreur n'est ajoutée pour une source dépassant 40 caractères. Une valeur surdimensionnée est donc enregistrée tronquée alors que le critère d'acceptation 2 exige son refus. Ajouter une validation sur l'entrée non tronquée et des cas compte/contact qui attendent `422 VALIDATION_ERROR` avec le champ `phone`.

### P2 — importants non bloquants après correction des P1

1. **Le fichier confirmé est écrit avant la mutation sérialisée.** Dans `server.js:1594`, `storeClientPlanningFile(preview._file)` précède `mutate(...)`. Une version devenue obsolète dans la file d'écriture, ou un échec de persistance JSON, laisse un fichier privé orphelin sans `clientRateImport`, grille, audit ni mécanisme de nettoyage. Le fichier reste non public et en mode `0600`, ce qui limite l'impact, mais la confirmation devrait coordonner fichier et enregistrement ou supprimer le fichier nouvellement créé en cas d'échec.

2. **La couverture UI Clients reste textuelle.** `tests/clients.test.js:22` cherche des chaînes dans `app.js` sans exécuter le DOM. Elle ne prouve pas le focus initial du drawer, le parcours clavier de la liste/preview, la confirmation de suppression ni le rendu XSS. L'inspection montre l'emploi cohérent de `esc`/`inputValue`, des libellés accessibles, une confirmation explicite et des règles `:focus-visible`, sans P0/P1 statique identifié ; une preuve navigateur demeure néanmoins requise au gate E2E.

3. **L'ajout asynchrone des contacts au drawer Devis n'est pas rattaché au projet initial.** `app.js:494` vérifie seulement que l'éditeur actif est encore de type `quoteCreate`. Si un second drawer Devis est ouvert avant la résolution du premier `GET`, la réponse ancienne peut alimenter la liste du nouveau projet. Le serveur refuse ensuite un contact hors client, donc il n'y a pas de corruption, mais l'UI peut proposer un contact incohérent. Capturer l'identifiant projet/client et l'instance d'éditeur avant injection.

### Contrôles conformes observés

- Isolation société par `companyId` de session et `404` inter-tenant ; mutations protégées par CSRF/origine, `client.manage`, versions, audit, puis SSE après succès.
- CRUD comptes/contacts, suppression logique et conservation des snapshots historiques ; sélection de contact contrôlée contre le client du projet.
- Prévisualisation XLSX sans écriture persistante, validation des lignes retenues au commit, stockage opaque privé (`0700`/`0600`) et rejeu idempotent de l'import sans duplication.
- Résolution tarifaire `projet > client > catalogue`, snapshot contact profondément copié dans les versions commerciales, et consommateur PDF basé sur le snapshot plutôt que sur le contact vivant.
- Données Clients échappées dans les principaux rendus ; aucune régression P0/P1 Planning, login ou PlanyBot détectée par l'inspection et la suite complète.

### Tests manquants déterminants

- rejeu exact de création contact avec même clé/corps/version initiale, puis conflit même clé/corps différent ;
- refus `422` d'un téléphone de plus de 40 caractères sur compte et contact ;
- refus d'un prix manuel catalogue et d'un prix manuel sans tarif pour un rôle sans `quote.overridePrice`, avec trace/audit pour le rôle autorisé ;
- échec concurrent/versionné du commit XLSX sans fichier orphelin ;
- assertions audit/SSE Clients, isolation des contacts et import, et rendu PDF contenant le snapshot contact ancien après modification/suppression ;
- smoke DOM clavier/XSS du module Clients et sélection contact Devis.

### Preuves fraîches

- `node --check server.js` : succès.
- `node --check app.js` : succès.
- `node --test tests/clients.test.js` : **9 réussis, 0 échec, 0 ignoré**, 499,92 ms.
- `node --test tests/quotes.test.js` : **40 réussis, 0 échec, 0 ignoré**, 2 798,78 ms.
- `npm test` : **160 réussis, 0 échec, 0 ignoré**, 6 641,61 ms.
- `git diff --check` : succès.
- Environnement : Node v26.6.0, Darwin arm64.

Ce verdict porte uniquement sur les empreintes ci-dessus. Toute correction revient en DEV puis exige une re-review ciblée et les gates aval. Conformément au mandat, seul `docs/code-review.md` est modifié ; l'intégrateur reste owner de `docs/project-status.md`.

---

## Re-review indépendante — correctifs Clients 05

Date : 2026-08-18  
Candidat : `server.js` `20848828f3d67b7bc693cc45cd5fa1f2d740c64972ca9c2cfa00ac253a72618e`, `app.js` `eca9729ce84607d3a58b2b7abfae14b92cb2958c4f90151f7d3473de82c9e0a5`, `planning.css` `44022c414a04498d706dbe0e33eaff986ab93e8ce0f878109f69898f72f47004`, `tests/clients.test.js` `81c8d19694cb8dd59fcfcbeb3cf57e53446dd694693bd53b02431df5b5810e3e`, `tests/quotes.test.js` `34836dc5101349de86bc4588e88e6b46f346524625d4b64c7979ca4e6d2c2046`, spécification `7f798893ad959b6b0a7eace3e5bd4dc57d696a32d3c1b5af91188e0bdf497f1d`  
Indépendance : aucun code, style ni test modifié

### Verdict contrôlant

**CHANGES REQUIRED — 0 P0, 2 P1.**

Les P1 contact et téléphone sont fermés. La protection serveur des prix couvre maintenant toutes les origines, mais le contrat du motif reste permissif et l'interface actuelle n'est pas compatible avec cette protection. Les suites vertes n'exécutent pas les handlers DOM concernés.

### Statut exact des trois P1 précédents

1. **Replay POST contact : FERMÉ.** Dans `server.js:1588`, le marqueur est recherché sous la mutation sérialisée avant `requireVersion`. Un rejeu exact revalide le tenant, le client et l'entité enregistrée, renvoie `200`, n'émet pas de nouvel événement et ne modifie ni le nombre de contacts ni la version du client. Une même clé avec un autre corps reste refusée en `409`. `tests/clients.test.js:25` vérifie le `200`, l'identité, l'absence de doublon et l'absence de nouveau bump de version.

2. **Permission d'override sur toutes les origines : PARTIELLEMENT FERMÉE.** `server.js:1113` applique désormais `quote.overridePrice` à toute valeur `unitPriceMinor` explicitement saisie lors d'une création, ainsi qu'à toute altération d'une ligne existante, y compris catalogue ou absence de grille ; l'omission du prix conserve correctement la résolution automatique `projet > client > catalogue`. Les traces et audits sont présents. Deux écarts P1 restent toutefois décrits ci-dessous.

3. **Téléphone supérieur à 40 caractères : FERMÉ.** `clientInput` et `clientContactInput` contrôlent maintenant la longueur de l'entrée avant que la valeur tronquée puisse être acceptée et renvoient `422 VALIDATION_ERROR` avec `phone`. `tests/clients.test.js:24-25` couvre compte et contact, avec absence de mutation du contact.

### P1 — bloquants release

1. **Le serveur n'exige pas réellement le champ dédié `priceOverrideReason`.** `server.js:1113` calcule `priceOverrideReason = cleanString(input.priceOverrideReason, 200) || cleanString(input.discountReason, 200)`. Une requête peut donc altérer manuellement un prix en omettant `priceOverrideReason` et faire accepter le motif d'une remise comme justification de prix. Cela confond deux décisions commerciales distinctes et ne respecte pas la revalidation demandée « `quote.overridePrice` + `priceOverrideReason` pour toute saisie/altération manuelle ». Exiger le champ dédié pour `priceChanged`; conserver `discountReason` uniquement pour la remise. Ajouter un test négatif où seul `discountReason` est fourni avec un prix manuel.

2. **Les parcours UI qui transmettent un prix ne fournissent pas le motif requis et certains forcent inutilement un override.** L'empreinte `app.js` n'a pas changé depuis la revue précédente :
   - `submitPlanningCommercialPreview` (`app.js:341`) construit chaque `lineAdjustment` avec `unitPriceMinor`, initialisé à `0`, sans `priceOverrideReason` ;
   - `submitQuoteImport` (`app.js:366`) transmet toujours le « prix provisoire » sans motif ;
   - une ligne libre dans `submitQuoteLine` (`app.js:384`) transmet nécessairement `unitPriceMinor`, mais le drawer ne propose qu'un « Motif de remise », pas un motif d'override ; une modification de prix catalogue suit le même problème.

   Avec le contrat serveur corrigé, un planificateur reçoit `403` et un administrateur `422 QUOTE_PRICE_OVERRIDE_REASON_REQUIRED`; les imports planning et l'ajout normal de lignes libres deviennent donc inutilisables. Pour les prix non modifiés, l'UI doit omettre `unitPriceMinor` afin de laisser le serveur résoudre automatiquement le tarif. Pour une saisie réellement manuelle, elle doit afficher un champ distinct, requis, transmettre `priceOverrideReason` et tenir compte de `quote.overridePrice`. Ajouter des tests DOM/API couvrant les trois parcours.

### Compensation fichier import

**FERMÉE statiquement.** `storeClientPlanningFile` retourne maintenant `created` et `destination`. Le stockage est déplacé dans la mutation après la seconde vérification de version (`server.js:1594`), puis le fichier nouvellement créé est supprimé si la mutation ou l'écriture atomique échoue. Un fichier préexistant de même digest n'est pas supprimé. Le test Clients vérifie qu'une version obsolète ne crée aucun fichier supplémentaire. Une injection d'échec d'`atomicWrite` reste souhaitable pour couvrir directement la branche de compensation, mais aucun P0/P1 résiduel n'est identifié sur ce point.

### P2 restant — contacts asynchrones entre drawers

**OUVERT.** `app.js:494` ne vérifie que `activeStockEditor?.kind === 'quoteCreate'` au retour du `GET /contacts`. Une réponse lente du premier projet peut donc injecter ses contacts dans un second drawer Devis ouvert entre-temps. Le serveur refuse finalement un contact qui n'appartient pas au client du second projet, empêchant la corruption ; l'utilisateur voit néanmoins une sélection erronée. Capturer et comparer l'instance d'éditeur ainsi que les identifiants projet/client avant l'injection.

### Preuves fraîches

- `node --check server.js` : succès.
- `node --check app.js` : succès.
- `node --test tests/clients.test.js` : **9 réussis, 0 échec, 0 ignoré**, 557,64 ms.
- `node --test tests/quotes.test.js` hors sandbox après un essai sandbox refusé par `listen EPERM` : **40 réussis, 0 échec, 0 ignoré**, 2 617,20 ms.
- `npm test` : **160 réussis, 0 échec, 0 ignoré**, 6 665,59 ms.
- `git diff --check` : succès.
- Environnement : Node v26.6.0, Darwin arm64.

Ce verdict remplace le **CHANGES REQUIRED — 0 P0, 3 P1** précédent pour les empreintes ci-dessus. La correction des deux P1 revient en DEV puis exige une re-review ciblée et les gates aval. Seul `docs/code-review.md` a été modifié ; `docs/project-status.md` reste à la charge de l'intégrateur.

---

## Re-review finale — Clients 05

Date : 2026-08-18  
Candidat : `server.js` `375b30f87e9f926a330d722853661dce04b700e8f5fc0cabc224deb6a86bfbb3`, `app.js` `fe68c40f8262aa2028398ee15a5787a17de1fb6e614dcb6cf0335b2319953229`, `planning.css` `44022c414a04498d706dbe0e33eaff986ab93e8ce0f878109f69898f72f47004`, `tests/clients.test.js` `628222b8cb83fe920cc85ad4b4688f7d38c7886b648836ecae3e81a684015d99`, `tests/quotes.test.js` `8ad71ffa9e7d8b8a12009ac5fba6e24c4e65928d6ab7f23a5bec1b1fb1c2e593`, spécification `66257a659cd4356961e5491d6b94f725a1bf62b66671c87648de526f6da4346d`  
Indépendance : aucun code, style ni test modifié

### Verdict terminal

**APPROVED — 0 P0, 0 P1.**

Les deux P1 de la re-review précédente sont fermés sur les empreintes ci-dessus. Aucun nouveau P0/P1 n'a été identifié dans le périmètre Clients 05 et ses consommateurs Devis/Planning.

### Fermeture des deux P1

1. **Motif d'override dédié : FERMÉ.** `quoteLineFromInput` (`server.js:1113`) ne reprend plus `discountReason` comme solution de repli. Toute création portant explicitement `unitPriceMinor`, ou toute altération de la valeur existante, exige d'abord `quote.overridePrice`, puis un `priceOverrideReason` nettoyé d'au moins trois caractères. Le prix automatique reste obtenu en omettant le champ. La trace `manualPriceTrace` conserve acteur, date, origine précédente et motif ; les audits de création, ajout, modification et import reprennent le motif. Le test Clients vérifie aussi que `discountReason` seul reçoit `422 QUOTE_PRICE_OVERRIDE_REASON_REQUIRED`, tandis qu'un override autorisé est tracé.

2. **Intégration UI des prix : FERMÉE.** Les trois parcours utilisent désormais `manualPriceOverridePayload` :
   - la prévisualisation Planning → Commercial présente un prix vide « Tarif automatique » et n'ajoute `unitPriceMinor`/`priceOverrideReason` à un `lineAdjustment` qu'après une saisie manuelle motivée ;
   - l'import Planning dans un Devis laisse également le prix vide par défaut et omet les deux champs ;
   - l'éditeur de ligne mémorise le tarif résolu, omet le prix si la valeur affichée est inchangée, et exige le motif dédié pour une ligne libre ou un prix réellement différent.

   Le motif de remise demeure un champ séparé et n'alimente jamais le motif d'override. Un contrôle direct du helper confirme : champ vide → `{}`, tarif résolu inchangé → `{}`, prix modifié sans motif → erreur, prix modifié motivé → `{ unitPriceMinor, priceOverrideReason }`.

### Anti-race contacts

**FERMÉ.** `app.js:495` capture l'objet éditeur, le projet et un `contactsRequestToken` unique. La réponse asynchrone n'est injectée que si l'éditeur est toujours le même objet, reste de type `quoteCreate`, porte le même token et concerne encore le même projet. La garde évite aussi une seconde insertion si `contactId` existe déjà. Une réponse tardive d'un premier drawer ne peut donc plus alimenter le suivant.

### Limites non bloquantes

- Les assertions UI dans `tests/clients.test.js` et `tests/quotes.test.js` restent majoritairement structurelles/textuelles. Le helper de payload a été exécuté directement pendant cette revue, mais un test DOM des trois soumissions et un test à promesses contrôlées de la course contacts renforceraient la non-régression.
- Le smoke navigateur complet, le focus et le rendu visuel restent dus au gate E2E ; aucun défaut P0/P1 statique ou API n'est ouvert ici.

### Preuves fraîches

- `node --check server.js` : succès.
- `node --check app.js` : succès.
- `node --test tests/clients.test.js` : **9 réussis, 0 échec, 0 ignoré**, 715,71 ms.
- `node --test tests/quotes.test.js` : **40 réussis, 0 échec, 0 ignoré**, 3 050,16 ms.
- `npm test` : **160 réussis, 0 échec, 0 ignoré**, 7 349,77 ms.
- Contrôle direct `manualPriceOverridePayload` : quatre cas conformes (vide, automatique inchangé, motif absent refusé, override motivé).
- `git diff --check` : succès.
- Environnement : Node v26.6.0, Darwin arm64.

Ce verdict remplace le **CHANGES REQUIRED — 0 P0, 2 P1** immédiatement précédent pour les seules empreintes ci-dessus. Toute modification ultérieure du candidat invalide cette approbation jusqu'à revalidation. Conformément au mandat, seul `docs/code-review.md` a été modifié ; `docs/project-status.md` reste à la charge de l'intégrateur.

---

## Revue ciblée post-smoke — bouton de soumission Clients 05

Date : 2026-08-18  
Candidat : `server.js` `375b30f87e9f926a330d722853661dce04b700e8f5fc0cabc224deb6a86bfbb3`, `app.js` `98468a3bf0641ff824d093f60a6745c75425acc42088ea95faf267b1c0089a14`, `tests/clients.test.js` `bf15dee6d3600b02a97265c04aef165640159f1bd96f7a4b2a02ba19d95e3555`  
Indépendance : aucun code ni test modifié

### Verdict

**APPROVED — 0 P0, 0 P1.**

- `openClientAccountDrawer` et `openClientContactDrawer` réinitialisent explicitement `stockDrawerSubmit.disabled = false` avant d'afficher le formulaire. Un drawer d'import qui avait volontairement désactivé le bouton tant qu'aucun fichier n'était sélectionné ne peut donc plus rendre inopérants les drawers compte/contact suivants.
- La réinitialisation est bornée à l'ouverture de ces deux formulaires et ne change ni route, payload, permission visible ou autorité serveur. Les handlers de soumission désactivent toujours le bouton pendant la requête et le réactivent en `finally`, ce qui préserve la protection ordinaire contre le double clic.
- Sécurité : aucun contrôle n'est contourné ; les mutations restent soumises à l'authentification, `client.manage`, CSRF/origine, isolation société et versions côté serveur. Réactiver un contrôle UI n'accorde aucun droit.
- Accessibilité : le bouton natif redevient atteignable et activable au clavier dans le nouveau contexte ; le focus initial demeure placé sur `name` ou `firstName`. Aucun changement de libellé, ordre de tabulation ou annonce d'erreur n'est introduit.
- Le test source ajouté vérifie la présence de la réinitialisation dans chacune des deux fonctions. Une assertion DOM de la séquence import → compte/contact renforcerait encore la preuve, mais aucune régression P0/P1 n'est identifiée.

### Preuves fraîches

- `node --check app.js` : succès.
- `node --check server.js` : succès.
- `node --test tests/clients.test.js` : **9 réussis, 0 échec, 0 ignoré**, 657,63 ms.
- `npm test` : **160 réussis, 0 échec, 0 ignoré**, 7 159,42 ms.
- `git diff --check` : succès.
- Environnement : Node v26.6.0, Darwin arm64.

Ce verdict couvre le correctif post-smoke sur les empreintes ci-dessus et maintient l'approbation Clients 05. Toute modification ultérieure requiert une nouvelle revalidation. Seul `docs/code-review.md` a été modifié ; `docs/project-status.md` reste à la charge de l'intégrateur.

---

## Gate REVIEW G1 indépendant — Sprint 1 S1-A à S1-D

Date : 2026-08-20  
Reviewer : agent indépendant `g1_review`  
Périmètre : spécification Sprint 1, migrations, référentiels, tarification, recherche universelle, analytics, OpenAPI, RBAC/scopes, erreurs, accessibilité, régressions et couverture de tests.  
Indépendance : aucun code, test ou autre document modifié.

### État candidat contrôlé

- `server.js` : `0d4403f2b8dfd4974db1683f72d45dcf99ece4e8577603cce2255e3a0f2936c9`
- `app.js` : `e7eabad40b1bb1c1cc574097652488cc7fcf56d7cfb1e25ad0dc5fc097a1013f`
- `docs/api/openapi.yaml` : `ae7306d63e6c44b6c162d95e6bbc5272a0e8038ccf776f6efad3cdac02a4850a`
- `tests/sprint1-data.test.js` : `5253e5d1727bdb29e3b707f180adca3ab616bae22254591fc256399592bee33d`
- `packages/pricing/index.js` : `6e458205bbbc39258748975c10654446855640928ea6a94c2a61fb98ec764eb5`
- `packages/auth/rbac.js` : `e6aa33135071ec694ca9d22141df3e508511505907419470425307eff70137ae`

Les quatre empreintes contractuelles publiées dans `docs/project-status.md` correspondent aux fichiers relus. Le dépôt ne possède cependant aucun commit de référence et tous les fichiers apparaissent non suivis ; la revue a donc été figée par empreintes et non par diff Git reproductible.

### Verdict

**CHANGES REQUIRED — 0 P0, 6 P1.**

Les tests exécutés sont verts, mais six écarts bloquants empêchent d'approuver les critères G1. Le candidat doit retourner en DEV, puis repasser REVIEW et tous les gates aval affectés sur de nouvelles empreintes.

### Constats P1 — bloquants

#### P1-1 — Le contrat Client canonique Sprint 1 n'est pas implémenté

La spécification §4.1 / US-007 impose notamment `currency`, `paymentTermsDays`, `billingTerms` et une adresse de facturation canonique. Dans `server.js`, `clientInput` conserve uniquement les champs historiques d'adresse aplatis et `assertAllowedFields` rejette les nouveaux champs ; `paymentTermsDays` n'existe pas dans l'implémentation. Le schéma Client Sprint 1 correspondant est également absent de l'OpenAPI et les tests n'exercent ni création ni modification avec ce contrat.

Impact : le référentiel Client G1 ne peut pas devenir la source de vérité attendue pour la devise et les conditions commerciales.

Correction attendue : implémenter le contrat serveur et OpenAPI, la compatibilité/migration documentée, les validations et des tests positifs/négatifs incluant persistance et isolation.

#### P1-2 — Les responsabilités obligatoires du Projet ne sont ni structurées ni validées

La spécification §4.2 / US-008 exige `salesOwnerId`, `projectManagerId` et `planningOwnerId`, chacun désignant un membre actif de la même société, en plus de `clientId` et `siteId`. `server.js` accepte encore `salesOwner`, `projectManager` et `planningOwner` sous forme de chaînes libres ; aucune validation de membre actif ou de tenant n'est appliquée. Le test Sprint 1 crée volontairement un projet sans ces responsabilités et attend `201`. L'OpenAPI expose lui aussi le champ historique `planningOwner` plutôt que les trois identifiants.

Impact : l'accountability G1 et l'isolation des références de responsabilité ne sont pas garanties.

Correction attendue : introduire les identifiants canoniques, rejeter les membres absents/inactifs/étrangers et couvrir création, modification et erreurs stables.

#### P1-3 — La hiérarchie Site → Catégorie → Ressource est absente

La spécification §2.1, §4.3 / US-010 exige un référentiel de catégories de ressources. Aucun modèle, stockage, endpoint ou schéma OpenAPI `resourceCategories` n'existe. `compatibleResourceCategoryIds` accepte par ailleurs des chaînes qui ne sont pas résolues contre une catégorie existante de la même société.

Impact : une brique référentielle obligatoire de G1 manque et des compatibilités pendantes ou inter-tenant peuvent être enregistrées.

Correction attendue : fournir le référentiel catégoriel, ses scopes société/site, son archivage et ses contrôles de références, avec tests CRUD, multi-site, références étrangères et archivées.

#### P1-4 — La résolution tarifaire runtime peut ignorer un tarif valide et le scope d'une grille peut être contourné

Deux défauts touchent le cœur US-013/US-014 :

1. Dans `rateForSource`, le runtime sélectionne d'abord le scope prioritaire, puis filtre l'unité demandée. Un tarif Projet d'une autre unité peut donc masquer un tarif Catalogue valide pour l'unité demandée et produire un tarif manquant. Le moteur `packages/pricing` filtre l'unité avant la priorité : les deux autorités divergent.
2. `createRateCommand` vérifie que la grille est accessible, mais pas que son scope concorde avec `clientId`/`projectId`. Une grille Client peut ainsi recevoir un tarif sans `clientId`, ensuite interprété comme Catalogue par le résolveur runtime.

Impact : prix absent/erroné et pollution possible du catalogue global par un tarif créé sous une grille restreinte.

Correction attendue : conserver une autorité de résolution unique, filtrer date et unité avant la priorité, imposer la cohérence grille/scope/références et ajouter des tests de repli multi-unité et de mismatch de scope.

#### P1-5 — La recherche universelle expose les Clients sans permission objet

La spécification §6 et §8 exige l'application des permissions avant scoring. La famille Client de `universalSearch` vérifie le tenant et l'éligibilité de l'entité, mais pas `client.read`/`client.manage`, contrairement aux autres familles. Une preuve directe avec `effectivePermissions: []` retourne malgré tout le nom et le code d'un client. Le test actuel utilise principalement un administrateur et ne vérifie pas l'absence des clients pour un rôle sans permission Client.

Impact : un utilisateur authentifié sans droit Client peut découvrir des métadonnées Client.

Correction attendue : filtrer la famille avant scoring selon la permission serveur canonique et ajouter des tests de non-divulgation, y compris avec identifiants devinés et scopes site/société.

#### P1-6 — Aucun rollback Sprint 1 sûr n'est fourni

La spécification §9 et les critères G1 imposent backup, validation d'intégrité et rollback empêchant toute restauration destructive après des écritures post-migration. Les migrations produisent des sauvegardes et marqueurs, mais aucun mécanisme `rollbackSprint1...`, commande contrôlée, validation des digests courants ou garde contre les écritures ultérieures n'existe pour Sprint 1. Le rollback présent concerne un autre lot commercial.

Impact : le contrat de migration/rollback G1 n'est pas démontrable et une restauration manuelle pourrait perdre des écritures réalisées après migration.

Correction attendue : fournir un rollback explicite, local et audité avec contrôles d'intégrité/écritures postérieures, procédure documentée et tests de succès, refus et données altérées.

### Constats P2 — importants non bloquants isolément

1. **OpenAPI divergent des validations runtime.** `RateSurcharge.adjustmentBps` est documenté `0..10000` alors que le serveur accepte aussi les ajustements négatifs et une borne haute différente. `RateCreate.sourceType` documente `manual`/`freeLine`, non acceptés par le serveur, et omet `stockItem`, accepté par le serveur. Le Projet OpenAPI conserve les responsabilités historiques.
2. **Accessibilité de la recherche incomplète.** Le dialogue modal ne piège pas la tabulation ; la sélection au clavier ne fournit ni identifiants d'option ni `aria-activedescendant`, ce qui limite l'annonce de l'option active par les technologies d'assistance.
3. **Route morte dupliquée.** Un second bloc `POST /api/v1/rates`, inatteignable après le handler actif, reste dans `server.js` et augmente le risque de dérive du contrat.
4. **Couverture insuffisante sur les risques ci-dessus.** Manquent notamment : contrat Client canonique, responsables étrangers/inactifs, catégories, fallback tarifaire multi-unité, mismatch grille/scope, recherche Client sans permission, rollback/tamper et cas temporels DST. Le contrôle annoncé des six familles de recherche n'en attend que cinq et omet une ressource non-personne.
5. **Preuves de performance partielles.** Les benchmarks sont très largement sous les seuils, mais appellent les fonctions métier directement et ne mesurent pas la route HTTP avec auth/persistance. Le benchmark analytics utilise huit dimensions de regroupement et omet `resourceId`.
6. **Traçabilité du candidat fragile.** Sans commit suivi, les empreintes permettent ce contrôle ponctuel mais pas une revue de diff ni une intégration/release reproductible. Cet état devra être corrigé avant la release.

### Points conformes relevés

- La migration existante est idempotente dans les scénarios couverts, conserve une sauvegarde et protège l'intégrité de l'artefact de backup.
- Les instantanés tarifaires et l'état explicite de tarif manquant sont présents dans les parcours couverts.
- Les agrégats analytics respectent le scope société/site dans les tests actuels.
- Les suites ciblées et complète sont vertes sur les empreintes relues.
- Les mesures directes de recherche et analytics sont très inférieures au budget de 300 ms sur les jeux de données fournis.

### Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `npm run lint` : succès.
- `npm run build` : succès, 5 actifs runtime contrôlés.
- `node --test tests/sprint1-data.test.js` : **8 réussis, 0 échec, 0 ignoré**, 590,78 ms. Une première exécution dans le sandbox a produit 8 erreurs `listen EPERM` d'environnement ; la réexécution autorisée hors sandbox est intégralement verte.
- `npm test` : **203 réussis, 0 échec, 0 ignoré**, 7 945 ms.
- `npm run benchmark:search` : 250 ressources, 10 000 réservations, 40 projets, 500 itérations ; p50 0,271 ms, p95 0,377 ms, max 0,470 ms.
- `npm run benchmark:analytics` : 1 000 budgets, 1 000 devis, 2 000 lignes, 8 dimensions, 220 itérations ; p50 11,505 ms, p95 12,357 ms, max 15,161 ms.
- Preuve fonctionnelle directe : `universalSearch` avec `effectivePermissions: []` retourne un Client du tenant, confirmant P1-5.
- Contrôle source : absence confirmée de `paymentTermsDays`, `projectManagerId`, `planningOwnerId`, collection `resourceCategories` et rollback Sprint 1.

### Handoff

Seul `docs/code-review.md` est modifié par cette revue. L'intégrateur doit faire refléter le verdict **Bloqué / retour DEV** dans `docs/project-status.md`. Après correction des P1, une nouvelle revue indépendante devra porter sur les nouvelles empreintes ; les anciens verdicts REVIEW ne couvriront pas le candidat corrigé.

---

## Re-REVIEW G1 indépendante — candidat post SEC-G1-02

Date : 2026-08-20  
Reviewer : agent indépendant `g1_review`  
Indépendance : aucun code, test ou autre document modifié.  
Candidat contrôlé :

- `server.js` : `fe7e034b83cae5c78589f2c880f772877244a7b112c81cd56314107de8585923`
- `app.js` : `10d2bae71697f94bd7e9c0373957e4f5e41e0f96a2c06099a93add5fa38acc82`
- `docs/api/openapi-v1.yaml` : `b89516da6101806c96e9f4a2655b56e0d7ed2a3d9e55fa06b455f73c1d40966a`
- `tests/sprint1-data.test.js` : `a9ac012e9e07e502ea2406b7a9f694aff102bceed27b3bd07725e3c65ed680e1`

### Verdict terminal

**CHANGES REQUIRED — 0 P0, 4 P1.**

La correction SEC-G1-02 est conforme et les défauts tarifaires/recherche initiaux sont fermés. Quatre invariants contractuels restent cependant contournables par les consommateurs API/UI ou par le rollback. Le candidat ne peut donc pas recevoir `APPROVED` malgré ses 207 tests verts.

### Fermetures confirmées

1. **SEC-G1-02 — FERMÉ.** Le marqueur `sprint-1-contracts-v2` protège toujours son intégrité, son backup et son `outputDigest`, mais le rejeu contrôle désormais des invariants structurels avec `sprint1ContractsStateValid` au lieu de comparer les valeurs Client métier modifiables à leur projection d'origine. Le test modifie les conditions et l'adresse Client, confirme leur persistance, puis altère le digest du marqueur et obtient bien `MIGRATION_MARKER_CONFLICT`.
2. **Tarifs — FERMÉ pour les deux P1 initiaux.** `rateForSource` filtre l'unité avant la priorité ; `createRateCommand` impose la concordance entre scope de grille et références Projet/Client. Les cas négatifs ciblés passent.
3. **Recherche Client — FERMÉ.** La famille Client est désormais conditionnée par `client.read` ou `client.manage` avant scoring ; le test sans permission retourne zéro résultat.
4. **Responsables Projet — FERMÉ sur le point initial.** Les trois identifiants sont persistés et validés contre un utilisateur et une adhésion actifs de la même société.

### P1 — bloquants

#### P1-1 — Le contrat Client ne respecte pas la devise par défaut de la société

`clientInput` ne reçoit pas la société et utilise systématiquement `EUR` lorsque la devise est omise. L'UI de création sélectionne également `EUR` par défaut. Or §4.1 impose la devise de la société comme valeur par défaut et une devise prise en charge par son profil. Une organisation en GBP ou dans une autre devise peut donc créer un Client en EUR sans décision explicite. La validation accepte par ailleurs tout code connu globalement sans le confronter au profil de la société.

Le runtime diverge aussi de son OpenAPI : `BillingAddress` y exige `line1`, `postalCode`, `city` et `country`, tandis que le serveur ne rend obligatoire que le pays.

Impact : le référentiel Client peut porter une devise/une adresse différente du contrat canonique, puis alimenter incorrectement les futurs documents commerciaux.

Correction attendue : résoudre le défaut depuis la société active côté serveur, valider la politique de devise, aligner l'UI et l'OpenAPI, et ajouter des tests multi-société ainsi qu'un cas d'adresse incomplète.

#### P1-2 — Un Projet sans Site et les aliases de statut legacy restent acceptés

§4.2 exige `siteId`. `validateProjectCommand` ne contrôle le Site que si `project.siteId` est truthy ; l'OpenAPI omet `siteId` de la liste `required` et le formulaire professionnel `openProjectCreateDrawer` ne propose aucun Site. Un Projet créé par cette interface est donc persisté sans Site. En parallèle, `projectFields` continue à accepter `status` et à le convertir via `canonicalProjectStatus`, alors que la spécification interdit tout nouvel alias legacy en écriture.

Impact : le Projet, pivot des Budgets/Devis/Planning, peut être dépourvu du scope Site nécessaire à l'isolation et à l'affectation des ressources ; son cycle canonique peut encore être contourné par le contrat historique.

Correction attendue : rendre `siteId` obligatoire serveur/OpenAPI/UI, rejeter les Sites inactifs/étrangers, n'accepter que `lifecycleStatus` pour les nouvelles écritures et couvrir les cas absents/legacy.

#### P1-3 — La chaîne Site → ResourceCategory → Ressource n'est pas préservée après création

La création d'une Ressource contrôle sa catégorie, mais les consommateurs de mise à jour rompent l'invariant :

- `patchResource` ne prend pas `resourceCategoryId` dans le nouvel état et permet de modifier `type` ou `siteId` sans vérifier que la catégorie existante reste active, du même Site et du même type ;
- la réaffectation automatique des Ressources lors du remplacement d'un Site modifie uniquement `resource.siteId`, sans recréer/résoudre une catégorie du Site cible ;
- `validateChild(..., 'serviceOffering')` vérifie seulement que `compatibleResourceCategoryIds` est non vide, sans résoudre les identifiants contre des catégories actives de la société. Une valeur pendante ou étrangère satisfait donc la compatibilité.

Impact : les écritures post-migration peuvent immédiatement rendre faux l'invariant que `sprint1ContractsStateValid` exige au démarrage suivant, provoquer un blocage `MIGRATION_MARKER_CONFLICT` et rendre les compatibilités Planning non fiables.

Correction attendue : centraliser la validation catégorielle sur création, modification et remplacement de Site ; vérifier les catégories de Prestation ; ajouter des tests de changement Site/type, catégorie inactive/étrangère et réaffectation.

#### P1-4 — Le rollback n'exige ni les quatre marqueurs présents ni toujours un export

`rollbackSprint1Migrations` appelle les fonctions de migration avant de vérifier les marqueurs. Si `sprint-1-contracts-v2` est supprimé, la fonction le recrée en mémoire puis poursuit la restauration au lieu de refuser l'état altéré. Un probe temporaire a confirmé `accepted: true` avec un export après suppression de ce marqueur.

La condition `if (!exportFile && options.allowDataLoss !== true)` fournit en outre un contournement non audité : le probe `rollbackSprint1Migrations({ allowDataLoss: true })` a restauré les données avec `exportFile: null`. Le README affirme pourtant que l'export est exigé et le statut DEV annonce un « export de reprise obligatoire ». Aucun artefact ne prouve une autorisation explicite du PO pour ce chemin destructif.

Impact : un rollback peut masquer un marqueur manquant ou supprimer toutes les écritures post-migration sans export de reprise, contrairement à §9.

Correction attendue : valider d'abord la présence et l'intégrité des quatre marqueurs sans appliquer de migration ; rendre l'export inconditionnel dans le chemin normal et isoler toute éventuelle procédure de perte sous une autorisation explicite, traçable et testée. Ajouter les tests marqueur absent, backup/digest altéré et absence d'export.

### P2 — importants non bloquants isolément

1. L'OpenAPI tarifaire reste divergent : `RateSurcharge.adjustmentBps` documente `0..10000` au lieu de `-10000..100000`, et `RateCreate.sourceType` documente `manual/freeLine` tout en omettant `stockItem`.
2. Le référentiel `ResourceCategory` expose seulement lecture/création ; aucun parcours explicite de modification ou d'archivage logique n'est fourni malgré `active` et `version`.
3. Le dialogue de recherche ne piège pas la tabulation et ne fournit pas `aria-activedescendant` pour l'option active.
4. Les tests Sprint 1 ne couvrent pas les mutations qui produisent P1-1 à P1-3, ni les deux chemins rollback négatifs du P1-4. La recherche annoncée sur six familles continue de ne pas attendre explicitement une Ressource non-personne.
5. Le dépôt reste sans commit de référence et entièrement non suivi ; les empreintes rendent cette relecture ponctuelle possible, mais pas une intégration/release reproductible.

### Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `npm run lint` : succès.
- `npm run build` : succès, 5 actifs runtime contrôlés.
- `node --check server.js` et `node --check app.js` : succès.
- `node --test tests/sprint1-data.test.js` : **12 réussis, 0 échec, 0 ignoré**, 689,88 ms.
- `npm test` : **207 réussis, 0 échec, 0 ignoré**, 8 316,15 ms.
- `git diff --check` : succès.
- Probe rollback isolé dans `/private/tmp`, ensuite nettoyé : restauration acceptée sans export avec `allowDataLoss:true` ; restauration également acceptée après suppression de `sprint-1-contracts-v2` avec export.
- Empreintes revérifiées après les tests : identiques au candidat déclaré.

### Handoff

Seul `docs/code-review.md` est modifié. Le candidat `fe7e034b…` doit retourner en DEV et `docs/project-status.md` doit être remis en état bloqué par l'intégrateur. Toute correction invalidera la présente re-REVIEW et exigera une nouvelle revue indépendante sur les nouvelles empreintes.

---

## Re-REVIEW G1 terminale — candidat post SEC-G1-04

Date : 2026-08-20  
Reviewer : agent indépendant `g1_qa`, intervenant ici exclusivement comme reviewer (aucun code ou test authored)  
Périmètre : clôture des six P1 REVIEW historiques, SEC-G1-03/04, contrats S1-A à S1-D, consommateurs API/UI, migrations/rejeu/rollback, RBAC/scopes, OpenAPI et non-régression.  
Indépendance : seul ce rapport a été modifié.

### État candidat contrôlé

- `server.js` : `326815740c7e698cf7279ffa73339232869bf05ba851cd9798ba6227e92a973e`
- `app.js` : `ebd7ab4252c6aeea9463cfdb2da9525a1a1633be0bd2b843cf0840b95ba1d964`
- `docs/api/openapi-v1.yaml` : `8a36107f150ebceafd6e17c3354f068916800dd2f6e5a3506c4399605b19f243`
- `tests/sprint1-data.test.js` : `f5df2d985db9b34baa8a8a2a416ae9e0fac142c9e561755b2904e96c2671ba23`
- `tests/api.test.js` : `5265b7a3857fb201a46fab2527f5431e47330c67b6dc6bdf43c360e45eb87871`

Le dépôt ne fournit toujours pas de baseline Git suivie : les empreintes ci-dessus constituent donc la référence exacte de cette revue.

### Verdict terminal

**APPROVED — 0 P0, 0 P1 ouverts.**

Les six P1 REVIEW initiaux, les quatre P1 de la première relecture et les corrections de sécurité SEC-G1-03/04 sont fermés sur ce candidat. Deux écarts P2 documentaires/accessibilité demeurent et devront être traités avant la release finale, mais ils ne remettent pas en cause les invariants métier, l'autorisation ou l'intégrité des écritures de G1.

### Fermeture des constats historiques

1. **Contrat Client — FERMÉ.** La création impose une adresse complète, hérite de la devise de la société active et valide devise, conditions de paiement et adresse. L'OpenAPI expose le même contrat canonique.
2. **Projet et responsabilités — FERMÉ.** `siteId`, `salesOwnerId`, `projectManagerId` et `planningOwnerId` sont obligatoires ; les responsables doivent être des utilisateurs et membres actifs de la société. L'alias d'écriture `status` est refusé et l'UI fournit les sélecteurs nécessaires.
3. **Site → Catégorie → Ressource/Prestation — FERMÉ.** Le référentiel possède lecture, création, modification et archivage ; les références sont validées sur société, Site, type et activité. Le remplacement de Site remappe catégories, Ressources, unités et compatibilités de Prestations. Une catégorie référencée ne peut pas être désactivée ou archivée.
4. **Tarification — FERMÉ.** Date et unité sont filtrées avant la priorité Projet → Client → Catalogue ; le scope de la grille et ses références sont cohérents ; les chevauchements sont refusés et les instantanés tarifaires restent figés dans les lignes commerciales.
5. **Recherche/RBAC — FERMÉ.** La famille Client exige `client.read` ou `client.manage` avant scoring ; les six familles sont filtrées par permissions et scopes société/Site/projet/entité et les coordonnées de contact ne sont pas exposées.
6. **Migration et rollback — FERMÉ.** Le rejeu vérifie les quatre marqueurs avant toute migration, leurs digests/backups et les invariants de sortie. Le rollback exige toujours un export distinct, vérifié et créé en mode `0600`, puis restaure exactement les octets de la sauvegarde.

### SEC-G1-03 et SEC-G1-04

- **SEC-G1-03 — FERMÉ.** Les champs Client légitimement modifiables restent modifiables et persistants. Une falsification de `outputDigest`, du Client référencé par un Projet ou d'un responsable canonique provoque `MIGRATION_MARKER_CONFLICT` au rejeu.
- **SEC-G1-04 — FERMÉ.** La désactivation d'un Client référencé retourne `409 CLIENT_HAS_PROJECTS` avant toute affectation, audit, événement ou incrément de version. La suspension/réaffectation d'une adhésion portant une responsabilité Projet retourne `409 PROJECT_OWNER_REASSIGNMENT_REQUIRED` avant mutation ; le test relit la persistance et confirme que l'adhésion reste active. L'ordre des opérations dans les deux commandes garantit également l'absence de mutation Client sur le `409`.

### S1-A à S1-D et consommateurs

- **S1-A** : contrats Client/Projet/Catégorie/Prestation cohérents, cycle Projet séquentiel, références étrangères/inactives refusées et remplacement de Site sûr.
- **S1-B** : tarifs versionnés et datés, unités/scope/priorités cohérents, majorations combinées, tarif manquant explicite et finalisation commerciale bloquée sans tarif.
- **S1-C** : recherche bornée et paginée, permissions/scopes appliqués avant scoring, données de contact exclues.
- **S1-D** : neuf dimensions analytics exposées et filtrables ; CA signé calculé sans double comptage et retiré lors d'un remplacement de version ; étapes futures explicitement indisponibles.
- Les routes OpenAPI Client, Projet et `resource-categories` correspondent aux consommateurs runtime contrôlés ; les exemples Réservation restent exécutables dans la suite API.

### P2 — importants, non bloquants pour G1

1. **Contrat OpenAPI tarifaire encore divergent.** `RateSurcharge.adjustmentBps` documente `0..10000`, tandis que le runtime accepte `-10000..100000`. `RateCreate.sourceType` documente `manual`/`freeLine`, non acceptés par la commande serveur, et omet `stockItem`, accepté par le runtime. Le serveur reste cohérent et testé, mais le contrat public doit être aligné avant release.
2. **Accessibilité de la recherche universelle incomplète.** Les résultats possèdent `role=option` et `aria-selected`, mais l'entrée de recherche n'expose ni identifiants d'options ni `aria-activedescendant`, et la modale ne contient pas la tabulation. La navigation clavier principale fonctionne ; l'annonce de l'option active et la rétention de focus doivent être renforcées.
3. **Traçabilité d'intégration fragile.** Tous les fichiers apparaissent non suivis : cette revue est reproductible par empreintes, pas par diff Git. L'intégrateur doit figer une baseline avant INTEGRATION/RELEASE.

### Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `npm run lint` : succès.
- `npm run build` : succès, 5 actifs runtime vérifiés.
- `node --test tests/sprint1-data.test.js` : **15 réussis, 0 échec, 0 ignoré** sur l'exécution fraîche du candidat ; une réexécution ultérieure sous sandbox a rencontré uniquement `listen EPERM`, limite d'environnement sans changement de fichier.
- `node --test tests/api.test.js` : **27 réussis, 0 échec, 0 ignoré**, 840,41 ms.
- `npm test` : **210 réussis, 0 échec, 0 ignoré**, 8 184,12 ms.
- `git diff --check` : succès.
- Contrôle source ciblé : chemins `CLIENT_HAS_PROJECTS`, `PROJECT_OWNER_REASSIGNMENT_REQUIRED`, rejeu avec références falsifiées, quatre marqueurs de rollback, export obligatoire, remappage catégoriel, résolution tarifaire et permission Client relus.
- Empreintes revérifiées avant la rédaction : identiques au candidat déclaré.

### Limites et handoff

Cette approbation REVIEW porte uniquement sur les empreintes ci-dessus. Toute modification de code, tests ou OpenAPI invalide le verdict et exige une nouvelle relecture. `docs/project-status.md` reste à mettre à jour par l'intégrateur conformément à l'exception de tâche mono-fichier.

---

## REVIEW G8 indépendante — Dashboards, exports, BI et sécurité finale

Date : 2026-08-24
Reviewer : agent indépendant `g8_review`
Périmètre : S8-A/B/C/D, consommateurs API/UI, confidentialité coût/marge, RBAC/scopes, exports, BI, override de conflit, idempotence, audit/SSE, OpenAPI et rollback.
Indépendance : aucun code ni test authored ou corrigé ; seul le présent rapport est modifié. `docs/project-status.md` reste sous ownership de l'intégrateur.

### Candidat exact contrôlé

- commit : `0732150a9816cb3139282fabbd9bd6e3c3fe2a0a` ;
- `server.js` : `1e07f1f3c0a68df3c3a990f29b185275dd70e0053056da12a115569fb3cd0883` ;
- `app.js` : `2325f2f5b568954b435d5b4f2255803bb22022d01f9cdf227eca5f4687bc3e1c` ;
- `index.html` : `d78c8c8a68cec49d7c2a73d694129099fd09415be41b422eb4abcf4f498e2a89` ;
- `planning.css` : `51b38d7ed0eef30e085725777bc293c6e2c435dc87e07056913dbc116608197d` ;
- `docs/api/openapi-v1.yaml` : `19d82f82b1956fdd6a47422dcc8841e0b75345fb5d84da844e16c7905c654caa` ;
- tests S8-A/B/C/D : `64f3fe9f…`, `e5a80094…`, `a0c8dbf3…`, `b1b84d9c…`.

### Verdict terminal

**CHANGES REQUIRED — 0 P0, 4 P1 ouverts.**

Les contrôles existants confirment plusieurs fondations saines : les dix datasets BI forment un catalogue fermé et borné, JSON/CSV appliquent les scopes, les formules CSV/XLSX sont neutralisées, les coûts/marges ne sont pas apparus dans les surfaces sans `finance.read` effectivement testées, et le chemin principal d'override exige permission et motif puis audite l'opération. Toutefois, quatre écarts fonctionnels ou d'autorisation empêchent G8 d'atteindre ses critères de sortie, indépendamment des 331 tests verts.

### P1 — bloquants

#### P1-1 — Les dashboards ne sont ni complètement filtrables, ni drillables, ni réconciliables

`dashboardReadModel` ne reconnaît que `siteId`, `projectId`, `clientId` et `salesOwnerId` (`server.js:3955-3958`). Les filtres Ressource et Catégorie exigés pour Planning/Exploitation sont absents. L'UI n'envoie que `asOf` et le Site (`app.js:1039`) : elle ne fournit ni période, Projet, Client, commercial, catégorie ou ressource.

Les valeurs `drilldown` sont des URL génériques sans la période ni les filtres du dashboard (`server.js:3970-3993`). Elles ne constituent pas la route paginée du contrat ; plusieurs ne sont même pas accessibles au rôle qui voit le KPI. Exemple : un Planificateur voit l'occupation Planning, mais `/api/v1/analytics/occupancy` exige globalement `finance.read` (`server.js:2785`). Dans l'interface, « Voir le détail » ignore entièrement `kpi.drilldown` et change seulement le hash vers une page générique (`app.js:1041`), perdant le périmètre et la fraîcheur.

Enfin, plusieurs contenus obligatoires manquent : Planning n'expose pas explicitement sous-utilisation/saturation ; Commercial ne fournit pas montants par statut, conversion Budget confirmé vers Devis ni répartition Client/commercial ; Exploitation ne fournit pas occupation réelle ni écarts ; Chef de projet ne fournit pas les écarts et alertes annoncés. Les tests S8-A se limitent essentiellement à l'existence de trois KPI et ne réconcilient aucun total jusqu'aux lignes.

Impact : le critère central « chaque KPI drillable et réconciliable jusqu'aux sources autorisées » est faux ; écran, détail, export et BI ne peuvent pas être comparés sur le même `asOf` et les mêmes filtres.

Correction attendue : implémenter un drill-down paginé par dashboard/KPI, propager et revalider exactement `asOf/from/to` et tous les filtres, rendre les datasets de détail accessibles avec les permissions métier adéquates, câbler l'UI sur ces liens avec conservation du contexte et couvrir chaque KPI par une égalité agrégat ↔ détail.

#### P1-2 — Les trois exports ne respectent pas leurs contrats fonctionnels et leurs bornes

Le générateur XLSX ne sait produire qu'une seule feuille (`server.js:3848-3859`). Le Planning exporte donc seulement `Planning`, sans `Filtres` ni `Définitions`, et le KPI exporte seulement une table de cartes, sans feuilles `Synthèse`, `Détail` et `Définitions` (`server.js:2792,2795`). Un probe frais confirme `sheet2: 0` et l'absence des chaînes `Synthèse`, `Détail`, `Définitions`.

`planningExportRows` produit une ligne par allocation sur toute la réservation, pas une ligne par allocation/jour ; il omet Client et prestation et sérialise les dates comme texte (`server.js:3869-3875`). Il ne borne pas à 250 ressources. Le PDF réutilise ce modèle tabulaire, accepte jusqu'à 366 jours alors que sa borne est 62, reste toujours en A4 paysage `/MediaBox [0 0 842 595]`, et n'inclut ni fuseau, ni filtres détaillés, ni légende (`server.js:2793,3861-3867`).

Impact : US-101 à US-103 ne sont pas livrées selon la spécification ; l'export KPI ne peut pas réconcilier le dashboard, et le PDF peut accepter un volume explicitement interdit tout en produisant un rendu non fidèle à la fenêtre temporelle.

Correction attendue : générer les feuilles contractuelles, le détail complet et les définitions/filtres ; typer les dates et produire les lignes allocation/jour ; appliquer les limites 10 000/250/366 et PDF 62 avant génération ; rendre le PDF A4/A3 selon densité avec fuseau, légende, filtres et pagination ; tester le contenu structurel, pas seulement la signature ZIP/PDF.

#### P1-3 — Le dashboard Exploitation révèle la maintenance sans `maintenance.read`

La matrice serveur définit Exploitation avec seulement `planning.read` et `resource.read` (`server.js:3940`), puis agrège et renvoie les maintenances ouvertes (`server.js:3985-3988`). Un probe direct frais avec exactement `dashboard.read`, `planning.read` et `resource.read`, sans `maintenance.read`, a obtenu un KPI `maintenance` disponible de valeur `1`. La spécification exige explicitement `maintenance.read` pour cette section.

Le test annoncé comme matrice « sept rôles × six dashboards × trois exports » ne teste en réalité les six dashboards et trois exports qu'avec le seul utilisateur Planificateur (`tests/sprint8-security.test.js:125-149`) ; il entérine même l'accès Exploitation à `200`. Il ne parcourt donc pas les 126 combinaisons attendues et ne détecte pas cette fuite d'autorisation.

Impact : un rôle non habilité apprend le nombre de maintenances ouvertes et son compteur de sources. La section ne respecte pas la règle selon laquelle chaque source exige sa permission.

Correction attendue : exiger `maintenance.read` pour le dashboard entier ou rendre la section `unavailable` sans compteur ; appliquer la même logique à chaque section optionnelle ; ajouter la vraie matrice dynamique des sept rôles, six dashboards et trois exports, avec révocation entre écran et export.

#### P1-4 — Le replay exact d'une copie de cellule réémet un événement SSE

`duplicateReservationCell` protège bien l'événement `reservation.cellDuplicated.v1` par `!result.replay`, mais émet toujours `quote.planningProgress.v1` lorsque la réservation est liée à un Devis (`server.js:3405-3408`). Un replay exact d'une copie de cellule liée et éventuellement overridée répond donc `200` tout en produisant une seconde invalidation SSE, sans nouveau commit métier.

Impact : l'idempotence promise par US-109 est rompue sur un chemin de mutation ; les consommateurs temps réel observent un effet supplémentaire au replay. Le test S8-D ne rejoue que la création simple et ne couvre ni copie de cellule, ni duplication, ni move/resize/restore sur replay.

Correction attendue : conditionner toutes les émissions dérivées au premier commit, puis tester création, duplication, copie cellule, batch, move, resize, restore et import avec replay exact/divergent, versions et compteurs Réservation/audit/domain-event/SSE inchangés au replay.

### P2 — importants non bloquants isolément

1. La documentation de rollback Sprint 8 est absente de `README.md` et aucun test ne démontre l'analyse « aucune migration requise » ou un rollback des permissions/champs ajoutés. Comme G8 exige explicitement OpenAPI, migration et rollback validés, l'intégrateur doit documenter la stratégie de retour applicatif/données ou ajouter la migration/rollback prévu si les permissions persistées changent.
2. OpenAPI documente les nouvelles routes et ses 289 références/27 paramètres de chemin sont résolus, mais il ne documente pas la route paginée de drill-down annoncée ; les exports omettent aussi la réponse `401` et les schémas structurels des classeurs ne permettent pas de vérifier les trois feuilles.
3. Les onglets utilisent `role=tab` sans gestion des flèches, `aria-controls` ni panneau `tabpanel`. Les téléchargements sont de simples liens et ne fournissent ni progression ni erreur actionnable. La conformité accessibilité/interface de §10 n'est pas couverte par un test navigateur.
4. La confidentialité négative est prometteuse mais la « matrice » actuelle ne vérifie pas les sept rôles, et l'absence audit/SSE repose en partie sur une recherche statique du source. Ajouter des assertions dynamiques JSON, CSV, XLSX, PDF, audit, SSE et UI pour chaque rôle sans `finance.read`, ainsi qu'une révocation entre lecture et export.

### Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` : `0732150a9816cb3139282fabbd9bd6e3c3fe2a0a` avant et après les contrôles ;
- `node --test tests/sprint8-dashboards.test.js tests/sprint8-exports.test.js tests/sprint8-bi.test.js tests/sprint8-security.test.js tests/api.test.js` : **61 réussis, 0 échec, 0 ignoré**, 1 321,66 ms ;
- `npm test` : **331 réussis, 0 échec, 0 ignoré**, 8 097,84 ms ;
- `npm run lint` : succès ;
- `npm run build` : succès, 5 actifs runtime contrôlés ;
- `git diff --check` : succès avant rédaction du rapport ;
- contrôle OpenAPI local : 289 `$ref`, 27 chemins paramétrés, aucun composant ni paramètre de chemin manquant ;
- probe XLSX en mémoire : une seule feuille, aucune feuille `Synthèse`, `Détail` ou `Définitions` ;
- probe RBAC direct : dashboard Exploitation accepté et KPI maintenance disponible sans `maintenance.read` ;
- inspection des consommateurs UI : filtres dashboard réduits à `asOf/siteId`, drill-down remplacé par un changement de hash générique.

### Limites et handoff

Aucun E2E navigateur ni benchmark du dataset contractuel n'a été exécuté dans ce gate REVIEW ; ils appartiennent aux gates correspondants, mais ne pourraient pas fermer les quatre P1 fonctionnels ci-dessus. Aucun fichier exporté n'a été conservé et aucun serveur n'est resté actif.

Seul `docs/code-review.md` est modifié. L'intégrateur doit placer G8 en **Bloqué / retour DEV** dans `docs/project-status.md`. Toute correction invalidera cette revue et exigera une re-REVIEW indépendante sur le nouveau commit et les nouvelles empreintes.

---

## re-REVIEW G8 indépendante — correctifs Dashboards, exports, matrice et replay SSE

Date : 2026-08-24
Reviewer : agent indépendant `g8_review_final`
Périmètre : fermeture des quatre P1 du REVIEW G8 précédent, consommateurs UI/OpenAPI et cas limites directement affectés.
Indépendance : aucun code ni test authored ou corrigé ; seul le présent rapport est modifié. `docs/project-status.md` reste sous ownership de l'intégrateur.

### Candidat exact contrôlé

- commit : `1d4d97b3c43b6d91756b5c74207371dd879c760a` ;
- `server.js` : `015388c5d033f7d43c0e9472d2c8146d7e151eaba053e9a56a4a01bde6172365` ;
- `app.js` : `c40d6bb10cc5394b845131b49f7c06b7de90a878b1e54e97a635f1e42a50f480` ;
- `index.html` : `d78c8c8a68cec49d7c2a73d694129099fd09415be41b422eb4abcf4f498e2a89` ;
- `planning.css` : `51b38d7ed0eef30e085725777bc293c6e2c435dc87e07056913dbc116608197d` ;
- `docs/api/openapi-v1.yaml` : `c4adb3ef48d93d9996dd6de8a126a70be82f229b59fa4c68e99c1d9300d6c240` ;
- tests Dashboards / Exports / BI / Sécurité : `2fe0fa87…`, `45b0eb8e…`, `a0c8dbf3…`, `4258f8e2…`.

### Verdict terminal

**CHANGES REQUIRED — 0 P0, 3 P1 ouverts, 1 P2.**

Le correctif ferme correctement la fuite Maintenance et le second SSE du replay exact. Les feuilles XLSX, dates Excel, ventilation allocation/jour et bornes/orientations PDF demandées existent aussi. Les tests ciblés et la suite complète sont verts. Cependant, les critères centraux « tout chiffre affiché/exporté est réconciliable » et « matrice réelle 7 rôles × 6 dashboards × 3 exports » ne sont toujours pas démontrés et sont contredits par le code contrôlé.

### État des quatre P1 historiques

| P1 historique | État | Preuve |
|---|---|---|
| Dashboards, filtres, drill-down et réconciliation | **PARTIELLEMENT FERMÉ — P1 restant** | Les filtres et la route paginée existent, mais plusieurs chiffres requis ne sont ni rendus ni exportés, plusieurs détails ne reproduisent pas la formule de la carte et l'UI n'offre ni pagination du détail ni hash partageable. |
| Exports XLSX/PDF | **PARTIELLEMENT FERMÉ — P1 restant** | Les structures demandées et le PDF 62 jours/A4-A3 sont présents ; le détail KPI peut toutefois être tronqué silencieusement à 10 000 lignes et le Planning XLSX accepte 367 jours inclusifs. |
| `maintenance.read` + matrice réelle | **PARTIELLEMENT FERMÉ — P1 restant** | `maintenance.read` est maintenant exigé côté serveur et UI. La boucle annoncée comme 126 cas ne sollicite cependant pas les trois vrais exports pour chacun des sept rôles. |
| Second SSE au replay `duplicateReservationCell` | **FERMÉ** | Les deux émissions sont conditionnées par `!result.replay` et le test SSE dynamique confirme création `201`, replay `200`, puis absence de nouvelle invalidation. |

### P1 — bloquants

#### P1-1 — Les dashboards restent incomplets et plusieurs détails ne réconcilient pas les chiffres affichés

Le contrat G8 impose que chaque nombre affiché ou exporté soit réconciliable et que Direction expose notamment le forecast, Commercial le pipeline par statut et Chef de projet ses écarts/alertes. Le serveur place le forecast et le pipeline dans `response.sections` (`server.js:4007`, `server.js:4021`), mais `pilotagePage()` ne lit jamais `data.sections` (`app.js:1041`). L'export KPI ne parcourt que `model.kpis` (`server.js:2804`) : ces chiffres obligatoires ne sont donc ni visibles dans l'écran livré, ni présents dans `Synthèse`, `Détail` ou `Définitions`. Le dashboard Projet fournit complétude et projets non planifiés, mais aucun KPI d'écart prévu/réalisé et aucune alerte propre au Projet (`server.js:4028-4033`).

La réconciliation n'est pas non plus exacte pour toutes les cartes : Direction/Finance calcule l'occupation comme moyenne de lignes hebdomadaires par Site (`server.js:4004-4006`), tandis que son drill-down reconstruit systématiquement des lignes journalières (`server.js:4059`). La remise est une moyenne pondérée côté carte, mais le détail ne renvoie que `discountBps`, sans le poids nécessaire pour reproduire le résultat (`server.js:4020`, `server.js:4060`). Pour les indisponibilités Exploitation, `sourceCount` vaut toutes les réservations visibles alors que la valeur et le détail portent uniquement sur les réservations `unavailable` (`server.js:4026`, `server.js:4051`). Les tests ne réconcilient qu'un seul KPI, `signedRevenue` (`tests/sprint8-dashboards.test.js:42-43`), pas chaque KPI comme requis.

Enfin, l'UI charge seulement la première page de 100 lignes et ne rend aucun contrôle de pagination (`app.js:1040-1042`). Les filtres restent dans l'objet mémoire `pilotageModule` et ne sont jamais sérialisés dans le hash, alors que la SPEC exige des filtres partageables et un retour conservant le contexte.

Impact : Direction, Commercial et Chef de projet n'atteignent pas leur contenu obligatoire ; certains nombres ne peuvent pas être reproduits depuis leur détail ; écran, détail et export ne satisfont pas le critère principal de G8.

Correction attendue : représenter les contenus obligatoires sous forme de KPI/sections effectivement rendus et exportés avec drill-down ; utiliser la même granularité/formule ou publier les composantes exactes de réconciliation ; aligner `sourceCount`; couvrir chaque KPI par une preuve agrégat ↔ détail ; ajouter pagination UI et hash filtré restaurable.

#### P1-2 — L'export KPI tronque silencieusement le détail et la borne Planning Excel est décalée d'un jour

L'export KPI appelle le drill-down global avec `pageSize: 10000` puis écrit directement `detail.items` (`server.js:2804`). Le read-model construit potentiellement les lignes de tous les KPI, retourne `items.slice(0, 10000)` et conserve seulement `total` hors classeur (`server.js:4040-4062`). Lorsque le cumul dépasse 10 000 lignes, le classeur reste `200` avec un détail incomplet, sans erreur, avertissement ni compteur de troncature. Les feuilles `Synthèse` et `Définitions` peuvent alors annoncer des valeurs/sources impossibles à réconcilier avec `Détail`.

Par ailleurs, la validation Planning XLSX refuse uniquement un écart UTC strictement supérieur à 366 jours (`server.js:3895`). Comme `from` et `to` sont inclus dans les lignes journalières, un écart de 366 représente 367 jours et reste accepté, contrairement au maximum de 366 jours de la SPEC. Le PDF calcule correctement la borne inclusive et n'a pas ce défaut.

Impact : un export déclaré réussi peut ne pas contenir toutes les sources et le Planning Excel dépasse sa borne contractuelle ; US-101/US-103 et la réconciliation export ne sont pas terminales.

Correction attendue : refuser explicitement le détail total `> 10000` avec `422 EXPORT_TOO_LARGE` ou produire une partition contractuelle complète ; inclure les compteurs de contrôle ; valider les jours inclusifs (`difference + 1 <= 366`) et ajouter les cas limites 366/367 jours.

#### P1-3 — La matrice annoncée comme 126 contrôles ne teste pas les trois exports réels sous les sept rôles

La boucle de `tests/sprint8-security.test.js:145-154` appelle bien `dashboardReadModel` pour chaque rôle/dashboard, puis incrémente trois fois `checked`. Pour la branche `xlsx`, elle génère un classeur factice via `exportXlsxBuffer('Matrice', ...)`; pour la branche `pdf`, elle génère un PDF factice via `exportPdfBuffer(...)` (`tests/sprint8-security.test.js:150`). Ces appels ne passent ni par les routes, ni par le read-model d'export KPI, ni par les permissions/scopes/projections du rôle. Il n'existe d'ailleurs aucun export PDF de dashboard : le troisième export G8 est Planning PDF, pas un PDF factice par dashboard.

Les vrais endpoints Planning XLSX, Planning PDF et KPI XLSX ne sont ensuite appelés qu'avec l'utilisateur Planificateur (`tests/sprint8-security.test.js:155-173`). La valeur `checked === 126` prouve donc seulement 126 incréments, pas 126 décisions d'autorisation et projections de contenu sur les trois exports réels.

Impact : la fermeture annoncée du P1 historique et la preuve finale US-107 ne sont pas établies. Une régression propre à ADMIN, FINANCE, SALES, PROJECT_MANAGER, PLANNING_MANAGER ou READ_ONLY sur un export réel ne serait pas détectée.

Correction attendue : authentifier ou construire le contexte effectif de chacun des sept rôles, appeler les six dashboards et les trois vrais endpoints/export read-models avec les mêmes filtres/scopes, vérifier statut attendu et absence/présence des champs financiers dans les artefacts réels, puis tester une révocation entre écran et export.

### P2 — OpenAPI omet encore `401` sur l'export KPI

La nouvelle route de drill-down et ses paramètres sont documentés. Les exports Planning documentent bien `401`. En revanche `/dashboards/{kind}/export.xlsx` ne déclare que `200`, `403`, `404` et `422` (`docs/api/openapi-v1.yaml:771-798`), alors que la route est authentifiée et retourne `401` sans session.

Correction attendue : ajouter la réponse `401 Unauthorized` et un test contractuel de cette réponse.

### Points fermés confirmés

1. **Maintenance : FERMÉ.** Exploitation exige désormais `planning.read`, `resource.read` et `maintenance.read` côté serveur (`server.js:3966-3972`) et dans la navigation UI (`app.js:1033`). L'absence de permission produit `403` sans compteur.
2. **Structure Planning XLSX : FERMÉE pour les feuilles et le grain.** Le classeur contient `Planning`, `Filtres`, `Définitions`; les dates sont typées et les lignes sont ventilées allocation/jour (`server.js:2792-2795`, `server.js:3863-3907`).
3. **Planning PDF : FERMÉ.** La période inclusive est limitée à 62 jours, A4 paysage jusqu'à 14 jours puis A3, avec fuseau, filtres, légende et pagination (`server.js:2797-2801`, `server.js:3884-3891`).
4. **Replay SSE : FERMÉ.** `duplicateReservationCell` réévalue toujours le droit d'override, mais ni `reservation.cellDuplicated.v1` ni `quote.planningProgress.v1` ne sont réémis au replay (`server.js:3419-3423`). Le test dynamique observe bien les deux événements à la création et aucun au replay (`tests/sprint8-security.test.js:182-194`).
5. **OpenAPI drill-down : PRÉSENT.** La route, les filtres, la pagination et le schéma de réponse sont documentés (`docs/api/openapi-v1.yaml:739-770`).

### Preuves fraîches exécutées

- `git rev-parse HEAD` : `1d4d97b3c43b6d91756b5c74207371dd879c760a` ; worktree initial propre.
- `node --test tests/sprint8-dashboards.test.js tests/sprint8-exports.test.js tests/sprint8-bi.test.js tests/sprint8-security.test.js tests/api.test.js` : **64 réussis, 0 échec, 0 ignoré**, 1 327,84 ms.
- `npm test` hors sandbox, Node v26.6.0 : **334 réussis, 0 échec, 0 ignoré**, 8 084,85 ms. Une première tentative sandboxée a échoué sur des ouvertures de ports `EPERM`; elle n'est pas un échec produit et a été rejouée dans l'environnement approprié.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, cinq actifs runtime vérifiés.
- `git diff --check` avant rédaction du rapport : **PASS**.
- inspection ciblée du diff `0732150a…1d4d97b3`, de `server.js`, `app.js`, OpenAPI et tests G8 : constats ci-dessus.

### Limites et handoff

Aucun E2E navigateur ni benchmark n'a été exécuté dans cette re-REVIEW ; ces preuves appartiennent aux gates aval. Aucun serveur ni artefact d'export n'est laissé actif ou conservé. Les tests verts ne compensent pas les trois écarts de contrat démontrés.

Seul `docs/code-review.md` est modifié. L'intégrateur doit conserver G8 en **BLOQUÉ — retour DEV requis** dans `docs/project-status.md`. Toute correction de code, test ou OpenAPI invalidera cette re-REVIEW et exigera un nouveau verdict indépendant sur le nouveau hash.

---

## re-REVIEW terminale G8 — réconciliation Projet et fermeture des P1 historiques

Date : 2026-08-24
Reviewer : agent indépendant `g8_review_final`
Périmètre : commit exact demandé, fermeture des P1 du re-gate précédent, consommateurs UI/OpenAPI, accessibilité et cas limites associés.
Indépendance : aucun code, test ou autre document modifié ; seul le présent rapport relève de cet agent.

### Candidat exact contrôlé

- commit : `33ec24b2632729dd5faa45f47ca162b84c0df1d4` ;
- `server.js` : `9c76d64ff05850e41a91bddca4519f7870b231b8ff95aa3ad061a5b41bdb7e37` ;
- `app.js` : `8897086486d372cf94b87c0b6c4a5fb5e0d5a6d10d2c67b4489e282af95aa0e5` ;
- `index.html` : `d78c8c8a68cec49d7c2a73d694129099fd09415be41b422eb4abcf4f498e2a89` ;
- `planning.css` : `51b38d7ed0eef30e085725777bc293c6e2c435dc87e07056913dbc116608197d` ;
- `docs/api/openapi-v1.yaml` : `7395603efc38905461287d6c517d61653729869a76230a020ea3b3e6877a860c` ;
- tests Dashboards / Exports / BI / Sécurité : `d864ebde…`, `7570ca69…`, `a0c8dbf3…`, `9c08bff3…`.

### Verdict terminal

**CHANGES REQUIRED — 0 P0, 1 P1 ouvert, 1 P2.**

Les correctifs ferment les défauts historiques sur les filtres d'occupation, la granularité journalière, les sections Forecast/Pipeline UI et XLSX, la pagination et l'URL partageable, le poids de remise, la limite stricte de 10 000 lignes, la borne inclusive de 366 jours, la matrice HTTP réelle, `maintenance.read`, le `kpiId` obligatoire, OpenAPI et le replay SSE. Un défaut bloquant subsiste néanmoins dans les KPI Projet : la carte et son propre drill-down peuvent produire des résultats contradictoires.

### P1 — le réalisé Projet n'est pas borné aux réservations visibles et désynchronise carte et détail

Dans le dashboard Projet, `actualCount` compte tous les `actualRecords` des Projets autorisés (`server.js:4031`), sans restreindre les réalisés à la période courante ni aux identifiants des réservations effectivement présentes dans `reservations`. Les formules soustraient ensuite ce total global au nombre de réservations visibles (`server.js:4034-4035`). Le drill-down `actualGap`, lui, applique correctement une différence d'ensembles entre `reservationRows` de la période et les identifiants de réservations réalisées (`server.js:4051`, `server.js:4061`).

Probe frais déterministe : un même Projet contient une réservation réalisée le 17 août, hors fenêtre, et une réservation non réalisée le 18 août, seule visible pour `from=to=2026-08-18`. Résultat observé :

```text
planning = 1
actuals = 1
actualGap (carte) = 0
actualCompletion (carte) = 10000 bps
actualGap (drill-down) = 1, réservation review_visible
```

La carte annonce donc 100 % d'avancement et aucun écart alors que son propre détail annonce une réservation sans réalisé. Le compteur `actuals` inclut également un réalisé hors période. Ce comportement viole directement le critère de réconciliation carte/détail et rend l'écart Projet trompeur.

Correction attendue : construire l'ensemble des `reservationId` visibles après tous les filtres temporels et de ressources, ne retenir dans les KPI `actuals`/`actualCompletion` que les réalisés associés à cet ensemble, puis calculer `actualGap` par différence d'ensembles comme le drill-down. Ajouter au minimum un test avec un réalisé hors fenêtre et une réservation visible non réalisée, en exigeant carte `actualGap=1`, avancement `0` et détail total `1`.

### État des autres P1 du re-gate précédent

| Point contrôlé | État | Preuve |
|---|---|---|
| Filtres occupation et réconciliation journalière | **FERMÉ** | `financeOccupancy` reçoit le périmètre Projet/Client/commercial ; la carte et le détail Planning utilisent `groupBy: day`. Le test filtré obtient 417 bps sur une unique source et le même résultat au détail. |
| Sections Forecast/Pipeline et écarts Projet UI/XLSX | **PARTIEL** | Forecast/Pipeline sont rendus dans des régions tabulaires UI (`app.js:1043`) et dans la feuille `Sections` (`server.js:2806`). Les KPI Projet existent, mais leur calcul reste incorrect selon le P1 ci-dessus. |
| Pagination, URL partageable et poids | **FERMÉ** | Pagination précédente/suivante et chargement de page sont câblés (`app.js:1043-1044`) ; les filtres `pilotage.*` sont sérialisés par `history.replaceState` (`app.js:1039`) ; le détail remise expose son poids et l'export possède la colonne correspondante. |
| Refus explicite au-delà de 10 000 lignes | **FERMÉ** | Le read-model d'export lève `422 EXPORT_TOO_LARGE` avant troncature (`server.js:4068`) ; le test 10 001 sources le couvre. |
| Borne Planning XLSX de 366 jours inclusifs | **FERMÉ** | La validation accepte 366 jours inclusifs et refuse 367 ; les cas limites sont testés. |
| Matrice HTTP 7 × 6 × 3 | **FERMÉ** | Le test change réellement le rôle effectif, se reconnecte, puis appelle écran, drill-down et XLSX pour chaque dashboard, soit 126 contrôles HTTP (`tests/sprint8-security.test.js:155-165`) ; Planning XLSX/PDF sont en plus appelés pour chaque rôle. |
| `maintenance.read` | **FERMÉ** | Exploitation exige explicitement `maintenance.read` (`server.js:3972`) et le test négatif refuse le dashboard sans divulguer de compteur. |
| `kpiId` public obligatoire | **FERMÉ** | Absence refusée par `422 DASHBOARD_KPI_REQUIRED` (`server.js:4047`) ; paramètre `required: true` dans OpenAPI (`docs/api/openapi-v1.yaml:749`). |
| OpenAPI / consommateurs | **FERMÉ pour les P1/P2 historiques** | Drill-down, pagination, filtres, poids, classeur à quatre feuilles et réponses `401/403/404/422` sont documentés ; l'UI consomme les nouveaux champs. |
| Second SSE au replay `duplicateReservationCell` | **FERMÉ** | Les émissions restent conditionnées au premier commit ; le test dynamique confirme l'absence d'une seconde invalidation au replay. |

### P2 — sémantique clavier des onglets incomplète

Les boutons de dashboard utilisent `role="tab"` et `aria-selected`, mais n'exposent toujours ni `aria-controls`, ni panneau `role="tabpanel"`, ni roving `tabindex`, ni navigation spécifique par flèches gauche/droite (`app.js:1042-1044`). Les régions tabulaires, états de chargement/erreur et boutons de pagination sont correctement nommés, mais le pattern ARIA Tabs n'est pas complet. Le rerendu asynchrone du détail ne restaure pas non plus explicitement le focus après un changement de page.

Correction attendue : soit adopter le pattern Tabs complet (relations tab/panel, roving tabindex, Home/End et flèches), soit retirer les rôles ARIA spécialisés et conserver des boutons ordinaires correctement nommés ; préserver/restaurer le focus lors de la pagination.

### Preuves fraîches exécutées

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` : `33ec24b2632729dd5faa45f47ca162b84c0df1d4` ; worktree initial propre ;
- `node --test tests/sprint8-dashboards.test.js tests/sprint8-exports.test.js tests/sprint8-bi.test.js tests/sprint8-security.test.js tests/api.test.js` : **67 réussis, 0 échec, 0 ignoré**, 2 047,81 ms ; une première tentative sandboxée a rencontré `EPERM` sur loopback puis a été rejouée dans l'environnement autorisé ;
- `npm test` : **337 réussis, 0 échec, 0 ignoré**, 8 400,15 ms ;
- `npm run lint` : **PASS** ;
- `npm run build` : **PASS**, cinq actifs runtime vérifiés ;
- `git diff --check` avant rédaction du rapport : **PASS** ;
- probe de réconciliation Projet en mémoire sur jeu minimal : contradiction reproductible `actualGap carte 0` / `actualGap détail 1` ; aucun fichier de données de travail modifié ;
- inspection ciblée de `server.js`, `app.js`, `index.html`, OpenAPI et des quatre suites Sprint 8.

### Limites et handoff

Aucun E2E navigateur ni benchmark n'a été exécuté dans cette REVIEW ; ces preuves restent aux gates aval. Aucun serveur ou artefact temporaire n'est laissé actif. Les tests verts ne couvrent pas le scénario temporel qui démontre le P1.

Seul `docs/code-review.md` est modifié. L'intégrateur doit maintenir G8 en **BLOQUÉ — retour DEV** et mettre à jour `docs/project-status.md`. Toute correction invalidera ce verdict et exigera une nouvelle REVIEW indépendante sur le nouveau hash exact.

---

## re-REVIEW ultime G8 — versions de Réservation et cache Finance

Date : 2026-08-24
Reviewer : agent indépendant `g8_review_final`
Périmètre : commit exact `b56d13f0cf576dbb5726f567d1c98a2081d2ca61`, fermeture du P1 Projet, cache du drill-down Finance et recontrôle des anciens P1 G8.
Indépendance : aucun code, test ou autre document modifié ; ownership limité à ce rapport.

### Candidat exact et empreintes

- commit : `b56d13f0cf576dbb5726f567d1c98a2081d2ca61` ;
- `server.js` : `8bf91bc83c49ac42821ea07d3e9128a9bfa9bee3a673ee01807a966c936959ca` ;
- `app.js` : `8897086486d372cf94b87c0b6c4a5fb5e0d5a6d10d2c67b4489e282af95aa0e5` ;
- `docs/api/openapi-v1.yaml` : `7395603efc38905461287d6c517d61653729869a76230a020ea3b3e6877a860c` ;
- test Dashboard : `aa416fc59090bbaf9ba987cf7fc9df877aefc664b7d12ed1a184157a96a955b1` ;
- tests Exports / BI / Sécurité : `7570ca69…`, `a0c8dbf3…`, `9c08bff3…` ;
- benchmark Finance : `087702c7b9bf7d19c4f2a1042bd5318a234332f4863f7c3e571f34857d73e08e`.

### Verdict terminal

**CHANGES REQUIRED — 0 P0, 1 P1 ouvert, 2 P2.**

Le candidat corrige la sélection par période, `asOf` et révision courante, et réconcilie bien le nombre distinct de Réservations réalisées pour l'avancement. Le cache Finance est calculé sous le même acteur, reste non énumérable et ne fuit pas dans JSON. Cependant, le réalisé d'une ancienne **version de Réservation** reste accepté comme réalisé de la version actuellement visible. Ce cas est un état métier valide après modification d'une Réservation déjà confirmée et maintient G8 bloqué.

### P1 — un réalisé d'une ancienne version couvre encore la Réservation courante

`dashboardActualRows` exige que la Réservation soit visible, que la révision courante intersecte la période et que `confirmedAt <= asOf`, mais ne vérifie pas `record.sourceReservationVersion === reservation.version` (`server.js:3982-3987`). Or le domaine autorise plusieurs réalisations successives pour les versions successives d'une même Réservation (`server.js:1407`) et la lecture canonique `/reservations/:id/actual` ne considère réalisée que la version courante (`server.js:2820`).

Deux probes frais reproduisent l'écart :

1. Réservation visible en version 2, uniquement un réalisé de source version 1 : la carte Projet retourne `actuals=1`, `actualCompletion=10000`, `actualGap=0` et le détail écart retourne `0`, alors que la version 2 est encore à confirmer.
2. Même Réservation version 2 avec réalisations version 1 et version 2 : la carte et le détail `actuals` retournent `2`. L'avancement utilise bien un identifiant de Réservation distinct et reste à 100 %, mais le KPI « Réalisés confirmés » double-compte une seule Réservation visible.

Ce résultat contredit la sémantique de `pendingActualItems`, qui indexe les confirmations par couple `reservationId:sourceReservationVersion`, et la route canonique qui recherche précisément la version courante. Une modification post-confirmation peut donc masquer un réalisé à reconfirmer et fausser le compteur Projet.

Correction attendue : ajouter l'égalité de version dans `dashboardActualRows`, puis étendre le test G8 avec une Réservation version 2 et un réalisé version 1. Sans réalisé version 2, exiger `actuals=0`, `actualCompletion=0`, `actualGap=1` et détail écart `1`; avec les deux versions, exiger un seul réalisé courant.

### Cache Finance — contrôle satisfaisant

- Le résultat `financeUnbilledOverages` est demandé avec `internalAllItems`, page 1 et capacité 10 000, puis réutilisé uniquement dans le même appel `dashboardDrilldownReadModel` (`server.js:4013-4014`, `server.js:4075`). Il n'existe pas de cache global ni de réutilisation entre acteurs.
- `_dashboardCache` est ajouté avec `Object.defineProperty(..., enumerable: false)` (`server.js:4053`). Probe frais : la clé est absente de `Object.keys`, de `JSON.stringify` et des identifiants internes sérialisés ; l'enveloppe HTTP ne peut donc pas la divulguer.
- La pagination publique s'applique après constitution des lignes autorisées et retourne `items`, `total`, `page` et `pageCount` cohérents (`server.js:4060-4080`). Le cache complet évite la troncature historique à 100 lignes et le chemin d'export conserve le refus explicite au-delà de 10 000.
- La réutilisation est sûre par construction parce que le cache est créé après les permissions/scopes du même `auth` et n'est jamais persisté. Aucun P0/P1 n'est constaté sur ce point.

### Anciens P1 G8

Tous les autres P1 historiques restent fermés : filtres d'occupation Projet/Client/commercial, granularité journalière carte/détail, sections Forecast/Pipeline UI et XLSX, pagination et URL partageable, poids de remise, refus `> 10 000`, borne de 366 jours inclusifs, matrice HTTP réelle 7 × 6 × 3, `maintenance.read`, `kpiId` obligatoire, OpenAPI, exports structurés et absence de second SSE au replay exact.

### P2 — tests et accessibilité

1. Le nouveau test Projet couvre un réalisé ancien hors période et un réalisé confirmé après `asOf`, mais assigne toujours `sourceReservationVersion` depuis la version courante (`tests/sprint8-dashboards.test.js:60-68`). Il ne couvre donc pas le cas de version obsolète qui révèle le P1.
2. Le P2 accessibilité antérieur demeure : les onglets `role=tab` n'implémentent pas encore complètement le pattern ARIA Tabs et le focus n'est pas explicitement restauré après pagination. Ce point reste non bloquant pour REVIEW mais doit être suivi avant validation UX finale.

### Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- tests ciblés `node --test tests/sprint8-dashboards.test.js tests/sprint8-exports.test.js tests/sprint8-bi.test.js tests/sprint8-security.test.js tests/api.test.js` : **68 réussis, 0 échec, 0 ignoré**, 3 461,43 ms ;
- `npm test` : **338 réussis, 0 échec, 0 ignoré**, 9 271,56 ms ;
- `npm run lint` : **PASS** ;
- `npm run build` : **PASS**, cinq actifs runtime vérifiés ;
- `git diff --check` avant rapport : **PASS** ;
- probes mémoire version obsolète, double version, non-énumérabilité/sérialisation du cache et pagination Finance : exécutés sans modifier les données du dépôt.

### Handoff

Seul `docs/code-review.md` est modifié. L'intégrateur doit maintenir G8 en **BLOQUÉ — retour DEV très ciblé** et mettre à jour `docs/project-status.md`. Après ajout du filtre de version et du négatif correspondant, une nouvelle REVIEW indépendante sur le nouveau hash exact reste obligatoire.

---

## re-REVIEW finale G8 — version courante du réalisé Projet

Date : 2026-08-24
Reviewer : agent indépendant `g8_review_final`
Périmètre : diff strict `b56d13f0cf576dbb5726f567d1c98a2081d2ca61..5f2b7d13dc034735f26c9c54dcead2a51fc20d6f`, régression des P1 historiques et du cache/performance Finance.
Indépendance : aucun code, test ou autre document modifié ; ownership limité à `docs/code-review.md`.

### Candidat exact

- commit : `5f2b7d13dc034735f26c9c54dcead2a51fc20d6f` ;
- `server.js` : `b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d` ;
- `app.js` : `8897086486d372cf94b87c0b6c4a5fb5e0d5a6d10d2c67b4489e282af95aa0e5` ;
- OpenAPI : `7395603efc38905461287d6c517d61653729869a76230a020ea3b3e6877a860c` ;
- test Dashboard : `098b4f463bafb9c7ba5722c549415954a5aa92502f0b9abdd3918c7b013ee747` ;
- tests Exports / BI / Sécurité : `7570ca69…`, `a0c8dbf3…`, `9c08bff3…` ;
- benchmark Finance : `087702c7b9bf7d19c4f2a1042bd5318a234332f4863f7c3e571f34857d73e08e`.

### Verdict terminal

**APPROVED — 0 P0, 0 P1 ouvert.**

Le dernier P1 G8 est fermé. `dashboardActualRows` exige maintenant l'égalité entre `record.sourceReservationVersion` et la version de la Réservation visible avant tout agrégat (`server.js:3982-3987`). Le même helper alimente les cartes Projet/Exploitation et leurs drill-downs ; carte, détail et export partagent donc la sélection corrigée.

### Preuves fonctionnelles indépendantes

Un probe déterministe frais a contrôlé les quatre états demandés avec la même période Projet :

| État | Carte `actuals` | Carte avancement | Carte écart | Détail actuals | Détail écart |
|---|---:|---:|---:|---:|---:|
| Réservation v1, réalisé v1 confirmé après `asOf` | 0 | 0 bps | 1 | 0 | 1 |
| Réservation v2, seulement réalisé historique v1 | 0 | 0 bps | 1 | 0 | 1 |
| Réservation v2, réalisé courant v2 | 1 | 10 000 bps | 0 | 1 | 0 |
| Réservation v2, historique v1 + courant v2 | 1 | 10 000 bps | 0 | 1 | 0 |

Le dernier cas confirme l'absence de double comptage entre versions. Le test automatisé reproduit également le stale v1, ajoute le courant v2, puis exige l'unique identifiant courant au drill-down (`tests/sprint8-dashboards.test.js:60-72`). L'invariant de persistance interdit par ailleurs deux `actualRecords` pour le même couple Réservation/version ; le scénario historique v1 + courant v2 est le doublon métier légitime à filtrer.

### Non-régression des anciens P1

- cache Finance toujours limité au même acteur/appel, non global et non énumérable ; il reste absent de `Object.keys` et `JSON.stringify` ;
- drill-down Finance `billableRevenue` toujours alimenté par le résultat complet autorisé, avec pagination après sélection et refus explicite au-delà de 10 000 ;
- benchmark frais représentatif : 250 ressources, 10 000 réservations, 2 000 Devis, 2 000 réalisés et 2 000 coûts ; `billableDrilldown` p95 **214,76 ms**, sous le seuil `< 300 ms` ;
- filtres et réconciliation d'occupation, sections Forecast/Pipeline UI/XLSX, pagination et URL partageable, poids de remise, borne 366 jours, matrice HTTP 7 × 6 × 3, `maintenance.read`, `kpiId`, OpenAPI, exports et replay SSE restent inchangés et couverts par les suites vertes.

### P2 non bloquant maintenu

Le suivi accessibilité antérieur demeure : le pattern ARIA des onglets Pilotage et la restauration explicite du focus après pagination restent à compléter lors de la validation UX finale. Aucun défaut P0/P1 n'en découle dans ce diff strict.

### Commandes et résultats frais

Environnement : macOS arm64, Node `v26.6.0`.

- `node --test tests/sprint8-dashboards.test.js tests/sprint8-exports.test.js tests/sprint8-bi.test.js tests/sprint8-security.test.js tests/api.test.js` : **68 réussis, 0 échec, 0 ignoré**, 3 468,11 ms ;
- `npm test` : **338 réussis, 0 échec, 0 ignoré**, 9 452,20 ms ;
- `npm run lint` : **PASS** ;
- `npm run build` : **PASS**, cinq actifs runtime vérifiés ;
- `npm run benchmark:finance` : **PASS**, pire p95 Finance contrôlé `214,76 ms` pour `billableDrilldown` ;
- `git diff --check` avant rapport : **PASS** ;
- probes mémoire v1 futur, stale v1/v2, courant v2, historique+courant et sérialisation cache : **PASS**.

### Handoff

La gate REVIEW G8 est **APPROVED** sur le commit exact ci-dessus. Seul `docs/code-review.md` est modifié. L'intégrateur doit reporter ce verdict dans `docs/project-status.md` et confirmer les autres gates indépendants sur le même hash avant INTEGRATION/E2E ; toute modification applicative ultérieure invalidera cette approbation.
# Gate REVIEW indépendant RC5 — périmètre cumulé post-RC4

Date : 2026-08-24

Reviewer : agent indépendant `g8_review_final`

Candidat de gate exact : `b715f4ba1453ed9a73db3fd2f32e996957a700d2` (`docs: consolidate rc5 gate candidate`)

Candidat applicatif exact : `d96281e0caf86777cdc21eba3ece9ab516420ddf` (`fix: present dashboard forecast in business terms`)

Diff cumulé contrôlé : `v0.5.0-rc4..b715f4ba1453ed9a73db3fd2f32e996957a700d2`

Nature : revue indépendante seule ; seul `docs/code-review.md` est modifié par cet axe

## Verdict terminal

**REJECTED — 0 P0, 1 P1 ouvert.**

Le Planning longue durée, la suppression explicite de la vue 6 semaines, la modale Pilotage et la présentation métier du Forecast sont cohérents dans leurs chemins nominaux. La release reste toutefois bloquée : le KPI Exploitation `occupancyGap` n'utilise pas le même ensemble de périodes pour sa carte et son drill-down dès qu'une période planifiée ne possède aucun réalisé. La promesse de détail réconcilié est donc fausse sur un cas métier courant.

## P1 — `occupancyGap` reste non réconcilié lorsque des périodes n'ont aucun réalisé

Dans `dashboardReadModel()`, `plannedBps` est la moyenne de **toutes** les lignes d'occupation, alors que `actualBps` et `sourceCount` utilisent seulement `actualItems`, c'est-à-dire les lignes dont `actualOccupancyBps !== null`. La carte calcule ensuite `actualBps - plannedBps`.

Le correctif RC5 filtre correctement les lignes nulles du drill-down, mais chaque ligne restante calcule `actualOccupancyBps - plannedOccupancyBps`. Son agrégat correspond donc à la moyenne des écarts sur le sous-ensemble `actualItems`, et non à la différence entre l'occupation réelle du sous-ensemble et l'occupation planifiée de l'ensemble complet.

Preuve déterministe fraîche : deux jours planifiés sur la même ressource, `1 h` puis `8 h`, avec un réalisé de `1 h` uniquement le premier jour. Résultat :

```text
carte occupancyGap       = -1458 bps
sourceCount carte        = 1
total drill-down         = 1
moyenne du drill-down    = 0 bps
ligne drill-down         = 2026-08-10:resource_1 → 0 bps
```

Le nombre de sources est désormais aligné, mais la valeur ne l'est pas. Cela viole les critères Sprint 8 « détail réconcilié » et « chaque KPI réconcilie exactement ses lignes ». La correction doit soit calculer le `plannedBps` de la carte sur `actualItems` pour ce KPI, soit définir et exposer des poids permettant de reconstruire exactement la valeur annoncée ; un test doit comparer la valeur agrégée, pas seulement `total`, `sourceCount` et l'absence de `null`.

## Contrôles conformes

### Planning et scroll horizontal

- `planningColumnWidth()` centralise les largeurs CSS/virtualisation et la piste reçoit une largeur totale stable `totalColumns × columnWidth`.
- Mois et 3 mois gardent les 92 colonnes montées pendant le geste horizontal, tout en conservant la virtualisation verticale et l'index pré-DOM par cellule.
- La vue Mois couvre juillet à septembre autour de l'ancre d'août ; la vue 3 mois conserve la même période avec densité compacte. Les extrémités restent représentées dans le modèle de scroll.
- Le sélecteur et le code actif ne proposent plus que Jour, Semaine, Mois et 3 mois. La suppression de 6 semaines est une décision produit explicite du lot RC5 ; aucun contrat API ou format persisté ne dépend de cette valeur.

### Pilotage UI

- Le détail utilise un élément natif `dialog`, un titre relié par `aria-labelledby`, une fermeture accessible, Échap, clic backdrop, focus initial sur Fermer et restitution du focus au déclencheur.
- Un jeton de requête distinct empêche une réponse tardive de rouvrir ou remplacer un détail fermé/changé. Le changement de dashboard ou de société invalide aussi la requête en cours.
- Les sources, statuts, pourcentages, comptes et montants sont localisés et toutes les données injectées sont échappées.
- La pagination reste dans la modale et conserve le KPI et les filtres portés par l'URL serveur.

### Forecast 30/60/90

- La section `forecast` reçoit un composant métier distinct : horizons, date terminale française, total, « Déjà planifié » et « À planifier » formatés avec devise/exposant du read-model.
- Les trois fenêtres restent produites par l'autorité serveur ; l'UI n'en recalcule ni les montants ni les dates.
- La grille est responsive à trois, puis une colonne, avec structure `article`/`dl` lisible et contenus échappés.

## Tests manquants pertinents

- Le nouveau test `actualOccupancy/occupancyGap` vérifie uniquement `detail.total === kpi.sourceCount` et l'absence de valeurs nulles. Il doit aussi reconstruire ou comparer la valeur du KPI sur un dataset mélangeant périodes avec et sans réalisés ; c'est précisément le P1 observé.
- Les tests UI de la modale sont principalement lexicaux. Un test DOM pérenne de fermeture Échap/backdrop, focus retour et pagination serait utile, mais ce manque n'est pas bloquant au regard du code inspecté et des gates aval déjà exécutés.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

- `git rev-parse HEAD` : `b715f4ba1453ed9a73db3fd2f32e996957a700d2`.
- Inspection du diff cumulé et des consommateurs `app.js`, `server.js`, `planning.css`, tests Planning/Dashboards, README/CHANGELOG et état de gate : effectuée.
- Sonde déterministe `occupancyGap` avec deux jours planifiés et un seul jour réalisé : **ÉCHEC de réconciliation**, carte `-1458 bps`, détail moyen `0 bps`.
- `node --test tests/planning-postproduction.test.js` : **PASS, 46/46**, 0 échec/skip/todo, durée `198,956 ms`.
- `node --test tests/sprint8-dashboards.test.js` : **PASS, 13/13**, 0 échec/skip/todo, durée `2,495 s`.
- `npm test` : **PASS, 344/344**, 0 échec/cancelled/skip/todo, durée `8,750 s`.
- `npm run lint` : **PASS**.
- `npm run build` : **PASS**, 5 actifs runtime vérifiés.
- `git diff --check v0.5.0-rc4..b715f4ba1453ed9a73db3fd2f32e996957a700d2` : **PASS**.
- La tentative de smoke UI isolé a été interrompue avant démarrage ; aucune preuve navigateur supplémentaire n'est revendiquée par REVIEW. QA et SECURITY/PERFORMANCE ont fourni leurs verdicts indépendants séparément.

Empreintes contrôlées :

```text
app.js                                 0fc0dad429e78aa6aea63884f6d903939189e2793b6505b3d363d7e49cbc36cd
server.js                              504ae0263fbe8674f1ab26f23863e7ebe206ef854ccb1b698e0b7bc9ff07ee13
planning.css                           1e5227f04bb781756318676054242713664e07dee048dee4e664198dd3ed289b
tests/planning-postproduction.test.js  4e22027eaef93ae335c5687aabc9997bc1aaceb335afba4dbcfa70ba4c21df35
tests/sprint8-dashboards.test.js        d9a0b681dcc21b53807c4559301bd9a676227814161717691d22a6e91b98af02
```

## Handoff

Seul `docs/code-review.md` est modifié par cette REVIEW. Le candidat RC5 `b715f4ba1453ed9a73db3fd2f32e996957a700d2` est **REJECTED** avec 0 P0 et 1 P1. Retour DEV ciblé requis sur la définition/réconciliation de `occupancyGap`, ajout du cas de non-régression, puis re-REVIEW et gates aval impactés sur un nouveau hash exact.

---
