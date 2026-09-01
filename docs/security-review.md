# Analyse d'impact SECURITY — métadonnées RELEASE `0.6.0-rc2`

Date : 2026-08-30

Le passage de `package.json` à `0.6.0-rc2` (SHA-256 `aa90023d025139aecb3535a976dd1bbf4b4957c5e82c261df1b25faef6f6447a`) et les mises à jour `README.md` / `CHANGELOG.md` / statut sont exclusivement documentaires. Les empreintes produit approuvées restent strictement identiques : `app.js 9601017d92cf…`, `server.js 3f4b87eb8ee4…`, Planning `32464251b162…`, Devis `ba661c8cb654…`, OpenAPI `055f9a05f5f7…`. Aucun chemin runtime ne lit la version du package; **aucun re-gate SECURITY n'est requis**.

L'incohérence de rollback détectée pendant l'analyse est fermée : la documentation déclare désormais explicitement la migration additive `article-catalog-sage-pricing-v2` et exige d'exécuter `rollbackArticleCatalogPricingV2({ exportFile })` avec le code RC2 avant le retour applicatif vers RC1. La procédure conserve les contrôles déjà audités : marqueur et digest de sauvegarde, export neuf distinct des données actives, écriture privée `0600`, vérification de l'export avant restauration et avertissement sur la réapplication au redémarrage RC2. Les écritures post-migration quittant le fichier actif restent récupérables dans cet export. Aucun secret, commande distante, nouvelle permission ou exposition statique n'est ajouté.

Les chiffres RELEASE sont cohérents avec les rapports : REVIEW jusqu'à `191/191`, QA `170/170`, suite complète `368/368`, SECURITY sans vulnérabilité ouverte. Le verdict SECURITY final ci-dessous reste **APPROVED — 0 P0/P1/P2/P3** pour le candidat exact.

---

# Revalidation SECURITY finale — contraste Projet et historique Devis/PDF

Date : 2026-08-30

Candidat revalidé : `app.js` SHA-256 `9601017d92cf6884df6c74e3b688b15421b1f6b60c4fe99e692aabf3255b96aa`; `server.js` `3f4b87eb8ee4106b819878a0eb73f71516a92099d2fa9e43995a7582444b3af1`; `tests/planning-postproduction.test.js` `32464251b1622da22054f17e7b150104c044262e7d441ec411986f04fdc2b3c6`; `tests/quotes.test.js` `ba661c8cb654b403d6312aebf8a68d150fdaa301b2935239cdca6a805b0fa7f8`; OpenAPI `055f9a05f5f722345aa8237cb994395426af76314a75abd370e70d6e8aae2a97`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict

**APPROVED — 0 P0, 0 P1, 0 P2, 0 P3 ouvert.**

Ce verdict remplace le gate global et les revalidations partielles historiques ci-dessous pour ce candidat exact. Le P1 `REV-GLOBAL-20` est **fermé** : les deux chemins de création Projet proposent et envoient désormais la combinaison `#6553db` / `#ffffff`, dont le contraste calculé est supérieur ou égal à `4,5:1`; le smoke HTTP frais crée le Projet en `201`.

## Threat-check ciblé

- **Contraste et validation serveur :** `color` et `textColor` doivent chacun respecter strictement `#RRGGBB`, puis le serveur recalcule le ratio WCAG et refuse toute combinaison inférieure à `4,5:1` en `422`. Le contrôle UI, le bouton désactivé et l'aperçu ne constituent qu'un feedback; ils ne remplacent pas l'autorité serveur.
- **Création rapide et formulaire complet :** le payload rapide envoie les deux couleurs sûres. Le formulaire complet les initialise de la même façon, recalcule le ratio sur chaque saisie et bloque localement une combinaison illisible. Le serveur choisit aussi une couleur de texte noire ou blanche sûre si le client omet `textColor`.
- **Compatibilité legacy :** les anciennes couleurs mal contrastées sont rendues avec une couleur noire/blanche calculée, sans injection de la valeur legacy dans le style. Lors d'un PATCH sans changement de couleurs, le serveur répare `textColor` avant validation et l'audite dans la mutation normale. Preuve fraîche : un Projet historique `#7667f5` sans `textColor` passe de version 1 à 2 avec `textColor: #000000` et conserve les autres modifications.
- **XSS/CSS et accessibilité :** les valeurs utilisées comme variables CSS sont filtrées par l'expression hexadécimale stricte; les données textuelles restent échappées. L'information de statut demeure écrite dans la cellule et ne dépend pas uniquement de la couleur. Aucun nouveau `innerHTML` non échappé, URL, chemin ou contenu actif n'est introduit.
- **RBAC, tenant, CSRF et audit Projet :** création et modification restent sous `project.manage`, contexte société/site issu de la session, validation des propriétaires, contrôle d'origine/CSRF, idempotence, version optimiste, audit avant/après, persistance atomique et SSE après succès. Le correctif ne crée aucun chemin de contournement.
- **Historique Devis/PDF :** `professionalQuoteProjection` ne re-projette plus une ligne persistée depuis le Catalogue courant. Le détail, la liste et le PDF présentent donc le libellé et le snapshot historiques réellement signés, même après renommage ou archivage de l'Article; cela ferme le risque de dérive rétroactive et améliore la traçabilité. Les lignes nouvelles ou dont la source change continuent à capturer `articleSnapshot` et `appliedRateSnapshot` au moment de la mutation.
- **Isolation et exposition Devis :** la suppression de la re-projection n'élargit pas l'accès. `quoteById`/`quoteAllowed` vérifient toujours société, projet, site et scope d'entité avant lecture ou PDF. Les chaînes PDF restent normalisées et échappées; en-têtes `no-store`/`nosniff`, limite de 500 lignes et snapshots fiscal/commercial demeurent inchangés.
- **Secrets, logs et dépendances :** aucune dépendance, ressource distante, donnée sensible ou journalisation de corps/cookie/CSRF n'est ajoutée. La liste statique et le modèle de session ne changent pas.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| empreintes du candidat | **MATCH** |
| `node --check app.js && node --check server.js` | **PASS** |
| `node --test tests/planning-postproduction.test.js` | **54/54 PASS**, `147,05 ms` |
| `node --test tests/quotes.test.js` | **51/51 PASS**, `4 869,04 ms` |
| `node --test tests/article-catalog.test.js` | **5/5 PASS**, `609,79 ms` |
| `node --test tests/sprint8-security.test.js` | **4/4 PASS**, `2 201,86 ms` |
| `npm test` | **368/368 PASS**, 0 échec, `9 611,05 ms` |
| smoke POST Projet avec `#6553db/#ffffff` | **201**, couleurs et version 1 persistées |
| smoke PATCH legacy `#7667f5` sans `textColor` | **200**, réparation `#000000`, version 2 |
| `git diff --check` | **PASS** |

Les négatifs frais des suites couvrent notamment auth, origine/CSRF, rôles, société/site, scopes SSE/entité, version obsolète, prix/coût non autorisés, Article archivé/étranger et rendu legacy. Le test Devis ajouté confirme qu'une ancienne ligne sans snapshot conserve son libellé persisté après renommage puis archivage du Catalogue.

## Limites et handoff

La revue est une inspection du diff avec tests HTTP et tests DOM purs, pas un pentest externe, un fuzzing CSS/PDF ou une campagne multi-processus. Elle ne prouve pas le contraste de chaque couleur possible par capture visuelle; l'invariant serveur et les tests de ratio sont l'autorité. Toute modification d'une empreinte ci-dessus invalide ce verdict.

Gate SECURITY final : **APPROVED**. Fichier modifié : `docs/security-review.md` uniquement; `docs/project-status.md` reste à l'intégrateur conformément à la mission.

---

# Gate SECURITY global — candidat post-`v0.6.0-rc1`

Date : 2026-08-30

Base auditée : tag `v0.6.0-rc1` (`df0f02351b09bf9d64418ee5f864c6fe5cc4629f`). Candidat produit : `app.js` SHA-256 `404f4c608036dc0cbbf009e17f98493b7cba0c69cbd21d43fe6ef1ee7584d41c`, `server.js` `a410aa2a8a57932f570ef0e24445c33847d575f32b40ef78c470cc4daf95d025`, `planning.css` `7455ab68e6bb232acf6e45dce48d1ba78eb477f13bd238594f925bca0a1320cd`, `styles.css` `f4be1bf5bb9f977cc58a70d707a25520eb74e0e788950c0ab49f0b58699a9f27`, OpenAPI `b49948864cb9d08ad36382cfa8ccc3002cc56eeecfce6d42e68a132d2e0f8936`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict

**APPROVED — 0 P0, 0 P1, 0 P2, 0 P3 ouvert sur le diff global depuis `v0.6.0-rc1`.**

Ce verdict global remplace, pour ce candidat exact, les revalidations partielles Tarifs/Devis/PDF consignées plus bas. Il couvre Planning (déplacement/copie/annulation/rétablissement, `cellOverrides`, historique de route et gestes), Dashboard temporel, couleurs Projet, Catalogue Articles, éditeur de Devis et PDF.

## Threat-check et constats

- **Auth/session/CSRF et origine :** toutes les routes nouvelles ou affectées passent par `requireAuth`; les mutations sont soumises à `mutationGuard`, origine stricte et jeton CSRF. Les sessions restent opaques, expirables et liées au contexte société; aucun fallback prototype silencieux n'est introduit.
- **RBAC serveur :** Planning exige `planning.write`, Dashboard `dashboard.read`, Catalogue `article.read/article.manage`, Projet `project.manage`, Devis `quote.read/quote.manage`; override de prix et coût restent séparés par `quote.overridePrice` et `finance.cost.manage`. Le masquage UI n'est jamais utilisé comme autorisation.
- **Isolation société/site/entité :** `companyId` vient de la session. Les réservations et leurs overrides revalident projet, site, ressources source/cible et scopes d'entité. Le Dashboard construit ressources, réservations et documents avec `resourceAllowed`, `reservationSnapshotAllowed` et `quoteAllowed`. Les Articles et snapshots de Devis sont limités à la société; les accès hors contexte répondent sans divulgation.
- **Mutations Planning :** déplacement de cellule confirmé ou option impose version optimiste, cible active et autorisée, intervalle borné à 370 jours, conflit/capacité, override motivé, audit avant/après et idempotence. Copie unitaire et lot atomique (maximum 200 actions) recréent une seule réservation cible; annulation logique/rétablissement sont versionnés. Les replays revalident le périmètre courant et n'émettent pas de SSE en double.
- **Intégrité commerciale :** une ligne Article conserve `articleSnapshot` et `appliedRateSnapshot` pour la même source, y compris changement d'unité; un changement réel de source recapture l'Article actif. Les prix manuels exigent permission et motif, les coûts exigent la permission Finance, et l'audit/version du document restent l'autorité. Le PDF lit uniquement le snapshot autorisé du Devis.
- **Entrées/XSS/PDF :** couleurs Projet limitées à `#RRGGBB`; valeurs numériques, unités tarifaires et tailles sont validées/bornées. Les libellés dynamiques HTML utilisent `esc`, l'option Article historique utilise `createElement`/`textContent`, les champs utilisent `.value`; les couleurs ne peuvent injecter de CSS arbitraire. Le générateur PDF échappe parenthèses et antislashs, borne le texte et renvoie `nosniff`, `no-store` et un nom issu du numéro contrôlé.
- **Dashboard temporel :** `asOf` et le mois comparé sont strictement validés; le mois comparé doit être antérieur au mois courant. Les périodes sont calculées côté serveur dans le fuseau de la société et les données commerciales ne sont incluses qu'avec `quote.read`.
- **Navigation/gestes :** l'absorption du geste horizontal et `history.replaceState` ne touchent ni session ni autorisation et ne construisent que des routes hash internes. Aucun URL externe, HTML ou script n'est dérivé du geste.
- **SSE/abus/exposition :** SSE reste borné à une connexion par session, capacité globale, revalidation périodique des droits et filtrage société/site/type. Corps, lots, périodes, pagination et exports restent bornés. La liste statique demeure explicite et refuse encodages/chemins arbitraires; `data/`, serveur, tests, docs et `.git` ne sont pas servis.
- **Secrets, logs, dépendances :** aucun secret ou jeton n'est ajouté au diff; les journaux structurés n'enregistrent ni corps, ni cookie, ni CSRF. Les sauvegardes de migration tarifaire sont privées (`0600`) et vérifiées par digest. Aucune dépendance, ressource distante ou accès réseau runtime n'est ajouté.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| empreintes candidat et diff depuis le tag | **MATCH**; 19 fichiers, `1 892` insertions / `80` suppressions |
| `node --check app.js && node --check server.js` | **PASS** |
| `node --test tests/api.test.js` | **43/43 PASS** |
| `node --test tests/foundations.test.js` | **17/17 PASS** |
| `node --test tests/planning-postproduction.test.js` | **54/54 PASS** |
| `node --test tests/article-catalog.test.js` | **5/5 PASS** |
| `node --test tests/quotes.test.js` | **50/50 PASS** |
| `node --test tests/sprint8-security.test.js` | **4/4 PASS** |
| `npm test` | **367/367 PASS**, 0 échec, `9 779,61 ms` |
| `git diff --check` | **PASS** |

Les négatifs frais couvrent notamment absence d'auth, CSRF/origine, rôles, autre société/site, portée SSE, replay après réduction de scope, tenant forgé, version obsolète, override/coût non autorisés, source Article archivée ou étrangère, conflit Planning et ressource cible invalide.

## Limites et handoff

La revue combine inspection du diff, tests HTTP et tests DOM purs; elle n'est ni un pentest externe, ni un fuzzing navigateur/lecteur PDF, ni une analyse multi-processus. Le runtime local monoprocessus et l'accès au poste hôte restent dans le modèle de menace RC1. Toute modification d'une empreinte produit ci-dessus invalide ce verdict.

Gate SECURITY global : **APPROVED**. Fichier modifié : `docs/security-review.md` uniquement; la mise à jour de `docs/project-status.md` reste à l'intégrateur conformément à la mission.

---

# Revalidation SECURITY — ordre d’initialisation éditeur REV-QUOTE-ARTICLE-16

Date : 2026-08-30

Candidat revalidé : `app.js` SHA-256 `404f4c608036dc0cbbf009e17f98493b7cba0c69cbd21d43fe6ef1ee7584d41c`; `server.js` SHA-256 `a410aa2a8a57932f570ef0e24445c33847d575f32b40ef78c470cc4daf95d025`; `tests/article-catalog.test.js` SHA-256 `7618fc6e704def68f3d455aba41d3f97668617ba2900902d7d84f34683c44f23`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict

**APPROVED — 0 P0, 0 P1, 0 P2, 0 P3 ouvert sur le correctif et le lot Tarifs Articles + Éditeur/PDF Devis.**

`REV-QUOTE-ARTICLE-16` déplace uniquement l’appel de synchronisation UI avant la restauration des champs de la ligne existante. L’option Article historique est donc sélectionnée et synchronisée, puis les montants, l’unité et le coût réellement persistés sont restaurés. Un tarif manuel autorisé et son coût ne sont plus remplacés visuellement par le tarif catalogue/snapshot lors de l’ouverture; les contrôles serveur byte-identiques restent l’autorité.

## Override, coût, RBAC et intégrité

- `activeStockEditor.line` est défini avant `syncQuoteArticleTariff(false)`. La synchronisation peut donc résoudre correctement le snapshot historique; elle ne lit jamais un autre document ou tenant.
- Après cette synchronisation, l’éditeur restaure `line.unit`, `line.unitPriceMinor`, `line.costUnitMinor` et fixe `price.dataset.resolvedMinor` au prix persistant. Une soumission sans changement n’invente donc ni override ni dérive de coût.
- Si l’opérateur modifie ensuite le prix, `manualPriceOverridePayload` compare au `resolvedMinor` restauré. Le serveur exige toujours `quote.overridePrice` et un motif; le test API confirme qu’un override autorisé à `73 500` produit `manualPriceTrace` et conserve le snapshot.
- Le coût n’est envoyé que si `can('finance.cost.manage')`; le serveur vérifie à nouveau `finance.cost.manage`. Le test confirme la persistance de `31 000` puis sa conservation lors d’un PATCH de quantité. Les négatifs de la suite Devis couvrent le refus d’un coût sans permission.
- L’Article archivé reste la même source : snapshot et tarif historique sont conservés. Toute autre source repasse par `quoteCatalogSource`, société, activité et `article.read`. Audit, version optimiste, persistance atomique et SSE sont inchangés.
- Les mécanismes XSS approuvés au gate précédent sont byte-identiques : option par `createElement`/`.textContent`, champs via `.value`, références via `esc()`. Aucun changement CSRF/session, tenant, PDF, secret/log ou exposition statique.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| empreintes candidat | **MATCH** pour `app.js`, `server.js` et le test Catalogue |
| `node --check app.js` / `node --check server.js` | **PASS** |
| `node --test tests/article-catalog.test.js` isolé | **PASS, 5/5**, `583,64 ms`; archive, override, coût et ordre UI couverts |
| `node --test tests/quotes.test.js` | **PASS, 50/50**, `6 143,06 ms` en campagne parallèle |
| `node --test tests/sprint8-security.test.js` | **PASS, 4/4**, `4 411,72 ms` en campagne parallèle |
| PATCH ciblés isolés | Article archivé, override/coût, conservation et nouvelle source : `5–6 ms`, statuts `200` |
| `git diff --check` avant rapports | **PASS** |

## Limites et handoff

Le test d’ordre est statique sur la séquence source et les tests API valident l’effet métier; aucun navigateur réel n’a simulé la saisie caractère par caractère. Le backend étant byte-identique, les preuves antérieures RBAC/tenant/snapshot/audit restent applicables. Toute nouvelle empreinte impose une revalidation.

Gate SECURITY Tarifs Articles + Éditeur/PDF Devis : **APPROVED**. Le verdict `REV-QUOTE-ARTICLE-15` inférieur reste historique et est remplacé par celui-ci. Fichier modifié : `docs/security-review.md` uniquement; statut projet laissé à l’intégrateur.

---

# Revalidation SECURITY — option Article historique REV-QUOTE-ARTICLE-15

Date : 2026-08-30

Candidat revalidé : `app.js` SHA-256 `894956d4bacd1ab9462c1bd1c4bf9aa4e43d6c246d44c61c197a5f1e489c0ef9`; `server.js` SHA-256 `a410aa2a8a57932f570ef0e24445c33847d575f32b40ef78c470cc4daf95d025`; `tests/article-catalog.test.js` SHA-256 `f852af2fd3461c0588b0a3c4a52eebed94fedfc7dbc3a8fcbe2508c595d57700`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict

**APPROVED — 0 P0, 0 P1, 0 P2, 0 P3 ouvert sur le correctif et le lot Tarifs Articles + Éditeur/PDF Devis.**

`REV-QUOTE-ARTICLE-15` permet d’éditer une ligne dont l’Article a quitté le catalogue actif sans réinjecter de HTML et sans étendre l’autorité du client. L’option historique n’est produite que pour une ligne existante `sourceType:"article"`, munie d’un `sourceId` et d’un `articleSnapshot`, lorsque ce même identifiant est absent du catalogue autorisé chargé. Le serveur byte-identique reste l’unique autorité sur la mutation et le snapshot.

## XSS, autorisations et intégrité

- `quoteHistoricalArticleOption` retourne deux chaînes de présentation. L’appelant crée un élément `option`, renseigne `.value` et `.textContent`, puis l’ajoute au `select`; référence, désignation et identifiant historiques ne passent jamais par `innerHTML`.
- L’option n’est ajoutée que dans `openQuoteLineDrawer(line)` lorsque `line` existe. La création d’une nouvelle ligne ne peut donc pas inventer une source archivée depuis ce mécanisme.
- Le `catalog.some(...)` vérifie strictement `sourceType==='article'` et l’égalité d’identifiant. Si l’Article est encore actif/visible, aucune option historique dupliquée n’est créée. Les lignes manuelles et les snapshots absents retournent `null`.
- Choisir/conserver cette option ne réactive pas l’Article et ne confère aucun `article.read` supplémentaire : elle référence le snapshot déjà inclus dans un Devis accessible. Au PATCH, `quote.manage`, `quoteAllowed`, société/site et version restent vérifiés; `sameSource` conserve le snapshot historique. Choisir une autre source active repasse par les contrôles Article du serveur.
- Une falsification de la valeur DOM ne permet pas de charger un Article archivé arbitraire : seule l’identité déjà attachée à la ligne bénéficie du chemin `sameSource`; une autre identité passe par `quoteCatalogSource` et doit être active, de la société et lisible.
- `syncQuoteArticleTariff` affecte désignation/prix aux propriétés de formulaire et son message via `.textContent`. Les références du Devis restent rendues avec `esc()`. Aucun nouveau canal XSS, tenant, RBAC, CSRF, PDF, secret/log ou exposition statique n’est ajouté.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| empreintes candidat | **MATCH** pour `app.js`, `server.js` et le test Catalogue |
| `node --check app.js` / `node --check server.js` | **PASS** |
| `node --test tests/article-catalog.test.js` | **PASS, 5/5**, `588,13 ms`; option archivée/active/manuelle couverte |
| `node --test tests/quotes.test.js` | **PASS, 50/50**, `4 828,30 ms` |
| `node --test tests/sprint8-security.test.js` | **PASS, 4/4**, `2 401,64 ms` |
| négatifs hérités | tenant forgé `400`, autre société `404`, Catalogue non autorisé `403`, version obsolète `409` |
| `git diff --check` avant rapports | **PASS** |

## Limites et handoff

La vérification XSS est une inspection statique du sink et un test pur du helper; elle ne remplace pas un fuzzing DOM dans un navigateur réel. Le serveur étant byte-identique au gate précédent, ses preuves de snapshot, audit, tenant et tarification restent applicables. Toute modification ultérieure des empreintes impose une nouvelle revalidation.

Gate SECURITY Tarifs Articles + Éditeur/PDF Devis : **APPROVED**. Le verdict `REV-QUOTE-ARTICLE-14` immédiatement inférieur est historique et remplacé par le présent candidat. Fichier modifié : `docs/security-review.md` uniquement; statut projet laissé à l’intégrateur.

---

# Revalidation finale SECURITY — correction UI snapshot Article REV-QUOTE-ARTICLE-14

Date : 2026-08-30

Candidat revalidé : `app.js` SHA-256 `2504722ff6cc67722c410b4513594fb57aa38711b26445d0f8a89f90dd978115`; `server.js` SHA-256 `a410aa2a8a57932f570ef0e24445c33847d575f32b40ef78c470cc4daf95d025`; `tests/article-catalog.test.js` SHA-256 `6051a48f89c83031a406dd8f5eff0c72d3a4f25440ca3d0bb22f0975dba2575d`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict final

**APPROVED — 0 P0, 0 P1, 0 P2, 0 P3 ouvert sur le correctif final et le lot Tarifs Articles + Éditeur/PDF Devis.**

`REV-QUOTE-ARTICLE-14` aligne l’éditeur sur l’autorité serveur sans déplacer cette autorité dans le navigateur. `quoteArticlePricingSource` sélectionne le snapshot figé uniquement lorsque `sourceType`, `sourceId` et `articleSnapshot.articleId` désignent la ligne existante; un véritable changement de source reprend l’Article du catalogue courant. La correction serveur précédemment approuvée reste byte-identique et continue de contrôler source, snapshot, prix, permissions, société et version.

## XSS, tenant, RBAC et snapshot

- Le helper UI ne lit ni `companyId`, ni permission, ni route arbitraire. Il travaille seulement sur la ligne Devis déjà reçue et le catalogue déjà filtré par l’API. Sa décision n’est jamais une décision d’autorisation.
- Au submit, l’UI transmet `sourceType/sourceId`, unité, quantité et éventuel override. Le serveur reste l’autorité : `quote.manage`, `quoteAllowed`, `article.read`, société/site, source active, version optimiste et motif d’override sont réévalués avant écriture.
- Même source : le libellé, la référence et les cinq tarifs affichés viennent du `articleSnapshot` N. Changement de source : le test force un identifiant différent et vérifie que le helper rend le catalogue N+1, sans conserver le flag `frozenSnapshot`.
- Le spread de l’item n’altère ni la ligne, ni le catalogue, ni le snapshot. Les données du snapshot sont assignées aux propriétés `.value` des champs; le message de conséquence utilise `.textContent`; les références du tableau Devis utilisent `esc()`. Aucun `innerHTML` nouveau ne reçoit la désignation, le code ou le tarif non échappé.
- Le client peut toujours être falsifié, mais cela ne permet pas de choisir un snapshot ou un prix serveur arbitraire : la correction backend byte-identique recapture une nouvelle source et conserve/résout le snapshot existant selon l’identité réelle. Audit, version documentaire, persistance atomique et SSE restent inchangés.
- Aucun changement de session/CSRF, cookies, exposition statique, PDF, secrets/logs, dépendance ou accès réseau n’est présent dans ce delta UI.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| empreintes candidat | **MATCH** pour `app.js`, `server.js` et le test Catalogue |
| `node --check app.js` / `node --check server.js` | **PASS** |
| `node --test tests/article-catalog.test.js` isolé | **PASS, 5/5**, `548,85 ms`; helper N/N+1 couvert |
| `node --test tests/quotes.test.js` | **PASS, 50/50**, `4 985,52 ms` lors de la campagne parallèle |
| `node --test tests/sprint8-security.test.js` | **PASS, 4/4**, `3 279,61 ms` |
| contrôles négatifs hérités | tenant forgé `400`, autre société `404`, mutation Catalogue non autorisée `403`, version obsolète `409` |
| `git diff --check` avant rapports | **PASS** |

## Limites et handoff

La revue DOM est statique et ciblée, complétée par le test pur du helper; aucun navigateur réel ni fuzzing de chaîne hostile n’a été exécuté. L’absence de modification serveur permet de réutiliser les preuves d’intégrité/audit du gate immédiatement précédent, dont l’empreinte `server.js` est identique. Toute nouvelle modification d’une des trois empreintes impose une revalidation.

Gate SECURITY final Tarifs Articles + Éditeur/PDF Devis : **APPROVED**. Fichier modifié : `docs/security-review.md` uniquement; mise à jour de `docs/project-status.md` laissée à l’intégrateur.

---

# Revalidation SECURITY — changement d’unité depuis le snapshot Article figé

Date : 2026-08-30

Candidat revalidé : `server.js` SHA-256 `a410aa2a8a57932f570ef0e24445c33847d575f32b40ef78c470cc4daf95d025`; `tests/article-catalog.test.js` SHA-256 `b0b8a92951728a059100bfba3d3df4ad6936ed907ded71597135fb60436dbd68`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict revalidé

**APPROVED — 0 P0, 0 P1, 0 P2, 0 P3 ouvert sur ce correctif et le lot Tarifs Articles + Éditeur/PDF Devis.**

La fermeture de `SEC-ARTICLE-QUOTE-01` reste valide et couvre désormais le changement d’unité. Lorsque l’identité Article ne change pas, le tarif de la nouvelle unité est résolu depuis `existing.articleSnapshot.tariffsMinor`, donc depuis la version contractuelle N, avant tout fallback vers le catalogue courant. Une véritable nouvelle source repasse au contraire par `quoteCatalogSource` et capture le nouvel Article autorisé.

## Intégrité commerciale et audit

- Le scénario de non-régression crée `66-MONT` en V2 (`jour` à `68 000`, `semaine` à `306 000`), fait évoluer le catalogue en V3, conserve V2 sur un PATCH de quantité, puis change l’unité en `semaine`. La ligne reste liée au snapshot V2, prend `306 000`, et son `appliedRateVersion`, son identifiant tarifaire et `baseSaleUnitMinor` référencent V2.
- `articleSnapshotRate` n’accepte que le snapshot dont `articleId` correspond exactement à `sourceId`, une unité de la liste fermée et un montant décimal présent. Une unité invalide reste refusée; un snapshot incomplet ne devient pas un prix implicite.
- Le changement réel vers `longestSource.id` rend `sameSource=false` : la route exige à nouveau la source active, la même société et `article.read`, puis capture sa référence, sa désignation et son tarif. Le test confirme un nouveau `articleId`, un snapshot différent et le tarif `forfait` de la nouvelle source.
- Les versions historiques conservent le snapshot d’origine. Les mutations de ligne restent soumises à `quote.manage`, `quoteAllowed`, contrôle optimiste, audit `quote.lineUpdated`, persistance atomique et SSE après succès. Le changement d’unité et son nouveau `appliedRateSnapshot` sont ainsi traçables dans la version documentaire, sans override manuel silencieux.
- Aucun impact sur auth/session/CSRF, isolation société/site, XSS, génération PDF, exposition statique, secrets/logs ou bornes d’abus n’est introduit par ce delta.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| empreintes candidat | **MATCH** pour `server.js` et le test Article |
| `node --test tests/article-catalog.test.js` | **PASS, 5/5**, `549,44 ms`; PATCH quantité `5 ms`, changement d’unité `6 ms`, changement de source `5 ms` |
| `node --test tests/quotes.test.js` | **PASS, 50/50**, `4 354,08 ms` |
| campagne ciblée cumulée | **PASS, 55/55**, 0 échec/skip/todo |
| suite complète communiquée par l’intégrateur | **PASS, 367/367**; non relancée par ce reviewer ciblé |
| `git diff --check` avant rapports | **PASS** |

## Limites et handoff

La revalidation autonome est ciblée sur l’intégrité Article/tarif et les consommateurs Devis; la campagne complète `367/367` est une preuve transmise par l’intégrateur, clairement distincte des 55 tests exécutés ici. La revue ne remplace ni fuzzing PDF ni E2E visuel navigateur. Toute modification ultérieure des empreintes impose une nouvelle revalidation.

Gate SECURITY Tarifs Articles + Éditeur/PDF Devis : **APPROVED**. Fichier modifié : `docs/security-review.md` uniquement; mise à jour de `docs/project-status.md` laissée à l’intégrateur.

---

# Revalidation SECURITY — fermeture de SEC-ARTICLE-QUOTE-01

Date : 2026-08-30

Candidat revalidé : `server.js` SHA-256 `11ddba279a199942e3787849ebfa0b06fc9b414552aa7ee868d904c618efe86c`; `tests/article-catalog.test.js` SHA-256 `0b3da91772e11791a14c3dace67ee1345c6bf5a822dc3c8323a748ed3f659ab9`.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict revalidé

**APPROVED — 0 P0, 0 P1, 0 P2, 0 P3 ouvert sur ce correctif et le lot Tarifs Articles + Éditeur/PDF Devis.**

`SEC-ARTICLE-QUOTE-01` est fermé. Lorsque le PATCH renvoie la même identité `sourceType/sourceId`, `quoteLineFromInput` réutilise désormais `existing.articleSnapshot`. Si l'unité, la période de prestation et le prix restent inchangés, il réutilise aussi `appliedRateId`, `appliedRateVersion` et `appliedRateSnapshot`. Une édition de quantité ne peut donc plus recapturer silencieusement la version courante du catalogue ni créer une incohérence entre désignation, référence Article, prix appliqué et preuve tarifaire.

## Intégrité et audit revalidés

- L'identité de source est comparée après normalisation. Une source inchangée conserve le snapshot contractuel; une véritable nouvelle source repasse par `quoteCatalogSource`, ses contrôles société/site/RBAC et capture explicitement son propre snapshot.
- Le scénario de non-régression crée une ligne sur l'Article V2 à `68 000`, fait évoluer le catalogue en V3 à `70 000`, puis PATCH la quantité avec la même source explicitement renvoyée. Le résultat conserve byte-identiques `articleSnapshot`, `appliedRateSnapshot` et le prix V2; la version documentaire historique conserve également le snapshot V2.
- Le mécanisme ne masque pas une resynchronisation tarifaire légitime : un changement d'unité, de période ou de prix désactive la préservation du snapshot tarifaire et emprunte les validations/permissions existantes. Un changement de source recapture le nouvel Article.
- La mutation reste soumise à `quote.manage`, `quoteAllowed`, contrôle optimiste de version, audit `quote.lineUpdated`, persistance atomique et SSE après succès. Aucun champ de tenant, secret, contenu HTML/PDF, chemin statique ou donnée de coût supplémentaire n'est introduit.
- Le bypass de relecture du catalogue pour une source inchangée ne confère pas d'accès à un nouvel Article : il ne rend que le snapshot déjà contenu dans un Devis auquel l'acteur est autorisé. Il préserve ainsi la preuve contractuelle même si le catalogue courant est désactivé ou modifié.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| empreintes candidat | **MATCH** pour `server.js` et le test Article |
| `node --check server.js` | **PASS** |
| `node --test tests/article-catalog.test.js` | **PASS, 5/5**, durée `551,74 ms`; PATCH correctif HTTP `200` en `6 ms` |
| `node --test tests/quotes.test.js` | **PASS, 50/50**, durée `4 116,84 ms` |
| campagne ciblée cumulée | **PASS, 55/55**, 0 échec/skip/todo |
| `git diff --check` avant rapports | **PASS** |

## Limites et handoff

La revalidation porte sur le correctif d'intégrité et ses consommateurs directs; les contrôles auth/CSRF/RBAC/isolation, XSS/PDF, secrets/logs et abus du rapport immédiatement ci-dessous restent applicables car leurs chemins n'ont pas été modifiés par ce delta. Il ne s'agit pas d'un fuzzing PDF ni d'une validation visuelle navigateur. Toute modification ultérieure des empreintes impose une nouvelle analyse d'impact.

Gate SECURITY Tarifs Articles + Éditeur/PDF Devis : **APPROVED**. Le constat historique `SEC-ARTICLE-QUOTE-01` reste documenté ci-dessous comme preuve de la boucle REVIEW → DEV → revalidation. Fichier modifié : `docs/security-review.md` uniquement; mise à jour de `docs/project-status.md` laissée à l'intégrateur.

---

# Gate SECURITY indépendant — Tarifs Articles + Éditeur/PDF Devis

Date : 2026-08-30

Candidat observé : HEAD `6cb10c90a12077ef26442c0a8a80e06ad7cd8d9e`, avec lot non commité identifié par les empreintes ci-dessous.

Reviewer : agent indépendant `security_performance_tarifs_devis_pdf`.

## Verdict

**NOT APPROVED — 0 P0, 1 P1, 0 P2, 0 P3 ouvert sur ce lot.**

Le catalogue tarifaire, les routes Devis et la génération PDF restent correctement protégés par session, scopes, CSRF/Origin et RBAC. Cependant, un PATCH d'une ligne Article qui renvoie son `sourceType/sourceId` inchangé recapture silencieusement l'Article courant. Après modification du catalogue, une simple édition de quantité peut donc remplacer le snapshot historique, la désignation et les références de tarif de la ligne sans action explicite de changement d'Article ni audit de cette dérive. Cette rupture d'intégrité et de traçabilité commerciale est bloquante.

## P1 ouvert

### SEC-ARTICLE-QUOTE-01 — snapshot Article recapturé silencieusement lors d'un PATCH de ligne

`quoteLineFromInput` conserve correctement `existing.articleSnapshot` seulement lorsque `input.sourceType` et `input.sourceId` sont tous deux absents. L'éditeur renvoie toutefois ces champs sur une modification ordinaire. `quoteCatalogSource` recharge alors la version courante de l'Article et `articleCatalogSnapshot(item)` remplace le snapshot figé, même si l'identité de source n'a pas changé.

Après un changement du catalogue de la version 2 à la version 3, le scénario suivant est possible sur un devis brouillon :

1. ligne créée et figée avec désignation/tarif Article V2 ;
2. Article modifié en V3 ;
3. PATCH de la seule quantité, avec le même `sourceType:"article"` et le même `sourceId` ;
4. ligne enregistrée avec snapshot/désignation V3, tandis que son prix historique peut rester V2 et que `appliedRateSnapshot` référence le tarif V3.

L'audit `quote.lineUpdated` ne consigne ce changement que comme override si `unitPriceMinor` change; il ne trace donc pas la recapture implicite du snapshot ni l'incohérence prix/référence. La correction doit préserver `existing.articleSnapshot` et ses références tarifaires lorsque l'identité Article ne change pas, ou exiger une commande explicite et auditée de resynchronisation. Ajouter un négatif : modifier Article V2→V3, PATCH quantité avec source inchangée, puis vérifier snapshot/désignation/prix/référence tarifaire V2 byte-identiques.

## Entrées, autorité et intégrité

- `companyId` n'est jamais accepté depuis les commandes Article : `assertNoTenantFields` ferme les champs de tenant et les recherches/mutations sélectionnent la société de session. Le test de contexte croisé retourne `404` et un catalogue vide.
- Les lectures Article exigent `article.read`; création et modification exigent `article.manage`. Les routes Devis/PDF exigent `quote.read` ou `quote.manage` selon la méthode, puis `quoteAllowed` vérifie société, projet, site et scope d'entité avant accès.
- `tariffsMinor` est un objet fermé aux cinq unités autorisées, chaque valeur est un entier positif borné à l'int64 monétaire. Les codes sont bornés et validés, les désignations à 240 caractères, les motifs à 200 caractères. Les lignes d'un document sont bornées à 200 à la création et 500 après ajouts successifs.
- Une modification Article exige un motif, la version courante et produit une révision append-only plus un audit. Une lecture simple conserve le snapshot historique, mais le P1 `SEC-ARTICLE-QUOTE-01` montre que son immutabilité n'est pas préservée par un PATCH ordinaire renvoyant la même source.
- Les montants restent calculés en `BigInt`, les overrides tarifaires exigent la permission et le motif dédiés, et les valeurs hors int64 sont refusées avant écriture.
- La migration tarifaire V2 vérifie la source locale versionnée, l'identité des désignations, écrit une sauvegarde privée `0600` et le rollback exige un export de reprise distinct, vérifié et `0600`.

## XSS, PDF, exposition et abus

- L'interface Article et l'éditeur Devis rendent les valeurs métier avec `esc()`/`inputValue()`; aucune désignation ou référence n'est concaténée dans un attribut ou un sink HTML sans échappement.
- Le générateur PDF n'interprète ni HTML, ni URL, ni fichier utilisateur. `pdfAscii` retire les caractères non imprimables et échappe les délimiteurs de chaînes PDF. La référence SAGE est bornée à 40 caractères et les désignations à 240 caractères; la pagination est calculée sur un maximum de 500 lignes.
- La route PDF utilise `Content-Type: application/pdf`, `Content-Disposition: inline` avec numéro généré côté serveur, `Cache-Control: no-store` et `X-Content-Type-Options: nosniff`.
- La réponse client ne contient pas `costTotal`, marge ou coût interne; le test PDF vérifie explicitement leur absence.
- Aucun actif distant, SaaS, CDN, dépendance npm ou accès réseau d'exécution n'est ajouté. La liste blanche des fichiers statiques reste inchangée; le nouveau JSON référentiel n'est pas exposé comme fichier statique.
- Les bornes à 500 lignes et 240 caractères limitent l'amplification CPU/mémoire du PDF. La mesure PERFORMANCE parallèle confirme `27,59 ms` p95 pour 500 désignations longues, sans signal de déni de service local sur ce plafond.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `node --test tests/article-catalog.test.js` | **PASS, 5/5**, durée `555,70 ms` |
| `node --test tests/quotes.test.js` | **PASS, 50/50**, 0 échec (campagne parallèle fraîche) |
| `node --test tests/sprint8-security.test.js` | **PASS, 4/4**, durée `2 173,24 ms` |
| `node --check server.js` / `node --check app.js` | **PASS** |
| `git diff --check` | **PASS** avant rapport |
| négatifs Article | non-admin `403`, tarif hors borne `422`, tenant forgé `400`, scope société croisé `404`, version obsolète `409` |
| négatifs Devis | permission d'override `403`, scope site/société `404`, version obsolète `409`, montant hors borne `422` |
| inspection ciblée | auth/session, Origin/CSRF, RBAC, scopes, XSS, PDF, logs, secrets, migration/rollback et bornes relus |

Empreintes SHA-256 du candidat :

```text
server.js                                      fe058707cb39cfac16face519ded6ebbaa83b8e06c85b0ce0cb4e931251a3a49
app.js                                         4bcb5fcb7669da6f8779e71973df95467ad27dde7e43ee3b002106adc6085bb1
referentials/article-catalog-sage-pricing-v2.json 8787dd307faca61d3bb12dbf05274ec742179e5bb4504bad475bbed35bc1e053
tests/article-catalog.test.js                   9773657dfe9ee9a9ac9d9f0436331881547332db80ce881a53f51eea1ebe5624
tests/quotes.test.js                            6a99884d758321269bb2d715e5b2e14d4a340ba017e6fe10d278423014ab7e9e
```

## Limites et handoff

La revue XSS/DOM et PDF est statique et automatisée; elle ne constitue pas un fuzzing exhaustif du format PDF ni une inspection de toutes les versions de lecteurs PDF natifs. Le navigateur réel et la présentation visuelle relèvent du gate E2E; ils n'ont pas révélé de nouveau canal de sécurité dans le périmètre inspecté. Toute modification ultérieure des empreintes ci-dessus impose une revalidation d'impact.

Gate SECURITY Tarifs Articles + Éditeur/PDF Devis : **NOT APPROVED** jusqu'à fermeture de `SEC-ARTICLE-QUOTE-01`, puis revalidation ciblée et aval. Fichier modifié : `docs/security-review.md` uniquement; mise à jour de `docs/project-status.md` laissée à l'intégrateur conformément à l'ownership imposé.

---

# Revalidation terminale SECURITY — existence documentaire à la date de situation

Date : 2026-08-26

Candidat applicatif exact : `14d8ebea3019fa2a1d941eeefcb0ede24098ee38`

HEAD observé : `2631ee2b2023f8bbb9d4796d23b567e9d11fcf84` ; le commit postérieur au candidat est documentaire uniquement.

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 0 P2, 0 P3 sur le correctif terminal.**

Le document n'existe désormais dans la lecture historique que si `createdAt <= asOf` ; `taxDate` reste ensuite la date métier d'affectation aux agrégats. La synthèse principale et la comparaison reconstruisent toutes deux « Budget non converti » à partir des seuls événements de conversion visibles. Le constat `REV-MONTHLY-03` est fermé et aucun contournement RBAC/scope ni canal de fuite n'est ajouté.

## Temporalité et historique

- Le préfiltre utilise `createdAt || taxDate` pour l'existence. Un Devis fiscalement daté avant la situation mais créé après celle-ci n'entre donc ni dans le CA devisé, ni dans la signature, ni dans la conversion du Budget.
- Une fois le document existant, `documentDate` conserve `taxDate || createdAt` pour son rattachement au mois civil. La correction sépare correctement existence et date métier au lieu de substituer l'une à l'autre.
- `visibleAt(conversionDate)` continue d'imposer `createdAt <= asOf`. Pour une lecture historique (`asOf` présent), `unconvertedBudgets` ne consulte plus le statut courant `converted` : seul un Devis source visible retire le Budget.
- Le test de non-régression place un Budget daté du 2 août, marqué aujourd'hui `converted`, et son Devis source créé le 30 août. Au 25 août, la synthèse principale conserve le Budget; elle retourne `700000` sur les deux Budgets historiques attendus, tandis que la comparaison courante retourne `300000` sur le seul Budget du mois.
- Le CA signé conserve la correction précédente : `acceptedAt` demeure la source historique même après `replaced`, et une acceptation future reste exclue.

## Autorisation, scopes et anti-fuite

- `dashboard.read` reste vérifié avant toute agrégation ; son absence produit `403 DASHBOARD_FORBIDDEN`.
- Sans `quote.read`, le tableau `documents` n'est jamais construit : synthèse et deux blocs comparatifs restent `status:"unavailable"`, sans montant ni compteur dérivé.
- Société, site, projet, devis et ressource continuent de passer respectivement par l'identité de session, `siteAllowed`, `projectAllowed`, `quoteAllowed`, `resourceAllowed` et `reservationSnapshotAllowed` avant calcul.
- Les deux modifications sont des prédicats de lecture. Elles n'affectent ni mutation, ni persistance, ni audit, ni SSE, ni CSRF/session, ni exposition statique.
- Aucun sink DOM n'est modifié par ce candidat; `app.js` est byte-identique au candidat post-RC6 déjà approuvé.

## Preuves et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| candidat applicatif | `14d8ebea3019fa2a1d941eeefcb0ede24098ee38` |
| diff applicatif | 2 lignes modifiées dans `server.js`, 3 assertions ajoutées au test dashboard |
| `node --test tests/sprint8-dashboards.test.js tests/quotes.test.js tests/foundations.test.js` | **PASS, 87/87**, durée `7 294,46 ms` |
| contrôle fonctionnel ciblé | Devis créé après cutoff exclu; synthèse globale Budget non converti réconciliée à `700000` |
| REVIEW / QA indépendantes | **APPROVED**, selon handoff intégrateur sur ce candidat |

Hashes SHA-256 : `server.js` `4aea5ee9b9f89851f31c61a302800607e1e65da54438f01a68acf4c16ca10376`; `app.js` `bd08f1fd8f5711a1245c3084f0fad0f11f036962039b99690c84df74762da3e7`; test dashboard `7e4799d7729ec54758d53272ffb5f1f9924bc415f64c88f057f62e575eebdf8a`.

Conformément à la demande terminale, ce reviewer n'a pas relancé une seconde suite complète après les 87 tests ciblés; la campagne complète appartient à la QA indépendante déjà approuvée. La revue DOM reste statique, sans navigateur. Les risques historiques non impactés consignés plus bas ne sont pas déclarés fermés.

Gate SECURITY terminal : **APPROVED**. Fichier modifié : `docs/security-review.md` uniquement ; statut projet laissé à l'intégrateur.

---

# Re-gate SECURITY indépendant post-RC6 — cutoff et historique mensuel

Date : 2026-08-26

Candidat applicatif exact : `db23552b898bc7fc8c75bdae11b1916daba4df0a`

HEAD observé : `68f16f47201e21c16f9b5eefbf35ddd3bc657770` ; l'unique différence après le candidat est `docs/project-status.md`, sans impact applicatif.

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 0 P2, 0 P3 sur le correctif post-RC6.**

`SEC-RC6-COMP-01` est fermé. Le CA signé est désormais reconstruit depuis `acceptedAt` sans dépendre du statut courant : un devis ensuite `replaced` demeure acquis à son mois d'acceptation. La borne `asOf` interdit simultanément d'anticiper une acceptation ou une conversion future. `dashboard.read` ferme toute la Vue d'ensemble et `quote.read` masque les trois agrégats commerciaux sans faux zéro ni compteur indirect.

## Temporalité et intégrité historique

- `signedDate` utilise `acceptedAt`; le fallback `updatedAt/createdAt` est limité aux anciens devis encore `accepted`. Un document remplacé avec son `acceptedAt` reste donc historique, tandis qu'un brouillon sans acceptation n'est jamais signé.
- `visibleAt(date)` exige une date non vide et `date <= asOf`. Le mois courant utilise l'intervalle semi-ouvert `[premier jour, asOf + 1 jour)`, ce qui inclut la journée de situation sans lire le futur du mois.
- Les conversions utilisent leur date de création, doivent être visibles à `asOf` et antérieures à la fin de la période. Un budget converti le 30 août reste ainsi non converti au cutoff du 25 août et à la clôture d'un mois antérieur.
- Reproducteur volumétrique indépendant sur juin : **167** devis acceptés attendus, dont **56** désormais `replaced`; le read-model restitue **167/167**. Le test ciblé confirme aussi qu'une acceptation au 30 août n'entre pas dans la situation du 25 août.
- `SEC-RC6-COMP-01` passe donc de P1 ouvert à **fermé**.

## RBAC, scopes et absence de fuite

- Sans `dashboard.read`, le read-model échoue avant agrégation avec `403 DASHBOARD_FORBIDDEN` et `missingPermissions:["dashboard.read"]`.
- Avec `dashboard.read` mais sans `quote.read`, `commercial`, `comparison.current.commercial` et `comparison.selected.commercial` renvoient uniquement `status:"unavailable"`. Le JSON ne contient aucun champ `RevenueMinor`; `sources.documentCount` vaut zéro.
- Les ressources restent filtrées par société, site et entité via `resourceAllowed`; les réservations par société, site, projet, réservation et chaque ressource via `reservationSnapshotAllowed`; les documents par société, projet, devis et site via `quoteAllowed`.
- Le stress scopé Paris ne restitue que les 125 ressources autorisées; les compteurs sont recalculés après scopes (`3 000` réservations, `590` documents dans le dataset synthétique), pas filtrés après agrégation.
- La route demeure en lecture authentifiée. Elle n'ajoute ni mutation, ni audit, ni SSE, ni données persistées, secret ou fichier statique.
- Le correctif UI transforme seulement un delta absent en texte constant « Non disponible ». Les libellés/mois passent toujours par les générateurs internes et `esc()`; aucun sink XSS ou donnée financière masquée conservée dans le DOM n'est ajouté.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| candidat applicatif | `db23552b898bc7fc8c75bdae11b1916daba4df0a` |
| `node --test tests/sprint8-dashboards.test.js tests/quotes.test.js tests/foundations.test.js` | **PASS, 87/87**, durée `3 556,73 ms` |
| `npm test` | **PASS, 355/355**, 0 échec/skip/todo, durée `8 382,89 ms` |
| `npm run lint` / `npm run build` | **PASS** ; 5 actifs runtime vérifiés |
| `git diff db23552^ db23552 --check` | **PASS** |
| historique synthétique | **PASS**, 167 acceptés attendus/observés, dont 56 remplacés |
| permissions | `dashboard.read` absent → `403`; `quote.read` absent → trois blocs indisponibles, aucun montant |

Hashes SHA-256 : `server.js` `f8fb1691fb1cd2fc172c8c8531d9682f2ffa53eaa1489c80993a517c88d5b78e`; `app.js` `bd08f1fd8f5711a1245c3084f0fad0f11f036962039b99690c84df74762da3e7`; OpenAPI `056bddd0703ac81a720b8d30905449a77d1e420a5604e8e1ffaf60e5ade8b116`; spécification `7f74a1078e929ca0bcb23990b5660ca8e352f4789735dff01f438eb34f24bb90`; test dashboard `0a3708a19cc4ee1f30d34108cabe83a69e6b3748ea774704e4513df0f48a0cd1`.

## Limites et handoff

La vérification XSS/DOM est statique et automatisée; aucun navigateur pilotable n'a été utilisé. Le dataset synthétique vérifie les scopes Site/Projet/Devis/Ressource et les compteurs, sans constituer un test exhaustif de toutes les combinaisons RBAC héritées. Les risques non bloquants historiques consignés dans les sections antérieures ne sont pas déclarés fermés par ce re-gate d'impact.

Gate SECURITY post-RC6 : **APPROVED**. Fichier modifié : `docs/security-review.md` uniquement ; mise à jour de `docs/project-status.md` laissée à l'intégrateur conformément à l'ownership imposé.

---

# Gate SECURITY indépendant — comparaison mensuelle Vue d'ensemble

Date : 2026-08-26

Candidat applicatif exact : `7b723b3ce6c43c9fb5ccc0ab9f016c2430429629`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 0 P2, 0 P3 sur le périmètre comparatif.**

La validation de `comparisonMonth`, le RBAC `quote.read`, les scopes société/site/projet/devis/ressource et les sorties DOM sont fermés. En revanche, le calcul historique du CA signé dépend encore du **statut courant** du devis. Un devis accepté puis remplacé conserve sa date d'acceptation, mais disparaît rétroactivement du mois où il avait été accepté. Cette altération de l'historique financier bloque le gate.

## P1 ouvert

### SEC-RC6-COMP-01 — CA signé historique réécrit par un statut ultérieur

`dashboardOverviewCommercial()` retient un devis signé seulement lorsque `value.status === 'accepted'`, puis applique la période à `acceptedAt`. Le workflow normal de version/successeur peut ensuite passer ce devis à `replaced` sans effacer `acceptedAt`. La comparaison d'un mois passé retourne alors `0` au lieu du montant réellement accepté ce mois-là.

Reproducteur frais sur le read-model : un devis `netHt=800000`, `acceptedAt=2026-07-18T10:00:00.000Z`, désormais `status=replaced`, comparé depuis août 2026 donne :

```json
{"acceptedAt":"2026-07-18T10:00:00.000Z","currentStatus":"replaced","selectedSignedRevenueMinor":"0","selectedSignedQuoteCount":0}
```

Attendu : `selectedSignedRevenueMinor="800000"` et `selectedSignedQuoteCount=1`, conformément à la règle « CA signé suit la date d'acceptation ». La correction doit reconstruire l'acceptation à partir d'un événement/version immuable ou, au minimum, de `acceptedAt` avec une règle de supersession explicite, puis couvrir le cas accepté → remplacé par un test de non-régression.

## Contrôles de sécurité satisfaisants

- `comparisonMonth` n'accepte que `YYYY-MM`, vérifie un vrai mois civil et refuse mois courant/futur ; `2026-7` et `2026-07<script>` échouent en `422 DASHBOARD_COMPARISON_MONTH_INVALID`. Le contrat OpenAPI reprend la forme stricte.
- Sans `quote.read`, `commercial`, `comparison.current.commercial` et `comparison.selected.commercial` restent `status:"unavailable"`; aucun montant ni compteur n'est calculé ou divulgué.
- Les ressources passent par `resourceAllowed`; les réservations par `reservationSnapshotAllowed`; les documents par société de session, `quoteAllowed`, scopes projet/devis et site. Le client ne fournit aucune autorité `companyId`.
- La reconstruction des budgets convertis est temporelle : un devis source créé après la fin du mois ne convertit pas rétroactivement le budget du mois comparé. Le défaut P1 concerne spécifiquement l'acceptation ensuite remplacée.
- Les mois proposés par l'interface sont générés localement. Mois, libellés et valeurs rendus sont soit des constantes, soit normalisés en nombres/`Intl`, soit échappés par `esc()`; aucun nouveau sink HTML/CSS exécutable n'a été identifié.
- Cette lecture n'ajoute ni mutation, ni audit, ni SSE, ni fichier statique. Auth/session/CSRF et exposition statique sont inchangés.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `7b723b3ce6c43c9fb5ccc0ab9f016c2430429629` |
| `node --test tests/sprint8-dashboards.test.js tests/quotes.test.js tests/foundations.test.js` | **PASS, 86/86**, durée `3 618,10 ms` |
| `npm test` | **PASS, 354/354**, 0 échec/skip/todo, durée `8 598,51 ms` |
| `npm run lint` / `npm run build` | **PASS** ; 5 actifs runtime vérifiés |
| `git diff HEAD^ HEAD --check` | **PASS** |
| reproducteur accepté → remplacé | **FAIL fonctionnel confirmé** : signé `0/0` au lieu de `800000/1` |

Hashes SHA-256 : `server.js` `3f54a4e4b5e18601d10f5b5f6eb9492cf69edaabbf1a8b4b96f454e50635d0bb`; `app.js` `be0c9ff5c1e772b2e2f33ad6c7f800aa202c935ac6b9b8713a05f9ad085550f0`; OpenAPI `886adacddb00a96affbde2a9ac145d4941e73801657aa6ef60f484d4a6647518`; test dashboard `0887e296605bb2a3d31b4ba34321b00a826a423970ff4003e22510a7829b69a5`.

## Limites et handoff

La revue DOM/XSS est statique et couverte par les tests structurels ; aucun navigateur pilotable n'a été utilisé. Le décompte ci-dessus porte sur le périmètre de comparaison mensuelle ; les risques non bloquants historiques déjà consignés plus bas ne sont ni déclarés fermés ni réévalués par ce lot. Gate SECURITY : **REJECTED** jusqu'à fermeture de `SEC-RC6-COMP-01`. Fichier modifié : `docs/security-review.md` uniquement ; `docs/project-status.md` reste à consolider par l'intégrateur.

---

# Revalidation SECURITY d'impact — validation couleur et ResizeObserver

Date : 2026-08-24

Candidat applicatif exact : `e39b9b0e2eecf7a0c9abeb0f20ec27650778b09f`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts, 1 P3.**

`SEC-POST-RC5-01` est fermé : la chaîne complète, seulement trimée et normalisée en majuscules, est contrôlée par `^#[0-9A-F]{6}$`; aucune troncature ne précède plus la regex. Les charges `red; background:url(x)` et `#123456;background:red` reçoivent toutes deux `422`, n'altèrent pas la couleur persistée et ne déclenchent ni audit ni SSE. Le contrat OpenAPI documente désormais la création, la lecture et la modification du Client, avec le même motif hexadécimal pour création et patch.

## Validation, autorité et contrat

- Un type non chaîne devient `''` et est refusé. Les espaces extérieurs sont retirés, les minuscules deviennent majuscules, puis seule une valeur de sept caractères `#RRGGBB` est persistée. Le frontend conserve sa liste blanche et son fallback ; aucun séparateur CSS, URL ou balise ne peut atteindre `--client-color`.
- La modification reste sous `client.manage`, société de session, scope d'entité, contrôle de version et idempotence. L'échec `422` survient dans `mutate()` avant écriture atomique ; les tests confirment la couleur précédente inchangée.
- `ClientUpdateCommand` est fermé par `additionalProperties:false`, exige `version`, borne les champs et reprend le motif couleur. Les réponses `403/404/409/422` du patch concordent avec la route. Le GET documenté renvoie bien le Client scopé, ses contacts actifs et ses grilles actives.
- Persistance, audit `client.updated`, SSE `client.updated.v1`, CSRF, sessions et fichiers statiques sont inchangés par ce correctif.

## ResizeObserver — cycle, abus et données

- Une seule instance globale existe. Chaque passage par `bind()` commence par `disconnect()` puis met la référence à `null`; les re-rendus Planning ne cumulent donc ni observers ni callbacks.
- Le callback lit deux dimensions du même `timeline` et écrit une valeur numérique non négative dans une propriété CSS. Le shell possède une hauteur explicite et la propriété ne modifie que la hauteur du sibling fixe : elle ne redimensionne pas la boîte observée. Les deux cibles sont livrées dans un même lot ResizeObserver ; aucun appel réseau, mutation métier, audit, SSE ou allocation croissante n'est effectué.
- Le callback ne reçoit aucune entrée utilisateur et ne rend aucun contenu. Une rafale de redimensionnements reste coalescée par le navigateur et chaque exécution est O(1); elle ne constitue pas un vecteur de DoS applicatif autonome.

## P2/P3 ouverts

1. **SEC-POST-RC5-02 — rémanence du Planning après logout.** Le logout passe par le retour anticipé de `render()` avant `bind()`. L'observer global n'est donc pas explicitement déconnecté lorsque `app.replaceChildren()` détache la grille. Son callback ferme sur `timeline` et `matrixShell`, susceptibles de retenir en mémoire le sous-arbre contenant noms de Clients/Projets/réservations jusqu'au prochain rendu authentifié. Les nœuds ne restent pas dans le document et aucune fuite inter-tenant/API n'est démontrée : P2 défense en profondeur, non P1.
2. **SEC-G8-05 résiduel :** des valeurs de certains overlays statiques masqués/inertes restent également conservées après fin de session. Le nouvel observer n'ouvre pas ces overlays mais élargit le thème de rémanence locale.
3. **P3 contrat :** le runtime accepte une couleur entourée d'espaces après `trim()`, tandis que le motif OpenAPI ancré décrit la forme canonique sans espaces. La sortie persistée est conforme et sûre ; documenter explicitement la normalisation éviterait cette légère ambiguïté client.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `e39b9b0e2eecf7a0c9abeb0f20ec27650778b09f` |
| Clients + Planning post-production | **PASS, 57/57**, 0 échec/skip/todo, durée `554,06 ms` |
| `npm test` | **PASS, 345/345**, 0 échec/skip/todo, durée `8 377,75 ms` |
| `npm run lint` / `npm run build` | **PASS** |
| `git diff --check HEAD^ HEAD` | **PASS** |
| couleurs malformées | deux réponses `422`; couleur persistée `#2A7F62` inchangée |

Les tests ResizeObserver sont structurels ; aucun navigateur contrôlable n'était disponible pour provoquer une boucle native, inspecter le heap après logout ou profiler les callbacks réels. Hashes : `app.js` `335de7ef6c0d039a8d692206b0d9e8f8c60e53681d9e529385ca90b8a91a72a3`; `server.js` `5961d3d6cd53f382b7977d284c6523d146134b7cc47bbf117031fe6f5ee1f367`; OpenAPI `1f51be70a4411c88d5b8bb61fb3f903e8189f20de0cf5812b823e43f6b2428f4`.

## Handoff

- Gate SECURITY d'impact : **APPROVED** sur `e39b9b0`, 0 P0/0 P1/2 P2/1 P3.
- `SEC-POST-RC5-01` fermé ; `SEC-POST-RC5-02` transmis au DEV sans blocage release SECURITY.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Gate SECURITY indépendant post-RC5 — couleur Client et alignement du scroll Planning

Date : 2026-08-24

Candidat applicatif exact : `ea7863c20b5f148ddbd63f13afcdf211b0f008b1`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts, 0 P3.**

Le lot ajoute une couleur de repérage au compte Client et l'utilise comme liseré des réservations, puis synchronise la hauteur utile de la colonne Ressources avec la barre horizontale native. La couleur effectivement persistée et rendue reste un hexadécimal `#RRGGBB`; les mutations Client conservent RBAC, scopes société/entité, version, écriture atomique, audit et invalidation SSE après succès. Aucun secret, endpoint, droit ou accès statique n'est ajouté.

## Threat-check couleur, DOM et accessibilité

- **Validation et sink CSS :** le serveur normalise en majuscules et n'enregistre qu'une valeur conforme à `^#[0-9A-F]{6}$`. Le frontend répète une liste blanche stricte `^#[0-9A-Fa-f]{6}$`, sinon utilise `#6C5CE7`, puis échappe la valeur avant l'attribut `style="--client-color:…"`. La charge testée `red; background:url(x)` reçoit `422`; elle ne peut atteindre ni CSS, ni URL, ni HTML.
- **Nom du Client :** le nom ajouté à `aria-label` passe par `esc()`. Les cartes continuent d'échapper titres, projets, ressources et statuts ; aucun `innerHTML` nouveau ne reçoit de texte libre non échappé.
- **Signal non exclusivement coloré :** le liseré ne remplace ni le titre, ni le nom du Client dans le libellé accessible, ni le statut textuel. L'input natif `type=color` est libellé dans le drawer Client.
- **Scroll :** `offsetHeight - clientHeight` fournit uniquement une mesure de géométrie DOM, bornée par `Math.max(0, …)`, puis sérialisée comme pixels. Aucune donnée utilisateur n'alimente cette propriété CSS.

## RBAC, scopes, persistance, audit et SSE

- `POST /api/v1/clients` et `PATCH /api/v1/clients/:id` exigent toujours `client.manage`. La création injecte `companyId` depuis la session active ; la modification retrouve uniquement un Client de la société et du scope d'entité autorisés. Le lecteur est refusé `403` et un identifiant étranger reste indistinguable (`404`) dans les tests frais.
- La modification passe par `mutate()`, `requireVersion()` et le marqueur idempotent. La couleur figure dans l'état persistant et, lors d'un patch réussi, dans les instantanés `before`/`after` de l'audit `client.updated`; une validation `422` intervient avant tout commit.
- `client.updated.v1` n'est émis qu'après succès et jamais lors d'un replay. Le flux SSE demeure authentifié, limité à une connexion par session, scopé par société lors de l'émission et révalidé périodiquement. La couleur n'élargit pas le DTO à une nouvelle famille de données sensible.
- Le formulaire Client ne constitue pas une autorité : l'API reste fail-closed si un appel est forgé. CSRF, contrôle d'origine, cookie de session et règles de fichiers statiques sont inchangés.

## P2 ouverts

1. **SEC-POST-RC5-01 — validation syntaxique tronquée avant contrôle.** `cleanString(requestedColor, 7)` précède la regex. Ainsi `#123456;background:red` devient `#123456` puis est accepté, contrairement au contrat OpenAPI et à la mention « validation stricte ». Le résultat stocké/rendu reste sûr et ne permet aucune injection, donc ce constat ne bloque pas SECURITY ; la correction recommandée est de valider la chaîne trimée complète avant toute normalisation.
2. **SEC-G8-05 résiduel hors impact :** certaines valeurs internes d'overlays statiques masqués/inertes ne sont pas intégralement purgées après fin de session. Ce lot n'ajoute aucun overlay et n'aggrave pas le point.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `ea7863c20b5f148ddbd63f13afcdf211b0f008b1` |
| Clients + Planning post-production | **PASS, 57/57**, 0 échec/skip/todo, durée `538,11 ms` |
| `npm test` | **PASS, 345/345**, 0 échec/skip/todo, durée `8 452,48 ms` |
| `npm run lint` | **PASS** |
| `node --check server.js` / `node --check app.js` | **PASS** |
| `git diff --check HEAD^ HEAD` | **PASS** |
| reproducer de troncature | entrée `#123456;background:red` → `#123456`, regex acceptée |

Le contrôle visuel navigateur n'a pas été rejoué par ce gate ; aucune affirmation de contraste perceptuel ou de focus réel n'est faite. Hashes : `app.js` `1beae9dda81bab93b6079112727da792cbe6d39cffe580444309f8fb7ec71de8`; `server.js` `71be96cacba53ac5eff416fb5156ce166cacd28d1454faa561fb7197d2fbea60`; `planning.css` `b9cd0dda4f2b75b815b502aa5d07b6eb4cf73c331123a204d7daf8bd2b8de284`.

## Handoff

- Gate SECURITY post-RC5 : **APPROVED** sur `ea7863c`, 0 P0/0 P1/2 P2/0 P3.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation finale SECURITY RC5 — moyenne directe occupancyGap

Date : 2026-08-24

Candidat exact : `4e094d589ae215f31152110d30f1163929ca1338`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 résiduel, 0 P3.**

Le changement remplace la différence de deux moyennes arrondies par l'arrondi unique de la moyenne des écarts, afin d'être mathématiquement identique au drill-down. Il réutilise strictement le même tableau `actualItems`, déjà construit après `financeOccupancy()` et ses scopes. Aucune autorité, donnée, route, sortie, mutation ou taille de réponse ne change.

## Contrôle différentiel

- **Scopes inchangés :** société, site, Projet, client, ressource/catégorie et snapshots sont toujours filtrés dans `financeOccupancy()` avant `actualItems`. La nouvelle expression ne lit que `actualOccupancyBps` et `plannedOccupancyBps` des mêmes lignes autorisées.
- **Réconciliation sans fuite :** la carte expose `round(sum(actual − planned) / actualItems.length)`, exactement comme la moyenne des valeurs du détail. Les périodes sans réalisé restent exclues ; `sourceCount` demeure `actualItems.length`.
- **Sorties sûres :** résultat numérique en points de base ou `null` si aucune période réelle. Aucun texte libre, identifiant, détail supplémentaire ou signal d'existence hors scope n'est ajouté.
- **RBAC/mutations :** `actual.read` reste requis pour le KPI réel, la matrice Exploitation et le drill-down sont inchangés. Le calcul est pur ; persistance, audit, SSE, CSRF et exports ne sont pas touchés.

## P2 résiduel

**SEC-G8-05 reste ouvert hors impact :** purge incomplète de certaines valeurs internes d'overlays statiques après fin de session. Ce diff serveur arithmétique n'interagit pas avec le DOM.

## Preuves fraîches et réutilisation différentielle

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `4e094d589ae215f31152110d30f1163929ca1338` |
| `node --test tests/sprint8-dashboards.test.js` | **PASS, 14/14**, durée `1 718,16 ms` |
| cas d'arrondi différentiel | détail `[0, -833]`, carte et moyenne détail `-416` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

La suite complète `345/345` du parent immédiat `ace4048` est réutilisée uniquement comme non-régression différentielle ; elle n'est pas présentée comme une exécution fraîche de `4e094d5`. Le test exact couvre les scopes, RBAC, erreurs, exports et le nouveau cas d'arrondi. Hashes : `server.js` `2f850f7f2e797b3228524b9e94d0566004e951f28126d9141b51cc0e6918aa20`; test dashboards `22fce8f6b77ea70572c9fd6bef0d87e4fce552f07d97c712761e6861a4cbc6ab`.

## Handoff

- Gate SECURITY final RC5 : **APPROVED** sur `4e094d5`, 0 P0/0 P1/1 P2 résiduel/0 P3.
- Fichier modifié : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation d'impact SECURITY RC5 — réconciliation occupancyGap

Date : 2026-08-24

Candidat exact : `ace4048f20e3524b003c49df0f1ee42d01551ee8`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 résiduel, 0 P3.**

Le correctif recalcule l'écart planifié/réalisé sur le même sous-ensemble de périodes disposant d'une occupation réelle. Il intervient après `financeOccupancy()` et ses contrôles d'autorité, ne crée aucune entrée, route, mutation ou sortie supplémentaire, et réconcilie la carte `occupancyGap` avec son drill-down sans exposer les périodes sans réalisé.

## Threat-check ciblé

- **Scopes avant agrégation :** `occupancy` est produit par `financeOccupancy(db, auth, input)` avec les filtres société, site, Projet, client, ressource/catégorie et les helpers d'autorité existants. `actualItems` est dérivé ensuite par `filter(actualOccupancyBps !== null)` ; `plannedActualBps` ne peut donc agréger aucune ligne hors scope.
- **Absence de canal latéral :** le nombre de sources reste `actualItems.length`, identique à `actualOccupancy` et au drill-down filtré. Les périodes planifiées sans réalisé ne contribuent plus implicitement au dénominateur et ne sont ni comptées ni matérialisées.
- **Entrées/sorties bornées :** les deux valeurs agrégées sont numériques et issues du read-model interne. La réponse conserve le contrat `bps`; aucune donnée libre, identifiant, HTML, journal ou message d'erreur nouveau n'est produit.
- **RBAC et matrice :** le dashboard Exploitation exige toujours `planning.read`, `resource.read` et `maintenance.read`; les KPI réels restent indisponibles sans `actual.read`. Le drill-down reconstruit les mêmes scopes et exige un KPI explicite.
- **Aucune mutation :** `filter()` et `reduce()` opèrent sur de nouveaux agrégats en mémoire. Persistance, audit, SSE, CSRF, exports et données sources sont inchangés.

## P2 résiduel

**SEC-G8-05 reste ouvert hors impact :** certaines valeurs de quelques overlays statiques masqués/inertes ne sont pas entièrement purgées après fin de session. Le correctif serveur `occupancyGap` ne touche aucun overlay ou DOM.

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

- Gate SECURITY d'impact RC5 : **APPROVED** sur `ace4048`, 0 P0/0 P1/1 P2 résiduel/0 P3.
- Fichier modifié : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Gate SECURITY indépendant RC5 — Planning long, Pilotage et Forecast métier

Date : 2026-08-24

Candidat exact : `b715f4ba1453ed9a73db3fd2f32e996957a700d2`

Code Forecast inclus : `d96281e0caf86777cdc21eba3ece9ab516420ddf`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 résiduel, 0 P3.**

Le périmètre cumulé post-RC4 ne crée aucune nouvelle autorité. Les quatre vues Planning restent alimentées par les réservations déjà filtrées ; le détail Pilotage est demandé exclusivement via le drill-down autorisé du KPI courant ; les occupations réelles sans réalisé sont supprimées après calcul scopé ; le Forecast présenté est la section serveur déjà filtrée par société, site, Projet, client et droits Finance. Aucun nouveau endpoint, secret, sink HTML non échappé ou mutation n'est introduit.

## Threat-check frontend

- **Planning long :** les largeurs et le nombre de colonnes proviennent de constantes internes (`38`, `52`, `76`, `92`) et de `data-total-columns` / `data-column-width` produits par le rendu. La conversion `Number()` ne transforme aucune donnée métier en HTML. Les cellules restent construites depuis `state.bookings.filter(matches)`, `visibleRooms` et les 92 dates bornées.
- **Permissions visibles :** `pilotageKinds()` masque les tableaux non permis, mais le serveur reste l'autorité via `DASHBOARD_PERMISSIONS`. Direction exige Finance, Devis, Planning, Ressources et Réalisés ; Exploitation exige notamment `maintenance.read`. Les tests négatifs confirment le même refus 403 sur dashboard, drill-down et export.
- **Drill-down modal :** le client n'accepte que le KPI présent dans `pilotageModule.data.kpis` et doté d'un lien serveur. `new URL()` est réduit à `target.pathname` et `target.searchParams`, empêchant une navigation externe. Pagination publique bornée à 500 et export à 10 000 ; les tokens de requête empêchent une réponse tardive de remplacer le détail courant.
- **XSS/sorties :** libellés, statuts, IDs, sections génériques, titres et cellules du détail passent par `esc()`. Le Forecast convertit les montants par `BigInt`/`Intl.NumberFormat`, les jours par `Number` et échappe version/date ; aucune valeur libre n'est injectée comme markup. `CSS.escape()` borne la restauration de focus au bouton du KPI fermé.
- **Accessibilité/focus :** `<dialog>.showModal()` fournit l'inertage modal natif ; fermeture explicite, touche Échap, clic backdrop et restauration du focus sont câblés. La table est une région nommée et focalisable. La preuve clavier réelle reste limitée par l'absence de navigateur connecté.

## Threat-check API et données

- `dashboardReadModel()` applique d'abord société, sites, projets, clients, documents, ressources et snapshots autorisés ; `dashboardDrilldownReadModel()` reconstruit les mêmes scopes avant toute ligne.
- La section Forecast vient de `financeForecast(dashboardDb, auth, input)` : `dashboardDb` ne contient que les Devis/Budgets déjà visibles. Les fenêtres 30/60/90 ne réintroduisent aucun identifiant hors scope.
- Le correctif Occupation filtre uniquement les lignes `actualOccupancyBps === null` pour `actualOccupancy` et `occupancyGap`, après `financeOccupancy()` scopé. Il réduit la sortie et réconcilie `sourceCount`; il ne transforme pas une absence en valeur ni ne révèle un compteur global.
- Périodes, filtres, pagination, KPI explicite, export et tailles restent validés côté serveur. Aucune mutation, CSRF, audit, SSE ou persistance n'est touchée.

## P2 résiduel

**SEC-G8-05 reste ouvert hors impact RC5 :** des valeurs internes de certains overlays statiques masqués/inertes ne sont pas toutes purgées après fin de session. La modale Pilotage vit dans `#app`, qui est purgé à la déconnexion, et n'aggrave pas ce point.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `b715f4ba1453ed9a73db3fd2f32e996957a700d2` |
| Planning + dashboards + sécurité G8 ciblés | **PASS, 63/63**, durée `1 986,44 ms` |
| `npm test` | **PASS, 344/344**, durée `8 387,39 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Le navigateur intégré ne disposait d'aucune instance connectée ; aucun parcours clavier/lecteur d'écran réel n'est revendiqué. Hashes : `app.js` `0fc0dad429e78aa6aea63884f6d903939189e2793b6505b3d363d7e49cbc36cd`; `server.js` `504ae0263fbe8674f1ab26f23863e7ebe206ef854ccb1b698e0b7bc9ff07ee13`; test dashboards `d9a0b681dcc21b53807c4559301bd9a676227814161717691d22a6e91b98af02`.

## Handoff

- Gate SECURITY RC5 : **APPROVED** sur `b715f4b`, 0 P0/0 P1/1 P2 résiduel/0 P3.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation d'impact SECURITY indépendante — chevauchement demi-journée Planning RC3

Date : 2026-08-24

Candidat applicatif exact : `2fd37e212d19ecc507cfe12f077474f716ec0edd`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 ouvert, 0 P3.**

Le seul changement applicatif ajoute un appel à `planningSlotContainsBooking()` avant d'insérer une cellule dans l'index demi-journée. Il exclut les réservations entièrement hors des fenêtres 09:00–13:00 et 13:00–18:00, sans nouvelle entrée, mutation, autorité, persistance ou sortie HTML. Les bornes de hauteur, d'index et de rendu restent inchangées.

## Threat-check ciblé

- **Autorité et scopes :** l'index reçoit toujours uniquement `state.bookings.filter(matches)`, `visibleRooms` et `visibleSlots`. Le contrôle opère après l'exclusion des salles hors fenêtre et avant l'insertion dans la `Map`; il ne peut pas réintroduire une réservation filtrée.
- **Entrées et bornes :** `start` et `end` étaient déjà lus par `mins()` pour choisir le candidat AM/PM. Le nouvel appel ajoute seulement des comparaisons numériques constantes avec les bornes internes du slot. Les validations API restent inchangées.
- **Map, clés et données :** la clé locale `resourceId|slot.key` reste non interprétée comme propriété d'objet, non rendue et non journalisée. Une cellule hors horaires est désormais absente du DOM au lieu d'être associée à tort à AM ou PM.
- **XSS et accessibilité :** aucun sink HTML, attribut ARIA, focus, drag, résumé ou wrapper n'est modifié. Les cartes conservées passent toujours par `esc()`; les cartes exclues ne produisent aucun nœud.
- **Backend inchangé :** `server.js`, auth, RBAC, isolation société/site, CSRF, audit, SSE, exports et persistance sont byte-identiques au candidat précédent.

## P2 résiduel

**SEC-G8-05 demeure seul ouvert :** certaines valeurs internes d'overlays masqués/inertes ne sont pas intégralement purgées après fin de session. Ce correctif Planning n'affecte pas ce durcissement local.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `2fd37e212d19ecc507cfe12f077474f716ec0edd` |
| Foundations + Planning post-production | **PASS, 61/61**, durée `320,47 ms` |
| `npm test` | **PASS, 341/341**, durée `8 514,32 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |
| index demi-journée 10 000 distribué / concentré / long | p95 `40,63 / 41,19 / 1 064,73 ms` |

Le navigateur intégré est indisponible ; aucun comportement de focus réel n'est revendiqué. Hashes : `app.js` `d38593864538040fa829aa3ee24fd649199cb3f2b1ba5a81c683c12dd741c1f5`; test Planning `4cc26cb0461e93fba23ce88b62fb527403bf7220455d44a1c33e7c712dd4a3cf`; `server.js` `b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d`.

## Handoff

- Gate SECURITY d'impact Planning RC3 : **APPROVED** sur `2fd37e2`, 0 P0/0 P1/1 P2/0 P3.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation terminale SECURITY indépendante — borne de pile Planning RC3

Date : 2026-08-24

Candidat applicatif exact : `75a85cfdb3236ee1dcc63652d8a73fa578693ea5`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 ouvert, 0 P3.**

Le correctif ferme l'amplification de hauteur, de DOM et de rescans : hors filtre Projet, aucun calcul de pile n'est effectué (`stackDepth=1`) ; dans une vue Projet, la ligne est bornée à **194 px** ; chaque cellule rend au plus **50** cartes et un résumé ; `planningCellEntriesBySlot()` indexe une seule fois les cellules visibles. Aucun nouvel input, endpoint, droit, secret, sink HTML non échappé ou chemin de persistance n'est introduit.

## Threat-check ciblé

- **Scopes et autorité :** l'index reçoit `state.bookings.filter(matches)` ainsi que `visibleRooms` / `visibleSlots` ; le calcul de profondeur n'est activé que lorsque `filters.project` est défini. Le changement est strictement client ; `server.js`, auth, RBAC, scopes société/site, CSRF, audit, SSE et exports restent byte-identiques.
- **Injection :** le plafond `3`, la hauteur `194` et les dimensions `data-row-height` / `data-column-width` proviennent uniquement de calculs numériques. Les titres, projets, statuts et identifiants continuent de passer par `esc()` dans le HTML et les attributs/labels.
- **Accessibilité des cartes compactes :** chaque réservation reste un `article` avec son `aria-label` complet, ses règles de focus/drag et ses poignées de redimensionnement. Les deux wrappers tardifs propagent `compact`; la version visuelle conserve au moins le libellé présence/décision/statut. Le débordement vertical est contenu dans les cellules non horaires et horaires avec `overscroll-behavior:contain`.
- **Confinement horaire :** une cellule horaire empilée passe à `overflow-x:hidden; overflow-y:auto` et contraint chaque wrapper à la largeur du créneau. Le sélecteur exige `.is-stacked`; un événement isolé conserve donc son `--planning-event-span`. Il s'agit de constantes CSS, sans donnée utilisateur ni effet sur le focus ou l'autorité.
- **Résumé et sorties :** `hiddenCellCount` provient uniquement de deux longueurs de tableaux et reste numérique. Il alimente un texte statique et l'`aria-label` de la cellule ; aucune donnée cachée (titre, client, projet ou identifiant) n'est recopiée. Les 50 cartes visibles conservent leur échappement, leurs labels complets et leurs contrôles. Le résumé `role="status"` annonce le volume sans exposer le contenu masqué.
- **Index Map et clés :** l'index reçoit uniquement `state.bookings.filter(matches)`, les `visibleRooms` et `visibleSlots`; aucune réservation hors scope ne peut y entrer. Les clés `resourceId|slot.key` servent seulement à une `Map` locale et ne sont ni rendues ni journalisées. Les IDs de ressource sont générés côté serveur et les clés de slots sont construites localement à partir de dates/instants validés ; aucune interprétation de propriété d'objet ou prototype n'est possible avec `Map`.
- **Virtualisation :** le handler relit `matrix.dataset.rowHeight` et `matrix.dataset.columnWidth`, ce qui évite une fenêtre calculée avec une hauteur obsolète. L'étendue verticale maximale de 250 lignes est désormais `48 500 px`, au lieu de 155 millions de pixels dans le défaut précédent.

## Fermeture de SEC-G8-06 et P2 résiduel

**SEC-G8-06 est fermé au volume contractuel.** L'index distribué 20 salles × 18 jours / 10 000 réservations termine à `32,43 ms` p95 contre `11 298,67 ms` avant correction ; le cas concentré termine à `35,32 ms`, et 10 000 périodes de 92 jours à `821,29 ms`. Hauteur globale, DOM local et collecte restent sous leurs bornes opérationnelles sans charge serveur.

**SEC-G8-05 demeure seul ouvert :** certaines valeurs internes d'overlays masqués/inertes ne sont pas intégralement purgées après fin de session. Ce correctif Planning n'affecte pas ce durcissement local.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `75a85cfdb3236ee1dcc63652d8a73fa578693ea5` |
| Foundations + Planning post-production | **PASS, 61/61**, 0 échec/skip/todo, durée `317,95 ms` |
| `npm test` | **PASS, 341/341**, 0 échec/skip/todo, durée `8 239,78 ms` hors sandbox |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |
| index 10 000 distribué / concentré / long | p95 `32,43 / 35,32 / 821,29 ms` |

Le navigateur intégré est resté indisponible ; aucune preuve de focus/scroll réelle n'est revendiquée. Les propriétés de sécurité et la limite locale sont établies par inspection du chemin de rendu et mesures déterministes.

```text
app.js                               98f9740d54dbc2c460c77cc40958f27663c220f8df5043a445f5ea313a23f3df
planning.css                         c7904c3cfab77078997ba5efb7c9c34e24d17db2fc2abb8773351985881bfdb1
server.js                            b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
index.html                           419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
tests/planning-postproduction.test.js 6e7e9197bf8f26ff6a38f614a4ae6dd80e34e543551e4642ba700ff78654fd66
tests/foundations.test.js            81af03baa607a81fc66e210c3cda032f240b7e37abbe47c08606a3816db96abf
```

## Handoff

- Gate SECURITY Planning RC3 : **APPROVED** sur `75a85cf`, 0 P0/0 P1/1 P2/0 P3.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

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

# Revalidation SECURITY indépendante — S7-D

Date : 2026-08-24

Candidat exact : `57014500241b512eda1c202475f6793a9be213eb`

Reviewer : agent indépendant `g7d_security_performance`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 2 P2 ouverts.**

Le P1 `SEC-S7D-01` est fermé : une commande de seuil global sans `siteId` exige maintenant `organizationScope` avant la recherche d'un marqueur idempotent. La création, la mise à jour et le rejeu global sont donc refusés après réduction au scope Site, avant seuil, marqueur, audit et SSE. Le test HTTP confirme `403 ORGANIZATION_SCOPE_REQUIRED` et l'absence de modification des seuils, marqueurs et audits.

Un nouveau P1 d'isolation demeure dans l'agrégat d'occupation : la sélection canonique des doubles options est calculée sur toutes les Réservations de la Société avant le filtrage des scopes.

## P1 bloquant

### SEC-S7D-03 — une option hors scope modifie silencieusement le total d'occupation du Site autorisé

`financeOccupancy()` construit `optionByGroup` avec la seule condition `companyId + status=option + optionGroupId`. `reservationSnapshotAllowed()` n'est appliqué qu'ensuite, lors de l'agrégation. Une option prioritaire d'un autre Site peut donc devenir canonique et faire exclure l'option visible appartenant au Site autorisé.

Reproduction indépendante directe : acteur borné à `site s1`, option visible priorité 2 sur `s1`, option cachée priorité 1 sur `s2`, même groupe. Le total planifié de `s1` vaut `0` avec la source cachée, puis `28 800 000 ms-capacité` après retrait de cette seule source. L'utilisateur peut donc observer l'existence/priorité d'une donnée hors périmètre et reçoit un indicateur erroné. Cela contredit la règle S7 « scopes avant agrégation ».

Correction requise : construire la canonicalisation uniquement depuis les Réservations qui passent d'abord `reservationSnapshotAllowed()` et les filtres de la requête, ou définir un résolveur canonique qui restitue une alternative visible sans exposer les alternatives cachées. Ajouter un négatif inter-Site/inter-Projet/inter-Ressource.

## P2 importants

1. **Anti-tamper des marqueurs d'idempotence toujours partiel.** `sprint7OccupancyStateValid()` ne lie toujours pas formellement `scope`, Société, Site, acteur et `resultId`, et ne refuse pas les scopes dupliqués.
2. **Rejeu global après révocation non exercé en HTTP.** Le chemin est fail-closed par inspection car la garde `organizationScope` précède la recherche du marqueur, mais le test ajouté couvre une nouvelle clé refusée, pas la séquence création globale → révocation → rejeu ni l'absence d'invalidation SSE.

## Contrôles conformes

- Toutes les nouvelles routes analytiques exigent `finance.read` avant `readDb()` ; la mutation exige `finance.cost.manage`, Origin/CSRF et clé idempotente.
- Seuil global : garde Société avant marqueur/rejeu ; seuil Site : existence, Société et `siteAllowed()` ; version optimiste en mise à jour.
- Audit dans la transaction et SSE uniquement après commit ; l'interface recharge Finance sur `occupancyThreshold.updated.v1`.
- Rentabilité, non-facturé et remises filtrent Projet, Client, Devis, ligne, Ressource/Prestation et Réalisé avant total. L'exposition de `costTotalMinor` reste derrière `finance.read`.
- Le non-facturé reste explicitement hors CA signé/facturé et aucune lecture ne crée un Devis ou une Réservation.
- Migration/rollback, sauvegarde privée, digests et échappement DOM restent inchangés et conformes sur les chemins contrôlés.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `57014500241b512eda1c202475f6793a9be213eb` |
| ciblés S7 Actual/Finance/Forecast/Occupation/Migration | **PASS, 40/40** |
| `node --test tests/api.test.js` | **PASS, 42/42**, dont refus seuil global sans effet |
| `node --check server.js && node --check app.js` | **PASS** |
| reproduction inter-Site double option | `0` avec source cachée, `28 800 000` sans elle : P1 confirmé |
| `git diff --check` | **PASS** avant rapports |

Empreintes SHA-256 :

```text
server.js                           de8a479429e02a664ddcd24eaf06219c9c53cfb78e27fee8f4b84f433500da51
app.js                              bd6bfb8fdc7e468e09c37a2eef5fe92c82e4988355976ab35fddaaf29b8b5641
tests/sprint7-occupancy.test.js     4ad258132ac40e7d450a257882651341f9517515e7477be9cd4658a74c390c85
tests/api.test.js                   69ee260835eae2051ebd40e05162cb6a62e0979621749feae6bc9c39faf2886e
docs/api/openapi-v1.yaml            9d2410c871f59d7f77aca5b902f1bd77e911c5ad333aad340629e3987283f565
```

## Handoff

- `SEC-S7D-01` : **fermé**.
- Gate SECURITY S7-D : **REJECTED** sur `5701450` à cause de `SEC-S7D-03` ; retour DEV requis.
- Fichier modifié : `docs/security-review.md` uniquement ; statut projet à consolider par l'intégrateur.

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

---

# Gate SECURITY indépendant — S7-D Occupation & rentabilité

Date : 2026-08-23

Candidat applicatif exact : `5f61fd4`

HEAD documentaire au lancement : `5dcbd7aaa00957e9a8563f728c2de5e59ab3aede`

Reviewer : agent indépendant `g7d_security_performance`

## Verdict terminal

**REJECTED — 0 P0, 1 P1, 2 P2 ouverts.**

Les quatre read-models exigent `finance.read` avant chargement de la base et filtrent Société, Site, Projet, Client, Devis, Ressource, Prestation et Réalisé avant agrégation. Les mutations de seuil passent par session, Origin/CSRF, `finance.cost.manage`, validation, version, idempotence, audit atomique puis SSE après commit. Le gate reste cependant bloqué par une mutation de configuration globale accessible depuis un scope Site.

## P1 bloquant

### SEC-S7D-01 — un gestionnaire limité à un Site peut modifier le seuil global de la Société

`POST /api/v1/finance/occupancy-thresholds` accepte `siteId` absent et le normalise à `null`. La garde de scope n'est exécutée que lorsque `siteId` est renseigné ; aucune garde `organizationScope` ne protège donc le seuil global. Un rôle personnalisé possédant `finance.cost.manage`, mais limité à un Site, peut créer ou modifier le seuil commun à tous les Sites de la Société.

Le rejeu idempotent présente le même défaut : après réduction du scope de l'acteur, un ancien résultat global est encore restitué car la condition de rejeu autorise tout objet sans `siteId`. L'invalidation SSE globale est ensuite visible par tous les lecteurs Finance de la Société. Il s'agit d'une atteinte à l'intégrité inter-scope, pas d'un simple défaut d'interface.

Correction requise : exiger `organizationScope` pour toute commande globale, revalider ce scope au rejeu, et tester par HTTP la création, la mise à jour et le rejeu après révocation. Une commande Site doit continuer à exiger `siteAllowed()` et retourner `404` hors périmètre.

## P2 importants

1. **Validation anti-tamper incomplète des marqueurs d'idempotence.** `sprint7OccupancyStateValid()` vérifie seulement que `scope` est une chaîne, que `payloadDigest` ressemble à un SHA-256 et que `resultId` désigne un seuil existant. Il ne lie pas le scope à la Société, au Site et au résultat, et ne refuse pas les scopes dupliqués. Une falsification locale d'un marqueur peut donc échapper au contrôle d'intégrité et provoquer un rejet ou un rejeu incohérent.
2. **Matrice HTTP S7-D absente.** Les tests S7-D appellent directement les fonctions de calcul et recherchent les routes sous forme de chaînes. Ils ne prouvent pas les `401/403`, Origin/CSRF, l'idempotence conflictuelle, la version obsolète, l'absence d'audit/SSE sur refus ni la révocation dynamique des scopes pour ces cinq nouvelles routes.

## Contrôles conformes

- Les routes `/api/v1/analytics/*` nouvelles sont résolues par l'autorisation centrale `finance.read` avant `readDb()` et avant tout total.
- `financeOccupancy()` part uniquement des Ressources autorisées ; Réservations et Réalisés repassent par leurs résolveurs complets. Marges, non-facturé et remises réutilisent les filtres Projet/Client/Devis/ligne.
- Le non-facturé reste explicitement hors CA signé et hors revenu facturé ; aucune facture, réservation ou donnée commerciale n'est créée par une lecture.
- Les entrées de seuil sont bornées, les champs tenant sont refusés, la concurrence optimiste est exigée en mise à jour et l'audit précède l'émission SSE.
- Migration additive ordonnée, sauvegarde privée `0600`, marqueur signé, état courant/révisions digérés et rollback avec export obligatoire sont présents.
- Les rendus Finance passent les valeurs dynamiques par `esc()` ; aucune dépendance, ressource distante, télémétrie ou secret n'est ajouté.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `5dcbd7aaa00957e9a8563f728c2de5e59ab3aede` |
| `node --check server.js && node --check app.js` | **PASS** |
| `node --test tests/sprint7-occupancy.test.js tests/sprint7-finance.test.js tests/sprint7-actuals.test.js tests/sprint7-forecast.test.js tests/migration-sprint7.test.js` | **PASS, 37/37**, 0 échec/skip/todo, `669,45 ms` |
| Inspection auth/scopes/replay/audit/SSE/migration/rollback | agrégats filtrés ; mutation globale hors scope confirmée par le chemin de code |

Empreintes SHA-256 :

```text
server.js                           4ae25134dfff067b8e438204f168cf6faf04c84d06b44453f1be44199aa02d93
app.js                              bc53201ac1e56619ea9ea3212b0c488e54fd73e1255c34c1eed4d51d3100eaca
tests/sprint7-occupancy.test.js     8b5bfcc8387c25385a83c869621ddc2e4ea892b522a6686b8b1bce25b69669d0
scripts/benchmark-finance.js        89af6c12faa9127f56fc8ee1d413f025e5755e108aeb5136f3caa2c6824b3f9d
docs/api/openapi-v1.yaml            f677c159e2e412e966dd6eb421132f7a788ee08a36ef6053c69f15b1a32f413d
```

## Handoff

- Gate SECURITY S7-D : **REJECTED** sur le candidat `5f61fd4` ; retour DEV requis pour `SEC-S7D-01`.
- Fichier modifié par ce gate : `docs/security-review.md` uniquement.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

---

# Revalidation ultime SECURITY — S7-D

Date : 2026-08-24

Candidat exact : `7051fe4ff4849b1e9849e81b8266d73fa6c2fda6`

Reviewer : agent indépendant `g7d_security_performance`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts.**

`SEC-S7D-03` est fermé. `financeOccupancy()` produit d'abord `visibleReservations` avec Société et `reservationSnapshotAllowed()` complet, puis canonicalise uniquement les options de cette collection. Une option d'un Site, Projet ou périmètre Ressource non autorisé ne peut plus modifier le gagnant ni les totaux visibles. Le compteur de sources reprend la même collection filtrée.

Les options portant `optionDecision.state=lost` sont exclues avant la canonicalisation et avant l'occupation ; une Réservation confirmée gagnante reste comptée une fois. Les dépenses Projet conservent désormais leur `serviceOfferingId` dans le drill-down de marge et la dimension Prestation, après `projectCostAllowed()` et `offeringAllowed()`.

## Fermeture des P1

- **SEC-S7D-01 — seuil global hors scope : fermé.** `organizationScope` est exigé avant marqueur/rejeu ; Site, Société, version, idempotence, audit et SSE restent fail-closed.
- **SEC-S7D-03 — influence cachée des doubles options : fermé.** Le test inter-Site place une option cachée de priorité supérieure dans le même groupe ; le Site visible conserve `28 800 000 ms-capacité` et `reservationCount=1`.

## Contrôles conformes

- Permissions `finance.read`/`finance.cost.manage`, session, Origin/CSRF et Société de session restent imposés par le résolveur central.
- Tous les agrégats S7-D filtrent les sources autorisées avant total et pagination ; les dépenses liées à une Prestation repassent par le scope de cette Prestation.
- Une option perdue n'est ni canonique ni planifiée ; le choix à priorité égale reste déterministe par identifiant.
- Le non-facturé reste hors CA signé/facturé ; aucun read-model ne crée de Devis ou Réservation.
- Coûts et marges restent derrière `finance.read`, les sorties UI sont échappées et aucune dépendance/réseau/télémétrie n'est ajoutée.
- Migration, digests, sauvegarde privée et rollback exportable ne sont pas affectés par ce correctif de calcul.

## P2 suivis non bloquants

1. `sprint7OccupancyStateValid()` ne lie pas encore exhaustivement chaque scope d'idempotence à Société/Site/acteur/résultat et ne refuse pas explicitement les scopes dupliqués.
2. Le rejeu d'un seuil global après révocation est fail-closed par la garde placée avant le marqueur, mais la séquence HTTP complète création → révocation → rejeu et l'absence SSE ne disposent toujours pas d'un test dédié.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `7051fe4ff4849b1e9849e81b8266d73fa6c2fda6` |
| ciblés S7 Actual/Finance/Forecast/Occupation/Migration | **PASS, 41/41** |
| `node --test tests/api.test.js` | **PASS, 42/42** |
| `npm test` | **PASS, 312/312**, 0 échec/skip/todo |
| `node --check server.js && node --check app.js` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Empreintes SHA-256 :

```text
server.js                           6f633bd876977b2a05f6e6e09e0236dfd55f89da04ea38afe86a17ced2e2d575
app.js                              bd6bfb8fdc7e468e09c37a2eef5fe92c82e4988355976ab35fddaaf29b8b5641
tests/sprint7-occupancy.test.js     92c3c4215649220691f2cebb33320adeb22c2973d12e935d87050199e9252598
tests/api.test.js                   69ee260835eae2051ebd40e05162cb6a62e0979621749feae6bc9c39faf2886e
docs/api/openapi-v1.yaml            9d2410c871f59d7f77aca5b902f1bd77e911c5ad333aad340629e3987283f565
```

## Handoff

- Gate SECURITY S7-D : **APPROVED** sur `7051fe4`, 0 P0/0 P1.
- Fichier modifié : `docs/security-review.md` uniquement ; consolidation du statut par l'intégrateur.

---

# Gate SECURITY indépendant — G8 Dashboards, exports & sécurité finale

Date : 2026-08-24

Candidat applicatif exact : `0732150a9816cb3139282fabbd9bd6e3c3fe2a0a`

Reviewer : agent indépendant `g8_security_performance`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts.**

Les coûts et marges internes restent absents des surfaces JSON, CSV, XLSX, PDF, audit, SSE et UI lorsque l'acteur ne possède pas `finance.read`. La matrice indépendante des sept rôles standards sur les six dashboards et les trois familles d'export ne révèle aucune valeur financière hors droit. Les scopes Société/Site/Projet/entité sont appliqués avant agrégation et avant export ; une révocation est réévaluée par les routes et par le flux SSE.

L'override de conflit est fail-closed : permission dédiée, motif de 3 à 500 caractères, version sur les mutations d'une réservation existante, idempotence, audit canonique et SSE après commit. Les refus permission/motif/version et le rollback d'un batch laissent les comptages Réservations/audits/événements inchangés. Le replay exact ne produit pas de second effet, le replay divergent retourne `409`, et la permission est revérifiée au replay.

## Matrice rôle × dashboard × export

Contrôle indépendant direct sur les rôles migrés, complété par les tests HTTP ciblés. `200` signifie autorisé ; `403` signifie refusé. Aucun buffer autorisé d'un rôle non Finance ne contient les clés internes recherchées.

| Rôle | Direction | Finance | Planning | Commercial | Exploitation | Projet | Planning XLSX/PDF | KPI XLSX | `finance.read` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ADMIN | 200 | 200 | 200 | 200 | 200 | 200 | 200/200 | 200 | oui |
| PLANNING_MANAGER | 403 | 403 | 200 | 403 | 200 | 200 | 200/200 | 200 | non |
| PLANNER | 403 | 403 | 200 | 403 | 200 | 200 | 200/200 | 200 | non |
| SALES | 403 | 403 | 403 | 200 | 403 | 403 | 403/403 | 200 | non |
| PROJECT_MANAGER | 403 | 403 | 403 | 200 | 403 | 200 | 200/200 | 200 | non |
| FINANCE | 403 | 200 | 403 | 200 | 403 | 403 | 403/403 | 200 | oui |
| READ_ONLY | 403 | 403 | 200 | 200 | 200 | 200 | 200/200 | 200 | non |

Le `200` KPI désigne au moins un dashboard autorisé et son export correspondant ; l'export réutilise le read-model calculé avec les permissions courantes. La route Planning réimpose `planning.read`. La matrice HTTP ciblée du dépôt confirme les statuts Planner, les en-têtes `no-store`/`nosniff` et l'absence de valeurs internes dans les trois buffers.

## Contrôles de confidentialité

- **API JSON et BI :** les datasets Finance exigent `finance.read`; le catalogue les omet sinon. `actuals` supprime les snapshots de coût et `planning-reservations` ne contient aucune valeur financière.
- **CSV/XLSX :** projection avant sérialisation, limites fermées, cellules commençant par `=`, `+`, `-` ou `@` neutralisées. Les noms de fichiers sont construits depuis des identifiants/date filtrés, pas depuis un chemin utilisateur.
- **PDF :** le Planning n'embarque que période, Site, Projet, statut, ressource, quantité et libellé autorisés ; aucune clé coût/marge.
- **Audit :** `auditEventDto()` retire `before`, `after` et les détails financiers aux lecteurs `audit.read` sans `finance.read`; le test S7 Finance est rejoué avec succès.
- **SSE :** invalidation compacte limitée à type, tenant, Site, entité et version. Les familles coût/dépense/seuil exigent `finance.read`, les scopes sont réévalués et une famille inconnue échoue fermé.
- **UI :** l'entrée Pilotage et les onglets sont dérivés des permissions ; les KPI dynamiques passent par `esc()`. Les formulaires de coûts n'existent que sous `finance.cost.manage`.

## Override et absence d'effet secondaire

`planningConflictOverride()` est l'unique validation de conflit pour création, duplication, copie de cellule, batch create/restore/move/resize/cellDuplicate, PATCH et déplacement de cellule. `applyPlanningConflictOverride()` persiste le motif et le marqueur ; chaque audit affecté conserve `before/after`, conflits, `operationId` et origine. `createReservationCommand()` protège aussi le chemin PlanyBot. La conversion d'un planning client/import refuse tout conflit et ne propose pas de bypass d'override.

Les tests HTTP frais démontrent :

- permission absente : `403 PLANNING_OVERRIDE_FORBIDDEN` ;
- motif absent ou d'un caractère : `422 PLANNING_OVERRIDE_REASON_REQUIRED` ;
- version obsolète : `409 VERSION_CONFLICT` ;
- batch avec une seconde action invalide : rollback intégral ;
- succès motivé : une Réservation, un audit et un événement exactement ;
- replay exact : `200`, aucun second effet ; divergence : `409 IDEMPOTENCY_CONFLICT`.

## P2 non bloquants

1. Le test automatisé S8-D du dépôt matérialise les sept rôles mais exécute les routes HTTP complètes principalement avec Planner. Le harness indépendant couvre toute la matrice au niveau des read-models/buffers ; conserver cette matrice exhaustive comme test de non-régression HTTP permanent réduirait le risque d'une future divergence de routage.
2. La création et le batch disposent de cas négatifs HTTP complets. Les chemins duplication, déplacement et redimensionnement partagent la même validation centrale et ont été inspectés, mais chacun ne possède pas encore son propre scénario HTTP « permission révoquée au replay + aucun audit/SSE ».

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `0732150a9816cb3139282fabbd9bd6e3c3fe2a0a` |
| `node --test tests/sprint8-dashboards.test.js tests/sprint8-exports.test.js tests/sprint8-bi.test.js tests/sprint8-security.test.js` | **PASS, 19/19** |
| `node --test tests/api.test.js` | **PASS, 42/42** |
| `node --test tests/sprint7-finance.test.js tests/sprint8-security.test.js` | **PASS**, 16 tests ciblés, 0 échec |
| `npm test` | **PASS, 331/331**, 0 échec/skip/todo |
| `npm run lint` | **PASS** |
| matrice indépendante sept rôles × six dashboards × trois exports | **PASS**, aucune fuite détectée |
| inspection auth/scopes/audit/SSE/override/import | contrôles fail-closed confirmés |

Empreintes SHA-256 :

```text
server.js                           1e07f1f3c0a68df3c3a990f29b185275dd70e0053056da12a115569fb3cd0883
app.js                              2325f2f5b568954b435d5b4f2255803bb22022d01f9cdf227eca5f4687bc3e1c
index.html                          d78c8c8a68cec49d7c2a73d694129099fd09415be41b422eb4abcf4f498e2a89
tests/sprint8-security.test.js      b1b84d9c813fb3669f5eb40de4dbd8c0f9f47e2b0c35b174618a4d6f46ebbcc6
tests/sprint8-dashboards.test.js    64f3fe9f10a0c8ce8f236dfe6155ede400b60f2452b0dd12b591d0b9b067f4a4
tests/sprint8-exports.test.js       e5a80094531912e2c3b80a28bf6706599736e2d3a0fff77b99a580b00f7dc397
tests/sprint8-bi.test.js            a0c8dbf3ecb64974559d52a5bc6b0ac2c14b87467ad670ec6b7d77004b591f32
docs/api/openapi-v1.yaml            19d82f82b1956fdd6a47422dcc8841e0b75345fb5d84da844e16c7905c654caa
```

## Handoff

- Gate SECURITY G8 : **APPROVED** sur `0732150`, 0 P0/0 P1, 2 P2 suivis.
- Fichier modifié par ce gate : `docs/security-review.md` uniquement.
- `docs/project-status.md` reste à consolider par l'intégrateur.

---

# Re-gate SECURITY indépendant — G8 terminal

Date : 2026-08-24

Candidat applicatif exact : `33ec24b2632729dd5faa45f47ca162b84c0df1d4`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 ouvert, 0 P3.**

La revalidation terminale confirme que les dashboards, leurs drill-downs et leurs exports sont fermés par défaut, recalculés avec les droits et scopes courants et dépourvus de coûts/marges pour tout acteur sans `finance.read`. La matrice est désormais réellement exercée par HTTP sur les sept rôles standards, les six dashboards et les trois surfaces écran/drill-down/XLSX, soit **126 requêtes dashboard**, auxquelles s'ajoutent les exports Planning XLSX/PDF de chaque rôle. Les tests ciblés sont verts, ainsi que la suite complète de 337 tests.

## RBAC, scopes et confidentialité

- **Dashboards :** chaque vue exige `dashboard.read` puis sa combinaison fonctionnelle. Direction et Finance exigent `finance.read`; Exploitation exige notamment `maintenance.read`. Les refus surviennent avant toute réponse contenant des compteurs.
- **Scopes :** l'autorité Société provient de la session. Site, Projet et scopes d'entités sont appliqués avant agrégation et reconstruits pour le drill-down et l'export. Une entité explicitement demandée hors scope reste indistinguable via `404`.
- **Matrice HTTP :** les sept rôles migrés sont appliqués successivement à une session fraîche puis testés sur écran, drill-down KPI explicite et export KPI XLSX. Les statuts attendus `200/403` sont vérifiés pour chaque combinaison. Les sorties autorisées sans `finance.read` sont inspectées contre les clés de coût et marge internes. Les exports Planning exigent `planning.read`.
- **Données financières :** les datasets BI Finance restent absents du catalogue et refusés sans `finance.read`; Commercial, Planning et Projet ne projettent aucun snapshot de coût. Audit et SSE conservent leurs projections restreintes.
- **Maintenance :** le dashboard Exploitation et ses consommateurs exigent `maintenance.read`, puis filtrent les actifs par Site et scope d'entité avant de compter les maintenances ouvertes.
- **Entrées/sorties :** `kpiId` est obligatoire dans OpenAPI et son absence retourne `422 DASHBOARD_KPI_REQUIRED`. Pages publiques bornées à 500 lignes, exports Planning à 10 000 lignes/250 ressources et PDF à 62 jours. Les cellules tableur à préfixe de formule sont neutralisées, le XML et le PDF sont échappés, les téléchargements sont `no-store`/`nosniff`.

## SSE, rejeu et idempotence

Le scénario dynamique de duplication de cellule ouvre réellement le SSE : le premier appel produit les invalidations attendues, le rejeu exact ne produit aucun nouvel événement et un payload divergent retourne `409`. Les permissions, le tenant et les scopes sont revérifiés avant de restituer un résultat idempotent. Aucun audit ni événement supplémentaire n'est produit au rejeu exact.

## P2 non bloquant

### SEC-G8-03 — la borne d'export KPI est appliquée après matérialisation du détail

L'export interne refuse correctement un détail supérieur à 10 000 sources avec `422 EXPORT_TOO_LARGE` et ne livre aucun fichier tronqué. En revanche, `dashboardDrilldownReadModel()` construit encore les lignes de tous les KPI avant de vérifier le total. Sur le dataset contractuel, le refus Direction porte sur 16 004 lignes et coûte `518,81 ms` p95. Pour un utilisateur authentifié autorisé, une volumétrie locale supérieure peut donc consommer inutilement CPU et mémoire. Recommandation : compter/borner pendant la construction ou calculer/exporter KPI par KPI avec arrêt anticipé.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `33ec24b2632729dd5faa45f47ca162b84c0df1d4` |
| ciblés G8 Dashboards/Exports/BI/Sécurité + Finance | **PASS, 38/38**, 0 échec/skip/todo |
| matrice HTTP 7 rôles × 6 dashboards × écran/drill-down/XLSX | **PASS, 126/126 statuts conformes**, sans fuite financière détectée |
| Planning XLSX/PDF pour chacun des 7 rôles | **PASS**, droits `planning.read` respectés |
| scénario SSE de rejeu exact | **PASS**, aucune seconde invalidation |
| `npm test` | **PASS, 337/337**, 0 échec/skip/todo |
| `npm run lint` | **PASS** |
| inspection OpenAPI/routes/projections/scopes/bornes | contrôles fail-closed confirmés |

Empreintes SHA-256 :

```text
server.js                           9c76d64ff05850e41a91bddca4519f7870b231b8ff95aa3ad061a5b41bdb7e37
app.js                              8897086486d372cf94b87c0b6c4a5fb5e0d5a6d10d2c67b4489e282af95aa0e5
tests/sprint8-security.test.js      9c08bff300bb20ac1cb0b4b6267f07cd7622ddf7abe0aad230973c63d103ca97
tests/sprint8-dashboards.test.js    d864ebdeb5cadd76ee50d474e95af5bfba588dfccd7772a4e8f19ae7d40f1084
tests/sprint8-exports.test.js       7570ca69c479f50dc169139210b9111cda6bb614fc2c99ce96721aaaa60a7529
docs/api/openapi-v1.yaml            7395603efc38905461287d6c517d61653729869a76230a020ea3b3e6877a860c
```

## Limites et handoff

- Aucun navigateur frais n'était nécessaire pour le verdict Sécurité : les routes HTTP et buffers réels couvrent les surfaces d'autorité et de confidentialité; le visuel relève de QA/E2E.
- `git diff --check` global est actuellement rouge sur des espaces de fin de ligne dans `docs/code-review.md`, fichier modifié en parallèle et hors ownership de ce gate. Aucun de ces écarts ne concerne `docs/security-review.md`.
- Gate SECURITY G8 : **APPROVED** sur `33ec24b2`, 0 P0/0 P1.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement. Consolidation de `docs/project-status.md` laissée à l'intégrateur conformément à l'exception d'ownership.

---

# Revalidation SECURITY indépendante — G8 après corrections

Date : 2026-08-24

Candidat applicatif exact : `1d4d97b3c43b6d91756b5c74207371dd879c760a`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts.**

Les corrections ferment les deux surfaces de sécurité affectées par le retour G8 : le dashboard Exploitation exige désormais `maintenance.read`, y compris avant ses compteurs et son drill-down, et le rejeu exact de `duplicateReservationCell` ne réémet plus l'invalidation `quote.planningProgress.v1`. Les dashboards, drill-downs et exports recalculent leurs permissions et scopes depuis l'acteur courant ; aucune valeur de coût ou de marge n'est projetée pour un acteur sans `finance.read`.

## Contrôles d'autorisation et de confidentialité

- **RBAC dashboard/export :** `dashboard.read` ouvre la famille de routes, puis `dashboardReadModel()` exige les permissions propres à chaque vue. Exploitation exige `planning.read`, `resource.read` et `maintenance.read`. Finance/Direction restent fermés sans `finance.read`; Commercial et Projet n'ajoutent les marges que lorsque ce droit est présent.
- **Scopes :** Société de session, Site, Projet, Client, Devis, Réservation, Ressource et catégorie sont filtrés avant agrégation. Un Site, Projet ou Ressource explicitement demandé hors scope retourne `404`. Le drill-down reconstruit le dashboard avec l'acteur courant avant de produire ses lignes.
- **Maintenance :** les actifs passent `siteAllowed()` et `entityAllowed()` avant que leurs maintenances ouvertes contribuent au KPI ou au détail. Sans `maintenance.read`, la vue entière retourne `403`, sans compteur latéral.
- **Finance :** les KPI coût/marge ne sont construits qu'avec `finance.read`. Les exports KPI réutilisent ce read-model ; Planning XLSX/PDF ne contient aucun champ financier. Les tests Finance confirment aussi le masquage Audit et DTO commerciaux.
- **Sorties :** cellules XLSX et CSV commençant par `=`, `+`, `-` ou `@` neutralisées ; XML et texte PDF échappés ; noms de fichiers construits depuis des dates/identifiants nettoyés. Les téléchargements portent `no-store` et `nosniff` et restent en mémoire.
- **Bornes :** Planning refuse plus de 10 000 lignes ou 250 ressources, PDF refuse plus de 62 jours, les pages publiques de drill-down sont limitées à 500 lignes. L'absence de plafond sur le travail total pré-pagination du drill-down est suivie en P2 Performance/abus.

## SSE et idempotence

Le chemin `duplicateReservationCell` revalide au rejeu l'existence et le scope de la Réservation résultat, ainsi que le droit d'override si applicable. Un payload divergent retourne `409`. Sur un rejeu exact, `result.replay` bloque désormais les deux émissions `reservation.cellDuplicated.v1` et `quote.planningProgress.v1`; le test dynamique ouvre un flux SSE, observe les deux invalidations au premier appel puis aucune invalidation au rejeu.

## P2 non bloquants

1. La matrice automatisée matérialise bien les sept rôles × six dashboards × trois formats, mais sa partie exhaustive appelle directement les read-models et générateurs ; la preuve HTTP complète reste concentrée sur Planner et les cas Finance négatifs. Conserver une matrice HTTP exhaustive permanente réduirait le risque de divergence de routage future.
2. Le drill-down construit toutes les lignes autorisées avant pagination. Les volumes d'export sont finalement bornés et aucun objet hors scope n'est ajouté, mais une volumétrie locale supérieure au dataset contractuel peut augmenter CPU/mémoire pour un utilisateur authentifié. Une borne pré-calcul ou un calcul par KPI doit être conservé comme durcissement anti-abus.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `1d4d97b3c43b6d91756b5c74207371dd879c760a` |
| `node --test tests/sprint8-security.test.js tests/sprint8-dashboards.test.js tests/sprint8-exports.test.js tests/sprint8-bi.test.js tests/sprint7-finance.test.js` | **PASS, 35/35**, 0 échec/skip/todo |
| `npm test` | **PASS, 334/334**, 0 échec/skip/todo |
| `npm run lint` | **PASS** |
| matrice 7 rôles × 6 dashboards × 3 formats | **PASS** au niveau autorité/read-model ; Planner vérifié par HTTP |
| inspection routes/scopes/projections/XLSX/PDF/SSE | contrôles fail-closed confirmés |

Empreintes SHA-256 :

```text
server.js                           015388c5d033f7d43c0e9472d2c8146d7e151eaba053e9a56a4a01bde6172365
app.js                              c40d6bb10cc5394b845131b49f7c06b7de90a878b1e54e97a635f1e42a50f480
tests/sprint8-security.test.js      4258f8e212b8be5ebced51a5b38be4e067efe9b2e361f2c12a805c57962dc7aa
tests/sprint8-dashboards.test.js    2fe0fa87f0fe3e0c902a731b7184914abba75e2de9e139994067ec994dfc4c80
tests/sprint8-exports.test.js       45b0eb8efe99e5770f9573e4219ee23a7affb75ba264ae5b235be3f7937d78e7
docs/api/openapi-v1.yaml            c4adb3ef48d93d9996dd6de8a126a70be82f229b59fa4c68e99c1d9300d6c240
```

## Handoff

- Gate SECURITY G8 : **APPROVED** sur `1d4d97b3`, 0 P0/0 P1.
- Fichier modifié : `docs/security-review.md` uniquement pour l'axe Sécurité.
- `docs/project-status.md` reste à consolider par l'intégrateur.

---

## Référence terminale du journal SECURITY

La section **« Re-gate SECURITY indépendant — G8 terminal »** datée du 2026-08-24 et portant sur `33ec24b2632729dd5faa45f47ca162b84c0df1d4` est la preuve la plus récente et fait autorité : **APPROVED, 0 P0/0 P1/1 P2/0 P3**.

---

# Revalidation ultime SECURITY indépendante — G8

Date : 2026-08-24

Candidat applicatif exact : `b56d13f0cf576dbb5726f567d1c98a2081d2ca61`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 ouvert, 0 P3.**

Le cache de calcul ajouté pour le détail Finance ne crée pas de cache global ni de donnée réutilisable entre acteurs. Il est attaché uniquement au read-model de la requête courante, construit après validation des permissions et après projection Société/Site/Projet/Client/entités. Sa propriété `_dashboardCache` est non énumérable, non modifiable et non configurable ; elle est absente de `Object.keys()` et de la sérialisation JSON. Les exports et drill-downs conservent le même objet autorisé uniquement pendant l'appel courant.

## Cache Finance et autorité

- Direction/Finance exigent `finance.read` avant toute construction du cache. Un acteur non Finance reste refusé par `403` et ne reçoit jamais le read-model concerné.
- Le cache contient le résultat `unbilled` déjà calculé avec `dashboardDb`, lui-même limité aux Devis autorisés et aux Projets, Clients, Sites et entités visibles. Il n'existe aucun registre partagé ni clé devinable.
- `Object.defineProperty()` laisse `enumerable`, `writable` et `configurable` à `false`. Le contrôle dynamique confirme `appearsInKeys=false` et `appearsInJson=false`.
- Le drill-down reconstruit encore ses lignes Projet/Réservation/Réalisé avec les permissions et scopes courants ; le cache ne remplace que le second calcul identique des dépassements facturables.

## Temporalité Projet

`dashboardActualRows()` exige simultanément une Réservation visible dans la période, `actualRecordAllowed()`, la révision courante, une confirmation au plus tard à `asOf` et un intervalle de réalisé intersectant la période. Le nouveau test négatif place un réalisé ancien hors fenêtre et un réalisé visible confirmé après `asOf` : aucun ne contribue à `actuals`/`actualCompletion`, tandis que `actualGap` conserve uniquement la Réservation visible. Le même helper aligne le read-model et son drill-down.

## Régressions de sécurité

- Matrice HTTP sept rôles × six dashboards × écran/drill-down/XLSX toujours verte, avec exports Planning selon `planning.read` et absence de clés financières hors `finance.read`.
- `maintenance.read`, isolation Site/Projet, projections Audit/BI et SSE/idempotence restent couvertes.
- Suite ciblée : 39/39 ; suite complète : 338/338, aucun échec/skip/todo.

## P2 non bloquant

**SEC-G8-03 demeure ouvert :** l'export KPI refuse bien plus de 10 000 sources, mais la vérification intervient encore après matérialisation du détail. Le cache Finance n'aggrave pas l'exposition des données, mais ce calcul tardif reste un durcissement anti-abus CPU/mémoire souhaitable pour un acteur authentifié autorisé.

## Preuves et empreintes

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `b56d13f0cf576dbb5726f567d1c98a2081d2ca61` |
| ciblés G8 + Finance | **PASS, 39/39** |
| `npm test` | **PASS, 338/338** |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |
| cache non énumérable/JSON | **PASS**, faux/faux ; descripteur non writable/configurable |

```text
server.js                           8bf91bc83c49ac42821ea07d3e9128a9bfa9bee3a673ee01807a966c936959ca
app.js                              8897086486d372cf94b87c0b6c4a5fb5e0d5a6d10d2c67b4489e282af95aa0e5
tests/sprint8-dashboards.test.js    aa416fc59090bbaf9ba987cf7fc9df877aefc664b7d12ed1a184157a96a955b1
tests/sprint8-security.test.js      9c08bff300bb20ac1cb0b4b6267f07cd7622ddf7abe0aad230973c63d103ca97
scripts/benchmark-finance.js        087702c7b9bf7d19c4f2a1042bd5318a234332f4863f7c3e571f34857d73e08e
```

## Handoff

- Gate SECURITY G8 : **APPROVED** sur `b56d13f0`, 0 P0/0 P1/1 P2/0 P3.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation SECURITY indépendante — hauteur dynamique Planning RC3

Date : 2026-08-24

Candidat applicatif exact : `e9752f4e791f42bfcd8ad584e898ce68e20a850f`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts, 0 P3.**

Le calcul manipule uniquement des identifiants de ressources déjà filtrés, des dates visibles et des compteurs entiers. La hauteur injectée est produite par une opération numérique interne et suffixée en `px`; aucune chaîne utilisateur ne peut atteindre le style inline. Aucun nouveau vecteur XSS, traversée de scope, modification RBAC, mutation, API ou exposition inter-tenant n'est introduit.

## Threat-check

- `roomIds` et `visibleDates` ferment le comptage au périmètre rendu ; les réservations proviennent du read-model déjà autorisé.
- La clé `resourceId|date/slot` reste interne à une `Map`, sans sérialisation HTML ni sélection de fichier/URL.
- `planningRowHeight()` normalise les valeurs non numériques et impose un minimum ; le `stackDepth` réel est un entier positif borné par le nombre de cellules comptées.
- Le serveur, les permissions, la session, CSRF, SSE et l'échappement des attributs restent inchangés.

## P2 sécurité/disponibilité — SEC-G8-06

Le compteur et la hauteur n'ont pas de plafond fonctionnel. Un utilisateur Planning autorisé peut accumuler des réservations ensuite annulées dans une même cellule : elles ne consomment plus la capacité mais restent rendues et comptées. Sur 10 000 lignes concentrées, la hauteur calculée atteint **620 008 px par ressource**, soit **155 002 000 px** théoriques pour 250 ressources. Il s'agit d'un risque de déni de service local/UI par un acteur authentifié, sans élévation de privilège ni effet serveur. Le gate Sécurité reste approuvé en P2, mais le même défaut bloque le gate Performance.

`SEC-G8-05` demeure également ouvert : purge incomplète des valeurs internes de certains overlays masqués/inertes, sans lien avec ce lot.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `e9752f4e791f42bfcd8ad584e898ce68e20a850f` |
| Foundations + Planning post-production | **PASS, 61/61**, 0 échec/skip/todo, durée `318,96 ms` |
| `npm test` | **PASS, 341/341**, 0 échec/skip/todo, durée `8 885,81 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |
| scénario concentré 10 000 | profondeur `10 000`, hauteur `620 008 px` |

Le navigateur intégré demeure indisponible ; aucun crash/scroll réel à 155 millions de pixels n'a été provoqué. Le risque est démontré par les valeurs déterministes données au layout.

```text
app.js                              4a8427df94b98677a16e99e5795c6aabfff0ea6a0e3e42880ce1e9781f8d2005
planning.css                        48a8ad5bec9e86c56d3444812632506a022be837eef82418f6db1b962d9bec36
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/planning-postproduction.test.js 927dee2c88297b4457c381f42e399db65edfa3f888f1116b790754989266ecee
```

## Handoff

- Gate SECURITY hauteur dynamique : **APPROVED** sur `e9752f4`, 0 P0/0 P1/2 P2/0 P3.
- Nouveau durcissement `SEC-G8-06`; aucune atteinte à la confidentialité ou à l'autorité.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation finale SECURITY — hiérarchie sticky Planning RC2

Date : 2026-08-24

Candidat applicatif exact : `56b9f456734de9389c1f4ab6623a378448fe2b67`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 existant, 0 P3.**

La hiérarchie finale est cohérente : réservation normale `1`, wrapper horaire `4`, réservation focalisée `9`, dates `10`, colonne fixe `11`, coin Ressources `12`. Elle reste très inférieure aux surfaces globales de sécurité et d'action — modale `50`, tiroir Stock `80`, connexion `100`, menu contextuel Planning `1200` — et ne permet à aucun contenu Planning de franchir ces overlays.

## Contrôles

- Les trois sélecteurs ciblent uniquement des classes locales constantes ; aucune entrée, interpolation, URL, HTML ou donnée utilisateur.
- Le coin est maintenant ciblé par son véritable parent `.planning-fixed-column`, contrairement au sélecteur précédent sans correspondance.
- La colonne fixe forme déjà un contexte positionné ; augmenter son niveau ne modifie ni pointer events, ni focus, ni autorité.
- Le focus clavier d'une réservation reste visible dans la grille mais passe correctement sous le header sticky lorsqu'il est scrollé.
- Auth, RBAC, scopes, XSS, session, backend et données sont bit-identiques.
- `SEC-G8-05` demeure le seul P2 non bloquant, sans impact de ce correctif CSS.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `56b9f456734de9389c1f4ab6623a378448fe2b67` |
| diff depuis `d4c7fcf` | trois niveaux CSS corrigés + assertion ; aucun JS/backend |
| Foundations + Planning post-production | **PASS, 60/60**, 0 échec/skip/todo, durée `316,68 ms` |
| `npm test` | **PASS, 340/340**, 0 échec/skip/todo, durée `8 487,34 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Le navigateur intégré reste indisponible ; aucun screenshot ou test de tabulation visuel n'est affirmé. La conclusion repose sur la structure DOM, les contextes d'empilement et les tests contractuels.

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

- Gate SECURITY Planning scroll final : **APPROVED** sur `56b9f45`, 0 P0/0 P1/1 P2 existant/0 P3.
- Aucun nouveau constat Sécurité.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation SECURITY indépendante — correctif scroll Planning RC2

Date : 2026-08-24

Candidat applicatif exact : `d4c7fcfbe423940ff57fbeca541ef0e873d12c15`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 existant, 0 P3.**

Le correctif modifie exclusivement l'ordre de peinture de deux classes constantes dans la grille Planning. Il n'ajoute aucune donnée, entrée, interpolation, URL, contenu généré ou comportement JavaScript. Authentification, RBAC, scopes Société/Site/Projet, échappement, XSS, overlays de session et backend sont bit-identiques au candidat précédemment approuvé.

## Analyse sécurité et stacking

- `.matrix-day` est déjà `position:sticky` avec un `z-index` non automatique ; passer de `4` à `8` ne crée pas une nouvelle surface interactive ni un nouveau contexte d'autorité.
- Le header reste confiné par le conteneur `.planning-matrix-scroll{overflow:auto}` et ne peut pas recouvrir la connexion (`z-index:100`), les modales (`50`), le tiroir Stock (`80`) ou le menu contextuel Planning (`1200`).
- La règle ne modifie ni `pointer-events`, ni focus, ni `tabindex`, ni contenu accessible. Les dates conservent leur comportement clavier existant.
- Le sélecteur `.planning-matrix-scroll .matrix-corner` ne correspond à aucun nœud : `.matrix-corner` appartient à la colonne fixe sœur. Cette partie de la règle est sans effet, mais ne crée aucune exposition.
- `SEC-G8-05` demeure le seul P2 : rémanence locale de valeurs dans certains overlays masqués/inertes, sans lien avec ce correctif.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `d4c7fcfbe423940ff57fbeca541ef0e873d12c15` |
| diff candidat | une règle `z-index` CSS + une assertion statique ; aucun JS/backend |
| Foundations + Planning post-production | **PASS, 60/60**, 0 échec/skip/todo, durée `314,72 ms` |
| `npm test` | **PASS, 340/340**, 0 échec/skip/todo, durée `8 311,31 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Le navigateur intégré demeure indisponible ; aucun contrôle visuel du chevauchement n'est affirmé. La preuve repose sur la structure DOM, les contextes de peinture déclarés et les tests de scroll/virtualisation.

```text
planning.css                        acde3c58dfde5cc7a2d5614594eb20bca82610ae4067369a69936614a514629c
styles.css                          8f14b1483f6bb58522df36a3841e318099ca9a0fc32b82f8b9b6fde1fd07c196
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
tests/foundations.test.js           a9063cc60fd43b94784f3725b5682ac1d243819885fb2cd9468e6bb247dc7906
```

## Handoff

- Gate SECURITY correctif scroll Planning : **APPROVED** sur `d4c7fcf`, 0 P0/0 P1/1 P2 existant/0 P3.
- Aucun nouveau constat Sécurité.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation ultime SECURITY — RC2 focus Pilotage

Date : 2026-08-24

Candidat applicatif exact : `34a9d7883dcf22cad517bf45393848eaa60d48d8`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal RC2

**APPROVED — 0 P0, 0 P1, 1 P2 ouvert, 0 P3.**

`A11Y-G8-01` est fermé. La règle finale, de même spécificité et placée après l'ancienne déclaration, remplace effectivement `color-mix(...35%, transparent)` par `outline:3px solid var(--primary)`. Avec `--primary → #6c5ce7`, l'anneau opaque atteint environ **4,86:1** sur blanc, supérieur au seuil non-textuel **3:1**. L'offset de `2px` crée une séparation blanche visible autour de l'onglet sélectionné même lorsque son fond est le même violet.

## Contrôles

- Le sélecteur reste limité aux boutons Pilotage focalisés au clavier (`:focus-visible`) ; aucun état hover, sélection ou navigation n'est altéré.
- L'indicateur conserve une épaisseur de `3px` et un offset de `2px`, sans dépendre seulement du changement de couleur du composant.
- La règle ne contient aucune donnée dynamique, URL, contenu ou interpolation contrôlable ; aucun vecteur XSS/CSS injection n'est introduit.
- `styles.css`, `app.js`, `server.js`, `index.html`, auth, RBAC, scopes et données sont inchangés.
- Le test Foundations verrouille la règle opaque finale.

## P2 résiduel

**SEC-G8-05** demeure seul ouvert : les valeurs internes de certains overlays masqués/inertes ne sont pas intégralement purgées à la fin de session. Ce correctif de focus est sans impact sur ce durcissement local non bloquant.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `34a9d7883dcf22cad517bf45393848eaa60d48d8` |
| diff depuis `fce2929` | une règle CSS finale + une assertion ; aucun JS/backend |
| Foundations + dashboards G8 | **PASS, 29/29**, 0 échec/skip/todo, durée `1 463,49 ms` |
| `npm test` | **PASS, 340/340**, 0 échec/skip/todo, durée `8 785,32 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |
| contraste sRGB primary/blanc | **4,86:1**, cible non-textuelle `3:1` dépassée |

Le navigateur intégré demeure indisponible ; aucun screenshot ni parcours clavier visuel n'est affirmé. La conclusion accessibilité repose sur la cascade exacte, les dimensions déclarées et le ratio sRGB.

```text
styles.css                          8f14b1483f6bb58522df36a3841e318099ca9a0fc32b82f8b9b6fde1fd07c196
planning.css                        2c4bea06db6d29e0fa6ad8febdd78cb24e553e02ecfeb33f8cd4db666145897b
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
tests/foundations.test.js           aaa49dde1f59c94bf7b4fc292e25852f52a638745f3adc932d7d43b71ce185e3
```

## Handoff

- Gate SECURITY RC2 : **APPROVED** sur `34a9d78`, 0 P0/0 P1/1 P2 (`SEC-G8-05`)/0 P3.
- `A11Y-G8-01` est fermé.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation SECURITY indépendante — aliases CSS post-release G8

Date : 2026-08-24

Candidat applicatif exact : `fce292974c933358bbfd980c8344cc38e5a923ed`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict avant RC2

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts, 0 P3.**

Le correctif définit cinq aliases CSS constants (`primary`, `surface`, `surface-soft`, `text`, `border`) par référence aux tokens locaux existants. Il ne lit aucune entrée utilisateur, ne construit aucun HTML, n'introduit aucune URL ou ressource distante et ne modifie ni JavaScript ni backend. Authentification, RBAC, scopes, projections de données et protections XSS restent bit-identiques.

## Analyse sécurité et accessibilité

- Les aliases sont déclarés dans `:root`, avec des valeurs fermées exclusivement `var(--token-existant)` ; aucune chaîne contrôlée par l'utilisateur ne peut atteindre ces propriétés.
- `--primary → #6c5ce7` avec texte blanc donne environ **4,86:1**, conforme au contraste AA du texte normal.
- `--text → #151823` sur `--surface → #fff` donne environ **17,69:1**.
- `--surface-soft → #eeebff` conserve environ **15,14:1** avec le texte principal.
- Les boutons sélectionnés Pilotage restent différenciés par fond, bordure, texte et `aria-selected`, sans dépendre uniquement de la couleur côté sémantique.
- Aucun impact sur `hidden`, `aria-hidden`, `inert`, transfert de focus de connexion ou fermeture des overlays précédemment validés.

## P2 ouverts

1. **SEC-G8-05 demeure :** les valeurs internes de certains overlays masqués/inertes ne sont pas explicitement purgées à la fin de session. Ce correctif CSS est sans impact sur ce durcissement local.
2. **A11Y-G8-01 — contraste du focus Pilotage :** l'anneau `3px` utilise `color-mix(in srgb,var(--primary) 35%,transparent)`. Composé sur blanc, il est proche de `#ccc6f7`, soit environ **1,62:1** par rapport au fond, sous la cible non-textuelle **3:1**. L'alias rend maintenant cette règle valide et visible, mais une proportion plus forte ou une couleur opaque est recommandée avant stabilisation UX. `--border → #e6e8ed` ne donne qu'environ **1,23:1** sur blanc ; les composants restent identifiables par leur texte/fond, mais ce token ne doit pas servir seul d'indicateur d'état ou de focus.

## Non-régression auth/RBAC/XSS/backend

Le diff applicatif est strictement une déclaration CSS. `app.js`, `server.js`, `index.html`, `planning.css`, contrats API, RBAC et données sont inchangés. La suite complète conserve les refus d'accès, isolation, auth/CSRF, exports et SSE précédemment approuvés.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `fce292974c933358bbfd980c8344cc38e5a923ed` |
| diff candidat | `styles.css` +1 déclaration ; test Foundations +7 ; aucun JS/backend |
| Foundations + dashboards G8 | **PASS, 29/29**, 0 échec/skip/todo, durée `1 451,67 ms` |
| `npm test` | **PASS, 340/340**, 0 échec/skip/todo, durée `9 925,21 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |
| calculs WCAG sRGB | blanc/primary `4,86:1` ; texte/surface `17,69:1` ; focus 35 %/blanc `1,62:1` |

Le navigateur intégré est indisponible (`No browser is available`) : aucun contrôle visuel multi-écran ni focus clavier réel n'est affirmé. Les ratios sont calculés sur les couleurs résolues et le fond blanc déclaré.

```text
styles.css                          8f14b1483f6bb58522df36a3841e318099ca9a0fc32b82f8b9b6fde1fd07c196
planning.css                        51b38d7ed0eef30e085725777bc293c6e2c435dc87e07056913dbc116608197d
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
```

## Handoff

- Gate SECURITY CSS post-release : **APPROVED** sur `fce2929`, 0 P0/0 P1/2 P2/0 P3.
- `A11Y-G8-01` est recommandé avant stabilisation UX mais ne bloque pas techniquement RC2 selon la classification courante.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Re-gate SECURITY indépendant — correctif UI post-E2E G8

Date : 2026-08-24

Candidat applicatif exact : `593d392cd1b29b7d6fe6e92db857f9922b4ee34a`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**REJECTED — 0 P0, 1 P1 ouvert, 1 P2 ouvert, 0 P3.**

Le nouveau triplet `hidden` / `aria-hidden` / `inert` ferme correctement le conteneur `#appShell` avant initialisation JavaScript et à chaque rendu sans session. La règle `.app-shell[hidden]{display:none!important}` empêche la déclaration auteur `display:flex` de neutraliser l'attribut `hidden`. Pour ce sous-arbre, aucune donnée n'est visible, exposée à l'arbre d'accessibilité ou atteignable au clavier hors session.

Le correctif n'englobe cependant pas toutes les surfaces authentifiées : les trois overlays `#modalBackdrop`, `#commandPalette` et `#stockDrawerBackdrop` sont des frères placés après `#appShell`. `endSession()` puis `render()` ne ferment que le shell et affichent l'écran de connexion. Un overlay ouvert au moment d'un `401` conserve donc son état `hidden=false`, son contenu déjà rendu et ses contrôles focalisables. La fermeture est incomplète et le gate reste bloqué.

## Constats

### P1 — SEC-G8-04 — overlays authentifiés hors du shell non neutralisés à la perte de session

- `index.html` place `#modalBackdrop`, `#commandPalette` et `#stockDrawerBackdrop` après la fermeture de `#appShell`.
- Ces surfaces peuvent contenir respectivement des informations de réservation/projet, des résultats de recherche autorisés, et des informations Stock/Maintenance.
- La réponse `401` appelle bien `endSession()` de manière fail-closed, mais cette fonction ne masque, ne vide et ne rend inerte aucun de ces overlays. `render()` ne modifie que `#appShell` et `#loginScreen`.
- Conséquence reproductible par le flux de code : si la session expire pendant qu'un overlay est ouvert, celui-ci peut rester visible et interactif au-dessus de la connexion ; le focus n'est pas garanti de quitter son contrôle actif.
- Correction attendue : inclure toutes les surfaces authentifiées dans un conteneur commun neutralisé, ou fermer/vider explicitement chaque overlay et transférer le focus vers la connexion dans le chemin unique de fin de session. Ajouter un test de transition avec chaque overlay ouvert.

### P2 — SEC-G8-05 — contenu authentifié conservé dans le DOM et en mémoire après déconnexion

Le shell est désormais correctement soustrait à l'affichage, à l'accessibilité et au focus, mais `endSession()` et le logout ne purgent pas `app.innerHTML` ni tous les read-models chargés. Le contenu résiduel reste inspectable par un script exécuté dans l'origine ou via les outils développeur. Ce n'est pas une élévation de privilèges serveur — l'API reste l'autorité et refuse la session expirée — mais purger les données sensibles à la déconnexion réduirait l'exposition locale résiduelle.

## Contrôles favorables

- Le document initial est fail-closed : `#appShell` possède `hidden aria-hidden="true"` avant l'exécution de l'application.
- Le rendu synchronise les trois états du shell : `hidden`, `aria-hidden` et `inert`.
- Toute réponse API `401`, hors tentative de connexion, appelle `endSession()` ; SSE et jeton CSRF client sont neutralisés.
- Le fallback prototype reste explicitement limité au mode statique/prototype et ne remplace pas silencieusement un refus HTTP.
- Le backend, les scopes, RBAC, exports, projections financières, idempotence et SSE ne sont pas modifiés par `593d392`; `server.js` est identique au candidat G8 précédemment contrôlé.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `593d392cd1b29b7d6fe6e92db857f9922b4ee34a` |
| diff applicatif `HEAD^..HEAD` | `app.js` 1/1, `index.html` 1/1, `styles.css` 1/0 ; aucun changement backend |
| ciblés Foundations + dashboards + sécurité G8 | **PASS, 32/32**, 0 échec/skip/todo |
| `npm test` | **PASS, 339/339**, 0 échec/skip/todo |
| `npm run lint` | **PASS** |
| `node --check app.js` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Le navigateur intégré n'était pas disponible (`browsers.list()` vide). Aucun résultat visuel ou de navigation clavier n'est donc affirmé. Le P1 repose sur la structure DOM et les transitions d'état explicites ; un smoke navigateur overlay ouvert + invalidation de session reste requis après correction.

```text
app.js                              cfc158f6d2d9cf8f0d5aa82a83810eb4ac4899f84785a3662ec03d39da48b738
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
styles.css                          b26952fc8f08d8c3798c0764a7da2286acb35a53f5abcd03114545c869d6b8a1
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/foundations.test.js           6b47b94a2b09c3fd116a03a527fb6096265c8142716d3b39b4bdfb9c003578cc
```

## Handoff

- Gate SECURITY G8 post-E2E : **REJECTED** sur `593d392`, 0 P0/1 P1 (`SEC-G8-04`)/1 P2 (`SEC-G8-05`)/0 P3.
- Retour DEV requis pour neutraliser toutes les surfaces hors shell lors de toute fin de session, puis re-gate Sécurité.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; `docs/project-status.md` reste à consolider par l'intégrateur.

---

# Revalidation terminale SECURITY — wrapper final de rendu G8

Date : 2026-08-24

Candidat applicatif exact : `68489b1fc0575706ecbf13c191ab033dc1981d63`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 ouvert, 0 P3.**

Le wrapper terminal appelle désormais `syncAuthenticatedSurfaces(Boolean(state.user))` avant toute délégation aux wrappers composés. Il couvre ainsi aussi les routes spécialisées qui rendent directement leur page — notamment Pilotage, Finance et Réalisations — sans atteindre systématiquement le rendu de base. Toutes les routes passent désormais par la fermeture du shell et des overlays avant tout retour hors session.

## Contrôles de sécurité

- **Fail-closed global :** avec `state.user` absent, le wrapper terminal masque/rend inertes shell et overlays, ferme les overlays, purge `#app`, puis les wrappers internes aboutissent à l'écran de connexion et au focus e-mail.
- **Routes composées :** le nouvel appel se trouve sur le wrapper le plus externe, après la composition Pilotage et avant l'ajout des exports Planning ; aucun court-circuit de route ne peut le contourner.
- **Auth/RBAC :** `Boolean(state.user)` ne crée aucune autorité nouvelle. Les permissions visibles (`can(...)`) restent appliquées dans chaque wrapper et l'autorité serveur/RBAC/scopes est inchangée. Le wrapper ne charge ni ne projette aucune donnée.
- **XSS :** aucun contenu utilisateur, HTML ou sélecteur dynamique n'est ajouté ; l'appel manipule uniquement quatre identifiants DOM constants déjà contrôlés.
- **Focus :** hors session, le premier appel purge et rend inertes les surfaces authentifiées ; le rendu de base transfère ensuite le focus vers l'e-mail si nécessaire. Un second appel éventuel est idempotent et ne réouvre aucun overlay.
- **Session expirée :** le chemin `401 → endSession() → render()` atteint nécessairement ce wrapper terminal avant tout rendu spécialisé.

## P2 résiduel inchangé — SEC-G8-05

Le contenu principal est purgé et les overlays sont cachés/inertes, mais les valeurs internes statiques de certains overlays ne sont pas explicitement vidées. Elles restent seulement inspectables localement, sans visibilité, accessibilité ou interaction. Ce durcissement non bloquant n'est ni aggravé ni fermé par le wrapper terminal.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `68489b1fc0575706ecbf13c191ab033dc1981d63` |
| diff `08595fc..68489b1` | un appel terminal de synchronisation + une assertion statique ; backend inchangé |
| ciblés Foundations + dashboards + sécurité G8 | **PASS, 32/32**, 0 échec/skip/todo, durée `1 917,26 ms` |
| `npm test` | **PASS, 339/339**, 0 échec/skip/todo, durée `7 801,21 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Le navigateur intégré est resté indisponible lors du re-gate précédent et aucun navigateur n'a été rendu disponible depuis. Aucun smoke visuel/focus n'est affirmé ; la limite E2E demeure documentée.

```text
app.js                              4e65e29b37afc0c5be542990d1a15cb82d4e07d546d84c276d1fe29324f97671
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
styles.css                          b26952fc8f08d8c3798c0764a7da2286acb35a53f5abcd03114545c869d6b8a1
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/foundations.test.js           1b8a66d2e062c31287bedfce6bcf82ae88fb2da63f1648c128749163d726d8e0
```

## Handoff

- Gate SECURITY G8 wrapper terminal : **APPROVED** sur `68489b1`, 0 P0/0 P1/1 P2 (`SEC-G8-05`)/0 P3.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; statut global à consolider par l'intégrateur.

---

# Revalidation terminale SECURITY — fermeture overlays G8

Date : 2026-08-24

Candidat applicatif exact : `08595fc2e643490c416117210e1b8dd8ddf34ed2`

Reviewer : agent indépendant `g8_sec_perf_final`

## Verdict terminal

**APPROVED — 0 P0, 0 P1, 1 P2 ouvert, 0 P3.**

`SEC-G8-04` est fermé. Le chemin commun `syncAuthenticatedSurfaces(false)` est appelé au début de tout rendu hors session, qu'il provienne d'un `401`, du logout ou de l'initialisation. Avant d'afficher la connexion, il masque et rend inertes `#modalBackdrop`, `#commandPalette` et `#stockDrawerBackdrop`, masque/rend inerte le shell, purge le contenu principal puis transfère le focus vers le champ e-mail si nécessaire. Un overlay ouvert ne peut donc plus rester visible, accessible ou focalisable après perte de session.

## Fermeture de SEC-G8-04

- La liste fermée des trois overlays hors shell est traitée par un seul helper appelé avant le retour non authentifié.
- Chaque overlay reçoit `inert=true` et `hidden=true` hors session. À la prochaine session, `inert=false` est rétabli sans ouvrir arbitrairement l'overlay ; son état `hidden` reste fermé jusqu'à une action autorisée.
- `app.replaceChildren()` élimine le document métier principal avant l'affichage de la connexion.
- Le focus n'est déplacé vers `loginForm.elements.email` que si l'élément actif n'est pas déjà dans l'écran de connexion, ce qui évite de casser une saisie de reconnexion.
- La détection `401` et `endSession()` restent fail-closed ; CSRF et SSE sont neutralisés. Aucun contrat serveur, RBAC, scope, export ou projection financière n'est modifié.

## P2 résiduel — SEC-G8-05 réduit mais non fermé

Le contenu principal `#app` est maintenant purgé, ce qui réduit matériellement l'exposition DOM signalée. Les overlays statiques sont en revanche seulement cachés et rendus inertes : leurs champs de formulaire, résultats de recherche ou contenu de tiroir déjà injectés ne sont pas explicitement vidés. Ils ne sont plus visibles, exposés à l'arbre d'accessibilité ni utilisables au clavier, mais peuvent rester inspectables localement jusqu'au prochain rendu. Un effacement ciblé des valeurs et résultats sensibles à la fin de session fermerait ce durcissement non bloquant.

## Preuves fraîches et limites

Environnement : macOS arm64, Node `v26.6.0`.

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` avant rapports | `08595fc2e643490c416117210e1b8dd8ddf34ed2` |
| diff `593d392..08595fc` | `app.js` + helper central ; test Foundations renforcé ; aucun changement backend |
| ciblés Foundations + dashboards + sécurité G8 | **PASS, 32/32**, 0 échec/skip/todo, durée `2 439,05 ms` |
| `npm test` | **PASS, 339/339**, 0 échec/skip/todo, durée `11 011,94 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` | **PASS** avant rapports |

Le navigateur intégré demeure indisponible (`browsers.list()` vide après consultation du diagnostic de connexion). Le contrôle visuel et la navigation clavier réelle ne sont donc pas affirmés ; le gate repose sur le contrat DOM, l'ordre synchrone des mutations et les tests. Un smoke navigateur session expirée avec chacun des trois overlays ouvert reste recommandé en E2E.

```text
app.js                              24a00f070b3677cf920a2d802a16721c7f25d4dd42d72d3fbea14b6fdd6cbddc
index.html                          419c3fdedcdb03e90cc3fec28d81d723d18be84eb2c9646fcfa0debba76d200d
styles.css                          b26952fc8f08d8c3798c0764a7da2286acb35a53f5abcd03114545c869d6b8a1
server.js                           b287ee5a967310ce087cf0699603ff6f14f059b690a54453b7941bb1f9e0102d
tests/foundations.test.js           0a09c42af8028fa4676ec9f984c8aa01cb1a4854494b3f55a52674ed14288b80
```

## Handoff

- Gate SECURITY G8 overlays : **APPROVED** sur `08595fc`, 0 P0/0 P1/1 P2 (`SEC-G8-05`)/0 P3.
- `SEC-G8-04` est fermé ; aucune reprise DEV bloquante demandée sur cet axe.
- Fichier modifié par cet axe : `docs/security-review.md` uniquement ; `docs/project-status.md` reste à consolider par l'intégrateur.
## Pré-SECURITY — Catalogue articles SAGE — 2026-08-26

Statut : **0 P0/P1 connu — verdict SECURITY indépendant requis**.

Contrôles effectués : permission serveur `article.read`/`article.manage`, CSRF et origine via garde globale, `companyId` issu de session, identifiant autre société retourné 404, payload tenant refusé, champs bornés, booléen strict, code analytique unique par société, données UI échappées, référentiel non servi par la liste statique, idempotence liée acteur/société/commande, contrôle optimiste, audit puis SSE après succès.

Migration/rollback : sauvegarde privée `0600`, nom borné au répertoire des données, digest complet dans le marqueur, altération détectée avant restauration, export de récupération distinct obligatoire et créé en `0600`. Aucun secret, réseau, SaaS ou nouvelle dépendance.

Preuves négatives dans `tests/article-catalog.test.js` : non-administrateur 403, type `active` forgé 422, tenant forgé 400, autre société 404/liste vide, version obsolète 409, sauvegarde altérée `MIGRATION_BACKUP_CONFLICT`, rollback sans export `ROLLBACK_EXPORT_REQUIRED`.

Limite P2 : l’interface doit encore être exercée dans un vrai navigateur avec des désignations contenant des caractères HTML afin de confirmer visuellement l’échappement et le focus du tiroir.

---

# Gate SECURITY indépendant — Catalogue articles SAGE

Date : 2026-08-26

Reviewer : agent indépendant `article_security`

Candidat : arbre de travail basé sur `231abf5aaf8641dad1229bb98db3a451c05bf694` ; empreintes du périmètre testé consignées ci-dessous.

## Verdict

**APPROVED — 0 P0, 0 P1, 1 P2 de validation E2E, 0 vulnérabilité critique ou élevée identifiée.**

Le lot conserve l’autorité serveur et l’isolation par société. Les mutations du catalogue passent par l’authentification, la permission `article.manage`, la garde globale Origin/CSRF, la validation fermée des champs, l’écriture atomique, l’audit puis l’invalidation SSE après succès. Les lecteurs dotés de `article.read` ne peuvent pas muter.

## Threat-check

- **Auth/session/CSRF/origine :** les routes `/api/v1/article-catalog*` passent par `requireAuth`; toute méthode non sûre passe par `mutationGuard`. Les cookies restent `HttpOnly`, `SameSite=Lax` et `Secure` en production. La politique Origin locale reste fail-closed pour un client navigateur.
- **RBAC et tenant :** `article.read` et `article.manage` sont distincts. Le `companyId` effectif vient exclusivement de la session ; `assertNoTenantFields` refuse un tenant injecté dans le corps. Les listes, lectures, révisions, mutations, devis et SSE filtrent la société ; un identifiant d’un autre tenant retourne `404`.
- **Validation et abus :** liste blanche de champs ; chaînes bornées de 40 à 500 caractères ; formats des codes validés ; booléen `active` strict ; code analytique unique par société ; corps HTTP borné par la limite globale ; pagination bornée. Le code SAGE peut volontairement être dupliqué conformément à la spécification.
- **Concurrence/idempotence :** création idempotente liée à la société, l’acteur, la commande, la clé et le digest du contenu. Une réutilisation divergente est refusée. Les mises à jour exigent la version courante et un motif.
- **XSS et documents :** toutes les données catalogue insérées dans la vue utilisent `esc`/`inputValue`. Le PDF normalise en ASCII et échappe `\\`, `(` et `)`, ce qui empêche l’injection dans le flux PDF. Le snapshot d’article est construit côté serveur ; le client ne peut pas forger les codes historiques.
- **Audit et SSE :** création et modification sont auditées dans la même mutation atomique. L’événement `articleCatalog.updated.v1` n’est émis qu’après succès ; sa permission est `article.read` et son scope exige la société active.
- **Analytique :** les codes proviennent du snapshot immuable de la ligne de devis. Les datasets conservent leurs permissions `quote.read`/`finance.read` et leur scope existant ; les nouveaux filtres sont bornés et appliqués après construction du read-model scoped.
- **Statiques/secrets/réseau :** le JSON référentiel, les données, scripts, tests et sources ne figurent pas dans la liste blanche statique. Aucun connecteur SAGE, SaaS, télémétrie, dépendance ou accès réseau d’exécution n’est ajouté. Les identifiants de démo des tests ne sont pas des secrets réels.
- **Migration/sauvegarde/rollback :** migration additive et rejouable ; sauvegarde placée dans le répertoire des données avec mode `0600`, chemin de restauration réduit par `basename`, digest vérifié avant restauration. Le rollback exige un export de récupération distinct, créé avec `wx`/`0600` et vérifié avant l’écriture atomique de la sauvegarde.

## Constat non bloquant

### P2 — SEC-ART-01 — validation navigateur dynamique à rejouer en E2E

L’échappement HTML est explicite dans les chemins de rendu et les contrats statiques passent, mais le gate SECURITY n’a pas injecté une désignation hostile dans un navigateur réel ni exercé le focus du tiroir et l’actualisation SSE entre deux sessions. Ce manque de preuve E2E n’indique pas une faille constatée ; il doit rester dans le parcours E2E avant release.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/article-catalog.test.js` | **PASS, 5/5**, 0 échec |
| `node --test tests/sprint8-security.test.js` | **PASS, 4/4**, 0 échec |
| `node --test --test-name-pattern='login émet\|mutation sans CSRF\|fichiers serveur' tests/api.test.js` | **PASS, 3/3**, cookie/CSRF et refus des fichiers sensibles couverts |
| `npm run lint` | **PASS** |
| `git diff --check` avant rapport | **PASS** |
| inspection ciblée | RBAC, tenant, Origin/CSRF, validation, XSS/PDF, idempotence, audit/SSE, statiques, analytics, migration et rollback relus |

Empreintes SHA-256 du candidat contrôlé :

```text
server.js                              e80a84366429127c2cd4ec8190159ff238aaa3896b5ce780d4986ccbac6f58fd
app.js                                 ea6f0fbc933690cb771802d31ddb274445321c4784d88a4c258f87c2ede1f705
packages/auth/rbac.js                  397ea28934c89233ed6901acd2ea06ed2a90df82ad92d968b968506b0b088f57
scripts/rollback-article-catalog.js    b12700a14844c98f8ff738eb0f0f7440f57d8c6a26750c22369ff48c60ab78fd
tests/article-catalog.test.js          748bdb364a2b7ae5bd1e642ddf3f52c70b74667cbca6e491e6e1d96aa60ceb2b
referentials/article-catalog-sage-v1.json 6f460ddfb2527900b5db48853b706094ecca93bf0f8e03f9028aabc18a3ef5f6
docs/api/openapi-v1.yaml               180cea31cb6d28dc62e656e567e7e24ddd4db03d0a839eb351d23d646c89af48
```

## Handoff

- Gate SECURITY Catalogue articles SAGE : **APPROVED**.
- Aucun retour DEV bloquant sur cet axe ; `SEC-ART-01` est à couvrir au gate E2E.
- Fichier modifié par le reviewer : `docs/security-review.md` uniquement.
- `docs/project-status.md` reste à consolider par l’intégrateur conformément à l’ownership confié.

## Rectificatif SECURITY après constat REVIEW croisé

Le verdict `APPROVED` ci-dessus est **annulé et remplacé** par :

**REJECTED — 0 P0, 1 P1 ouvert, 1 P2 ouvert.**

### P1 — SEC-ART-02 — le wrapper article contourne le masquage financier du devis

Le constat REVIEW a été reproduit dans la composition des wrappers de `app.js` :

1. le wrapper historique `quoteWorkspacePage` retire `<details class="quote-editor-internals">...</details>` lorsque l’acteur ne possède pas `finance.read` ;
2. le lot article encapsule ensuite directement `quoteA4Workspace`, puis exécute `quoteWorkspacePage=quoteA4Workspace` ;
3. cette réaffectation terminale contourne le wrapper de confidentialité et les wrappers d’édition déjà composés.

La défense serveur `restrictedFinancialDto` retire bien les clés financières des réponses destinées aux acteurs sans `finance.read`, ce qui limite l’exposition API. Elle ne rend toutefois pas acceptable la régression UI : la surface « Outils internes / Coûts / marge » redevient visible sans la permission requise et peut consommer un objet déjà présent en mémoire dans certains enchaînements de contexte. Le contrat de confidentialité n’est plus garanti par la composition frontend.

Correction attendue : ajouter la référence SAGE autour du `quoteWorkspacePage` terminal déjà composé, sans réassigner celui-ci à une implémentation de base ; ajouter un test pour un rôle `quote.read` sans `finance.read` vérifiant l’absence des outils internes/coûts/marges et la présence de la référence article.

Conséquence gate : retour **DEV**, puis REVIEW, QA et SECURITY/PERFORMANCE aval impactés sur le candidat corrigé. `SEC-ART-01` reste non bloquant mais ne peut pas compenser ce P1.

---

# Re-gate SECURITY indépendant — Correctifs Catalogue articles SAGE

Date : 2026-08-26

Reviewer : agent indépendant `article_security`

Candidat : arbre de travail courant ; empreintes du périmètre contrôlé consignées ci-dessous. Le dernier changement reçu avant verdict borne le rendu local du catalogue à 100 lignes par page et ne modifie ni l'autorité API ni les données retournées.

## Verdict

**APPROVED — 0 P0, 0 P1, 2 P2 ouverts ; aucune vulnérabilité critique ou élevée identifiée.**

`SEC-ART-02` est fermé sur ce candidat. Un helper idempotent ajoute la référence SAGE à `quoteA4Workspace` et enveloppe explicitement le `quoteWorkspacePage` terminal déjà composé. Sa base est donc le wrapper de confidentialité Finance, qui continue de retirer les outils internes pour un acteur sans `finance.read`; aucune réaffectation à l'implémentation A4 de base ne le contourne. La défense en profondeur serveur reste active : `restrictedFinancialDto` supprime récursivement les clés de coût et de marge des listes, détails et versions de devis avant émission. Le test ciblé confirme à la fois le masquage des DTO et le refus des mutations financières sans permission.

## Revalidation ciblée

- **Auth/session/CSRF/origine et RBAC :** les routes catalogue restent derrière `requireAuth`; les mutations passent par `mutationGuard` et exigent `article.manage`. Les lecteurs `article.read` ne peuvent pas muter. Les cookies de session, le jeton CSRF et le refus des mutations sans CSRF ont été rejoués.
- **Isolation société et changement de contexte :** le serveur tire `companyId` de la session, refuse les champs tenant forgés et répond `404` pour l'identifiant d'une autre société. Côté client, chaque chargement capture la société et un `requestToken`; une réponse ou erreur tardive est ignorée si la société ou le jeton a changé. `resetArticleCatalogContext()` invalide les requêtes, vide le cache et annule le timer SSE lors du changement de société, de la fin de session et du logout.
- **SSE et courses asynchrones :** l'invalidation catalogue est filtrée par type, permission et société côté serveur puis à nouveau par `payload.companyId` côté client. Elle intervient après écriture atomique et audit. Le debounce est annulé au reset. Une saisie sale du même tenant n'est pas écrasée silencieusement ; l'utilisateur est averti. Les réponses API tardives ne peuvent pas repeupler le catalogue d'un ancien contexte.
- **Validation, XSS et pagination :** champs en liste blanche, formats et longueurs bornés, booléen strict, unicité analytique par société, version optimiste et motif contrôlé. Les valeurs catalogue passent par `esc`/`inputValue`; le PDF échappe ses métacaractères. La pagination ajoutée borne le DOM à 100 lignes mais conserve l'échappement de chaque cellule et n'élargit aucun droit.
- **Idempotence, audit et analytique :** la création reste liée à la société, l'acteur, la commande, la clé et le digest. Les snapshots article des lignes sont construits côté serveur, immuables dans les versions, et alimentent l'analytique sans accepter de code historique forgé du client. Les datasets financiers conservent `finance.read`.
- **Statiques, secrets et réseau :** la liste blanche statique continue de refuser sources serveur, données et variables d'environnement. Aucun secret, connecteur distant, SaaS, télémétrie, accès réseau d'exécution ou dépendance n'est ajouté.
- **Migration/sauvegarde/rollback :** migration additive et rejouable, sauvegarde privée `0600`, digest vérifié, chemin réduit au répertoire de données et export de récupération distinct obligatoire avant restauration. Les tests couvrent l'altération de sauvegarde et le conflit de version.

## Constats non bloquants

### P2 — SEC-ART-01 — preuve navigateur hostile/focus toujours à produire

Le rendu utilise les fonctions d'échappement attendues et les contrats statiques passent, mais ce re-gate n'a pas injecté une désignation hostile dans un navigateur réel ni vérifié au clavier le focus du tiroir. Cette limite de preuve reste à fermer au gate E2E.

### P2 — SEC-ART-03 — tiroir article ancien tenant non purgé au changement de société

`resetArticleCatalogContext()` invalide correctement le cache, les requêtes et le timer SSE, mais ne ferme pas `stockDrawerBackdrop` et n'efface pas `activeStockEditor`/le formulaire article. Si l'utilisateur change de société avec ce tiroir ouvert, les valeurs de l'article de l'ancien contexte peuvent rester visibles localement au-dessus du nouveau contexte. La soumission ne permet pas d'écriture inter-tenant : elle utilise la nouvelle session et l'ancien identifiant est refusé `404`; le serveur reste l'autorité. Il s'agit néanmoins d'une confusion de contexte et d'une rémanence UI à corriger en fermant et purgeant explicitement le tiroir article lors du reset. Ajouter aussi ce tiroir au contrôle de modifications non enregistrées avant changement d'organisation.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/article-catalog.test.js` | **PASS, 5/5**, 0 échec, durée `548,01 ms` sur l'état final gelé |
| `node --test --test-name-pattern='les DTO commerciaux masquent' tests/sprint7-finance.test.js` | **PASS, 1/1**, 0 échec ; DTO sans coûts/marges et mutations financières refusées |
| `node --test --test-name-pattern='login émet\|mutation sans CSRF\|fichiers serveur' tests/api.test.js` | **PASS, 3/3**, 0 échec |
| `node --test tests/sprint8-security.test.js` | **PASS, 4/4**, 0 échec, durée `2 096,15 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` avant rapport | **PASS** |
| inspection ciblée | composition des wrappers Finance/article, reset tenant, jetons async, SSE, auth/RBAC/CSRF, isolation, XSS, rollback et analytics relus |

Empreintes SHA-256 du candidat contrôlé :

```text
app.js                                 6d13b444eb0b16082df366b1900773e9fa33d735577be2fb8d6510f9e0943860
server.js                              a9260004c8132404d0bc1dd58c8da89a1b915d8a21fc99b9ae7e9eb6199673e6
tests/article-catalog.test.js          428dabf11a95bb328268c837c26c150d9d9a3b220ad05103601dc262a13ff2ad
docs/api/openapi-v1.yaml               e79c0d5a946e7eda56ef868dce08f0d2ddba9ea6b7a842679ea4d5a5f2fbc37f
```

## Handoff

- Gate SECURITY corrigé Catalogue articles SAGE : **APPROVED** ; `SEC-ART-02` fermé.
- Aucun retour DEV bloquant sur cet axe. `SEC-ART-03` et la preuve E2E `SEC-ART-01` restent visibles comme P2.
- Fichier modifié par le reviewer : `docs/security-review.md` uniquement.
- `docs/project-status.md` reste à consolider par l'intégrateur conformément à l'ownership confié.

---

# Re-SECURITY différentiel — route directe `#articles`

Date : 2026-08-26

Reviewer : agent indépendant `article_security`

## Verdict différentiel

**APPROVED — 0 P0, 0 P1 ; les deux P2 `SEC-ART-01` et `SEC-ART-03` du re-gate précédent restent ouverts et inchangés.**

Le correctif appelle `syncAuthenticatedSurfaces(true)` au début du rendu authentifié propre à `#articles`, avant de masquer l'écran de connexion et avant d'injecter le contenu du catalogue. Il restaure ainsi le shell privé, `aria-hidden=false` et `inert=false` sur une ouverture directe après connexion, sans contourner les contrôles d'authentification, de permission ou de tenant.

## Analyse des transitions

- **Chargement initial sans session :** `index.html` livre `#appShell` avec `hidden` et `aria-hidden=true`. Le wrapper Articles délègue au rendu de base lorsque `state.user` est absent; `syncAuthenticatedSurfaces(false)` maintient le shell caché et inerte, ferme les overlays privés, purge `#app`, puis affiche la connexion. Aucune donnée privée n'est chargée ni rendue.
- **Connexion sur `#articles` :** le shell reste caché pendant l'authentification et `hydrateFromApi()`. Une fois la session et son contexte société établis, le rendu Articles active synchroniquement le shell puis masque la connexion dans la même tâche JavaScript. Le contenu n'est injecté qu'après ces mutations et uniquement si `article.read` est présent; sinon une page « Accès refusé » remplace le contenu.
- **Logout et `401` :** les deux chemins invalident le contexte catalogue, ferment le flux d'événements, retirent l'utilisateur puis rappellent `render()`. Le wrapper Articles délègue alors au rendu non authentifié, qui cache/inert le shell, ferme les overlays et purge le contenu métier avant d'afficher la connexion. Sur `401`, `endSession()` est appelé synchroniquement avant la propagation de l'erreur API; aucune réponse tardive ne peut repeupler le catalogue grâce au `requestToken` et au contrôle de société.
- **Tenant :** le correctif ne modifie pas le contexte ni le chargement. Le catalogue reste chargé pour le `companyId` de session, avec cache vidé au changement de société et réponses tardives rejetées si le tenant ou le jeton change. `SEC-ART-03` reste néanmoins applicable au tiroir déjà ouvert, que ce patch ne purge pas.
- **Surfaces privées et absence d'exposition transitoire :** le shell est masqué par défaut dans le HTML et le rendu hors session est fail-closed. Lors de l'authentification, l'activation du shell et le masquage du login sont des mutations synchrones sans point d'attente ni frame intermédiaire. Les overlays ne sont pas ouverts par `syncAuthenticatedSurfaces(true)` : ils deviennent seulement non inertes et conservent leur attribut `hidden` jusqu'à une action autorisée.
- **Impact performance :** non impacté de manière mesurable. Le patch ajoute un appel DOM O(1) portant sur le shell et trois overlays, sans requête, parcours du catalogue, changement de pagination, sérialisation ni mutation serveur. Le benchmark 10k n'a donc pas été rejoué pour ce différentiel; les limites P2/P3 du rapport Performance restent inchangées.

## Preuves fraîches

Environnement : macOS arm64, Node `v26.6.0`.

| Commande / contrôle | Résultat |
|---|---|
| `node --test tests/article-catalog.test.js` | **PASS, 5/5**, 0 échec, durée `533,84 ms` |
| `node --test tests/foundations.test.js` | **PASS, 17/17**, 0 échec, durée `332,66 ms` |
| `node --test --test-name-pattern='login émet\|mutation sans CSRF\|fichiers serveur' tests/api.test.js` | **PASS, 3/3**, 0 échec, durée `444,92 ms` |
| `npm run lint` | **PASS** |
| `git diff --check` avant rapport | **PASS** |
| inspection d'ordre | shell initial fermé; branche sans session déléguée; branche authentifiée synchronisée avant contenu; logout/401 fail-closed; tenant/token inchangés |

Empreintes SHA-256 du candidat différentiel :

```text
app.js                                 4e827ab58f77d412fe62740956a12cfe032b448c911cd52593e103192657d8c5
index.html                             d2d7615a191578b7398db6cab75e9d77dd7cfd4a31494bb74c848e833bb874c5
tests/article-catalog.test.js          b0438e085c278b890b4514f8a445c8d6985c89514dfe3c5f251853e8d966b4b7
tests/foundations.test.js              81af03baa607a81fc66e210c3cda032f240b7e37abbe47c08606a3816db96abf
```

## Handoff

- Re-SECURITY route directe `#articles` : **APPROVED**, aucun nouveau P0/P1/P2.
- Le verdict du re-gate Catalogue reste **APPROVED — 0 P0, 0 P1, 2 P2**.
- Fichier modifié : `docs/security-review.md` uniquement; aucun code ni statut projet modifié.
