# Plan QA exécutable — Rental, Stock, Finance & Analytics 0.2

Statut : préparation du Gate QA, avant DEV  
Date : 2026-08-14  
Owner : QA indépendant  
Références : `AGENTS.md`, `docs/spec-rental-stock.md`, `docs/spec-finance-analytics.md`, `docs/spec-mvp.md`, `docs/architecture.md`

## 1. Portée et règle de verdict

Ce plan valide le premier incrément 0.2 sur l'architecture RC1 conservée : Node.js/CommonJS, API `/api/v1`, SSE, persistance JSON atomique et aucun service externe. Il ne valide ni une migration TypeScript/React/SQLite, ni une facture fiscale, ni un paiement, ni une intégration ERP.

La QA teste le serveur comme autorité. Les contrôles UI sont vérifiés en complément, jamais comme preuve d'autorisation. Chaque test part d'un fichier de données temporaire déterministe ; aucun test ne modifie `data/planify.json`. Les horloges, identifiants, graines et fuseaux sont contrôlés. Une erreur attendue doit vérifier le statut HTTP, le code stable, le `requestId`, l'absence d'écriture/audit/SSE partiel et l'absence de fuite de périmètre.

Les tests 0.2 rejoignent la commande contractuelle existante :

```bash
npm test
```

Aucun script npm supplémentaire n'est supposé avant son ajout explicite par DEV. Les preuves consignent date, commit, Node, OS, commande, fixture, nombre de tests, durée et verdict.

## 2. Fixtures déterministes

### 2.1 Périmètres, rôles et temps

| Alias | Donnée |
|---|---|
| `company-a` | société EUR, sites `paris-a` et `boulogne-a` |
| `company-b` | tenant hostile, site `paris-b`, identifiants connus des tests uniquement |
| `admin-a` | tous sites A ; toutes permissions Stock/Rental/Finance/Analytics/Audit |
| `planner-a` | `paris-a` seulement ; lecture parc/stock/rental, écriture dossier, checkout/return, stock.move ; aucune finance |
| `viewer-a` | `paris-a` seulement ; lecture parc/stock/rental/dashboard ; aucune mutation ni finance |
| `admin-b` | toutes permissions société B |
| `clock` | horloge figée `2026-09-15T10:00:00.000Z`, timezone métier `Europe/Paris` |

Les tests de concurrence utilisent deux sessions distinctes, deux cookies et deux CSRF. Les tests de tenant dupliquent volontairement SKU, numéro de série et code d'emplacement entre A et B pour prouver que l'unicité est par société sans révélation croisée.

### 2.2 Stock et matériel

| Alias | Caractéristiques |
|---|---|
| `loc-paris-main` | stockage actif, site Paris, code `PAR-MAIN` |
| `loc-paris-stage` | staging actif, site Paris |
| `loc-paris-quarantine` | quarantaine, site Paris |
| `loc-boulogne-main` | stockage actif, site Boulogne |
| `camera` | article sérialisé, SKU `CAM-FX6`, actif |
| `camera-1` / `camera-2` | disponibles, condition `good`, Paris |
| `camera-maint` | statut `maintenance` |
| `camera-quarantine` | statut `quarantine`, condition `damaged` |
| `ssd` | article quantité, SKU `SSD-2T`, solde initial 10 à Paris |
| `cable` | article quantité, solde initial 2 à Paris, destiné au test dernière unité |
| `kit-shoot` | 2 caméras génériques + 3 SSD ; composants mixtes traçables par `sourceKitId` |

Le solde attendu est toujours reconstruit depuis les mouvements. Un manifeste fixe le nombre de mouvements, leurs `correlationId` et le solde attendu par article/site/emplacement.

### 2.3 Planning et dossiers Rental

| Alias | Période / état |
|---|---|
| `res-confirmed` | confirmée Paris, `[2026-09-16T08:00Z,12:00Z)`, projet/client A |
| `res-option` | option Paris, `[2026-09-17T08:00Z,10:00Z)` |
| `res-cancelled` | annulée Paris, même ressource matérielle liée |
| `res-adjacent` | commence exactement à la fin de `res-confirmed` |
| `order-draft` | lié à `res-confirmed`, lignes caméra 1 + SSD 3 |
| `order-out` | sortie partielle avec quantités restantes |
| `order-returned` | dossier historique entièrement retourné |

### 2.4 Finance et Analytics

| Alias | Donnée / oracle |
|---|---|
| `rate-r1-v1` | coût 6 500, vente 12 000 centimes/h-capacité, effectif avant septembre |
| `rate-r1-v2` | coût 7 000, vente 13 000, effectif `2026-09-20T00:00Z` |
| `rate-r2` | coût 4 000, vente 8 000 |
| `resource-no-rate` | ressource active sans tarif |
| `budget-p1` | revenu 5 000 000, coût direct 2 400 000 centimes |
| `valuation-known` | confirmé, 4 h × quantité 2 avec `rate-r1-v1` : coût 52 000, revenu 96 000, marge 44 000, taux 45,83 % |
| `valuation-option` | catégorie `forecast`, jamais préfacturable |
| `valuation-incomplete` | allocation sans tarif, code `MISSING_RATE` |
| `draft-a` | client A, lignes confirmées complètes, version 1 |
| `exported-a` | snapshot exporté immuable |

Ajouter une réservation traversant le passage DST Europe/Paris et une réservation multi-ressources dont chaque ligne produit un demi-centime afin de vérifier `roundHalfUp` ligne par ligne avant sommation.

## 3. Matrice Domaine — Rental et Stock

| ID | Cas | Oracle |
|---|---|---|
| `RS-U-001` | périodes adjacentes sur le même exemplaire | disponibles ; aucun chevauchement `[début, fin)` |
| `RS-U-002` | inclusion, englobement, chevauchements gauche/droite | `timeOverlap` |
| `RS-U-003` | quantité 0, négative, fractionnaire, NaN ou chaîne | `VALIDATION_ERROR`, aucune mutation |
| `RS-U-004` | somme des mouvements quantity | solde exact par site/emplacement ; jamais négatif |
| `RS-U-005` | mouvement sérialisé quantité autre que 1 ou sans asset | refus |
| `RS-U-006` | même asset deux fois dans une ligne/plusieurs lignes | refus avant allocation |
| `RS-U-007` | asset `out`, `maintenance`, `quarantine`, `retired` | indisponible sans override possible |
| `RS-U-008` | dossier `draft`, `returned`, `cancelled` chevauchant | ne bloque pas la disponibilité |
| `RS-U-009` | dossier `out` dont `endsAt` est passé | reste bloquant jusqu'au retour réel |
| `RS-U-010` | expansion du kit puis modification du modèle | lignes du dossier inchangées, `sourceKitId` conservé |
| `RS-U-011` | sérialisé prêt avec N assets distincts ; quantity préparée N | passage `ready` accepté uniquement si complet |
| `RS-U-012` | sortie/retour partiel | `out <= prepared`, `returned <= out`, statut intermédiaire conservé |
| `RS-U-013` | retour complet | statut `returned`, allocations libérées, localisation/solde exacts |
| `RS-U-014` | retour `damaged` | asset en quarantaine, non disponible |
| `RS-U-015` | ouvrir/clore maintenance | mouvements `maintenanceIn/Out`, état final explicite et atomique |
| `RS-U-016` | transitions hors graphe ou mutation lignes en `ready/out` | `INVALID_ORDER_TRANSITION` |
| `RS-U-017` | annulation `draft/preparing` sans sortie | terminal, allocations libérées |
| `RS-U-018` | annulation dossier sorti | refus ; état/mouvements inchangés |
| `RS-U-019` | transfert intra/inter-site autorisé | un mouvement atomique, emplacement/site courant unique |
| `RS-U-020` | inventaire posté deux fois ou écart sans motif | `INVENTORY_ALREADY_POSTED` ou validation ; aucun double ajustement |

## 4. Matrice Domaine — Finance et Analytics

| ID | Cas | Oracle |
|---|---|---|
| `FA-U-001` | 4 h × q2, coût 6 500, vente 12 000 | 52 000 / 96 000 / 44 000 centimes |
| `FA-U-002` | revenu 0 | marge calculée en montant, taux `null` |
| `FA-U-003` | intervalle traversant DST | durée UTC réelle, pas durée murale nominale |
| `FA-U-004` | multi-allocation et demi-centimes | arrondi demi-unité vers le haut par ligne, puis somme |
| `FA-U-005` | deux tarifs autour d'`effectiveFrom` | plus récent `<= startsAt`; borne exacte incluse |
| `FA-U-006` | option / confirmée / annulée | forecast / committed / zéro actif ; seule confirmée préfacturable |
| `FA-U-007` | ressource sans tarif | valorisation `incomplete`, `MISSING_RATE`, occupation conservée |
| `FA-U-008` | changement tarif après snapshot | valorisation historique inchangée sans réévaluation explicite |
| `FA-U-009` | preview puis revalue avec versions courantes | preview sans écriture ; revalue atomique, motivée et auditée |
| `FA-U-010` | token preview expiré/réutilisé ou version changée | refus total, aucune réévaluation partielle |
| `FA-U-011` | budget absent / zéro / positif / dépassé | états distincts ; taux `null` si zéro ; dépassement non bloquant et audité |
| `FA-U-012` | réservation coupée par la fenêtre | durée-capacité et montants proratisés sur intersection uniquement |
| `FA-U-013` | période vide | montants 0, marge rate `null`, aucun groupe artificiel |
| `FA-U-014` | breakdown par chaque dimension | somme des lignes arrondies = summary ; jamais somme de pourcentages |
| `FA-U-015` | filtre option+confirmed | forecast et committed séparés ; total éventuel nommé prévision totale |
| `FA-U-016` | budget dans breakdown hors projet | budget absent ; jamais proratisé |

## 5. API et cas négatifs

Chaque endpoint des sections 7 Rental/Stock et 8 Finance/Analytics reçoit au minimum : succès, payload invalide, non authentifié, permission insuffisante, site interdit, tenant étranger, version obsolète et référence inexistante quand applicable. Les listes vérifient pagination, bornes, filtres combinés, stabilité de l'ordre et total.

### 5.1 Rental / Stock

| ID | Action | Assertions |
|---|---|---|
| `RS-API-001` | CRUD item/location/asset/kit | représentation canonique, version, timestamps, unicités normalisées |
| `RS-API-002` | SKU/serial/code dupliqué dans A puis identique dans B | conflit dans A ; succès isolé dans B ; aucune fuite |
| `RS-API-003` | asset sur article quantity, emplacement d'un autre site, enums inconnus | 422, aucune écriture |
| `RS-API-004` | désactiver item utilisé puis l'ajouter à un dossier | historique lisible ; nouvelle ligne refusée |
| `RS-API-005` | création dossier lié à réservation | site/projet/période recopiés du Planning ; valeurs client falsifiées ignorées/refusées |
| `RS-API-006` | `prepare → ready → checkout → return` | versions monotones, représentations complètes, mouvements/audits corrélés |
| `RS-API-007` | ready incomplet, checkout > préparé, retour > sorti | codes métier, rollback complet |
| `RS-API-008` | deux commandes même `Idempotency-Key` | un seul mouvement/audit ; payload différent avec même clé refusé |
| `RS-API-009` | version N utilisée par deux sessions | une réussite, puis `409 VERSION_CONFLICT`, gagnant intact |
| `RS-API-010` | deux préparations de la dernière unité | une seule réussite ; autre `409`; solde >= 0 ; aucun audit partiel |
| `RS-API-011` | transfert asset affecté/sorti ou emplacements invalides | refus sans changement de site/localisation |
| `RS-API-012` | maintenance concurrente avec préparation | une opération gagne ; état et journal cohérents |
| `RS-API-013` | stock/mouvement filtré par site/item/asset/order/date | intersection exacte, journal immuable |
| `RS-API-014` | tentative PATCH/DELETE d'un mouvement | route absente ou refusée ; journal inchangé |

### 5.2 Finance / Analytics

| ID | Action | Assertions |
|---|---|---|
| `FA-API-001` | CRUD tarifs, effectiveAt, budgets | montants entiers >= 0, EUR, versions et sélection correcte |
| `FA-API-002` | date d'effet dupliquée | `409 RATE_EFFECTIVE_DATE_CONFLICT`, aucune ligne/audit de succès |
| `FA-API-003` | float, négatif, dépassement entier sûr, devise non EUR | 422 stable ; aucun montant flottant persisté |
| `FA-API-004` | création/modification/annulation Planning | valorisation et audit dans la même écriture ; agrégats cohérents |
| `FA-API-005` | revalue preview puis commit | ancien/nouveau détaillés ; token opaque ; motif/version requis |
| `FA-API-006` | summary et breakdown, filtres combinés | mêmes sources, statuts, bornes et totaux ; période <= 366 jours |
| `FA-API-007` | dimensions/grains invalides ou combinaison excessive | `VALIDATION_ERROR`, réponse bornée |
| `FA-API-008` | créer draft avec option/annulée/incomplète/autre client/site | refus atomique et code précis sans révélation croisée |
| `FA-API-009` | montant falsifié envoyé par le client | ignoré ; ligne reconstruite depuis valorisation canonique |
| `FA-API-010` | même allocation dans deux drafts concurrents | une réussite ; `409 BILLING_LINE_ALREADY_USED` |
| `FA-API-011` | source change après draft | `stale`; recalculate explicite ; aucune mutation silencieuse des lignes |
| `FA-API-012` | export confirmé + Idempotency-Key | snapshot/CSV identiques au rejeu ; statut `exported` |
| `FA-API-013` | modifier/recalculer/revalue ligne exportée | `BILLING_DRAFT_IMMUTABLE`, snapshot inchangé |
| `FA-API-014` | archive puis release-lines motivé | archivage logique, libération auditée, lignes réutilisables ensuite |
| `FA-API-015` | version obsolète budget/draft/tarif | `409 VERSION_CONFLICT`, état récent non écrasé |

## 6. Permissions et isolation

Toutes les cases sont appelées directement par HTTP avec cookie et CSRF valides. L'absence de bouton UI ne suffit pas.

| Action | Admin A | Planner A | Viewer A | Admin B / site interdit |
|---|---:|---:|---:|---:|
| lire parc/stock/dossiers/maintenance Paris A | oui | oui | oui | non |
| gérer item/asset/kit/location | oui | non | non | non |
| créer/modifier/préparer dossier | oui | oui | non | non |
| checkout/return/transfert | oui | oui | non | non |
| ajuster inventaire | oui | non | non | non |
| ouvrir/clore maintenance | oui | non | non | non |
| lire dashboard occupation | oui | oui | oui | non |
| lire tarifs/budgets/valorisations/drafts | oui | non | non | non |
| lire Analytics financier | oui | non | non | non |
| gérer Finance | oui | non | non | non |
| export/archive/release-lines | oui | non | non | non |

Tests transverses :

- `companyId` injecté dans tous les payloads est ignoré comme autorité ;
- identifiants d'un autre tenant ou site produisent `404 NOT_FOUND`, jamais une erreur métier révélatrice ;
- demande Analytics contenant un seul site interdit reçoit 404, sans réduction silencieuse ni total partiel ;
- relevé multi-site recontrôlé à chaque lecture, mutation et téléchargement ;
- planner/viewer ne reçoivent aucun montant via API, erreur, SSE, HTML initial, cache navigateur ou CSV ;
- doublons inter-tenant n'affectent ni recherche ni messages d'unicité du tenant courant.

## 7. Intégration avec Planning, persistance, audit et SSE

| ID | Scénario transactionnel | Oracle |
|---|---|---|
| `INT-001` | réservation active liée à ressource/asset puis préparation logistique chevauchante | même moteur de conflit, disponibilité cohérente dans les deux sens |
| `INT-002` | option Planning | consomme stock et finance forecast, non préfacturable |
| `INT-003` | confirmation de l'option | disponibilité inchangée ; forecast devient committed et préfacturable si complète |
| `INT-004` | annulation réservation avec order draft/preparing sans sortie | order annulé, allocations libérées, valorisation active retirée atomiquement |
| `INT-005` | annulation réservation avec order ready/out | `409 LOGISTICS_ORDER_ACTIVE`, aucun état partiel |
| `INT-006` | déplacement/resize/change resources Planning | nouveau contrôle Stock + nouvelle valorisation dans la même mutation |
| `INT-007` | erreur Stock ou Finance injectée avant commit | Planning, valuation, order, mouvements et audit tous rollbackés ; aucun SSE |
| `INT-008` | succès mutation multi-module | données/audit persistés avant invalidations SSE versionnées |
| `INT-009` | deux onglets autorisés | invalidation ciblée < 3 s ; client recharge, ne reconstruit pas depuis événement |
| `INT-010` | session sans finance connectée au SSE | aucun total/montant/identifiant financier sensible |
| `INT-011` | restart après workflow complet | collections, versions, snapshots, soldes reconstruits et audits identiques |
| `INT-012` | conversion seed RC1 vers 0.2 | additive, backup préalable, collections RC1 inchangées, seed répétable |

Vérifier pour chaque mutation sensible : validation → RBAC → isolation → version → calcul complet → écriture atomique données+mouvements+audit → commit → SSE. Les événements en rollback et les audits de succès partiels sont des échecs bloquants.

## 8. Sécurité

| ID | Contrôle | Attendu |
|---|---|---|
| `SEC-001` | sans session, cookie expiré/altéré | 401, aucune donnée ou mutation |
| `SEC-002` | mutation sans/mauvais CSRF et Origin interdit | 403, aucune écriture |
| `SEC-003` | IDOR sur tenant/site à tous niveaux et lignes imbriquées | 404 indistinguable, aucune fuite de compte/total/timing volontaire |
| `SEC-004` | XSS dans noms, notes, motifs, SKU, serial, libellé draft | stockage borné, rendu texte échappé, CSV non exécutable |
| `SEC-005` | formule CSV (`=`, `+`, `-`, `@`), CRLF, séparateur, Unicode | neutralisation tableur, structure/en-têtes stables, UTF-8 |
| `SEC-006` | corps > limite, listes/filters/recherche non bornés | 413/422, mémoire et réponse bornées |
| `SEC-007` | nombres monétaires extrêmes / prototype pollution / JSON invalide | rejet contrôlé, aucun crash/overflow/champ injecté |
| `SEC-008` | bruteforce login et réutilisation idempotency/preview token | limitation existante ; token borné, scellé à session/payload et non rejouable |
| `SEC-009` | logs/audit/SSE/CSV | aucun cookie, CSRF, mot de passe, notes libres, montant vers rôle non autorisé |
| `SEC-010` | chemins `/data`, backups, exports, sources, tests, docs, `.git`, `.env`, encodages | 404 ; téléchargement export authentifié et non durable |
| `SEC-011` | audit dépendances/runtime | aucune dépendance externe nouvelle, aucune vulnérabilité critique/élevée connue |
| `SEC-012` | runtime réseau bloqué après installation | toutes fonctions 0.2 disponibles localement sans SaaS/CDN/télémétrie |

Les motifs d'override/ajustement/revalue/release sont exigés, bornés et traités comme texte. Aucun override ne contourne stock physique négatif, asset sorti, maintenance, quarantaine, retraite ou immutabilité d'un relevé exporté.

## 9. E2E interface

Exécuter à 1440×900 et 1024×768, plus consultation à 768 px. Utiliser rôles/libellés accessibles ou attributs de test stables. Vérifier clavier, focus visible, libellés, états textuels non fondés sur la couleur, chargement/vide/partiel/refusé/version obsolète et persistance après rechargement.

1. `E2E-RS-01` — admin crée emplacement, article sérialisé, deux assets et kit ; filtres et reload exacts.
2. `E2E-RS-02` — réservation confirmée → dossier lié → kit → préparation → ready → checkout → retour complet ; contexte Planning non ressaisi et disponibilité restaurée.
3. `E2E-RS-03` — conflit même asset chevauchant, détail générique, période rendue adjacente, préparation acceptée.
4. `E2E-RS-04` — retour endommagé → quarantaine → maintenance → clôture avec état explicite → disponible.
5. `E2E-RS-05` — deux sessions sur dernière unité ; une réussite, autre 409, solde non négatif, actualisation SSE.
6. `E2E-RS-06` — checkout/retour partiels ; statuts intermédiaires, retour final et mouvements corrélés.
7. `E2E-RS-07` — inventaire avec écart ; planner refusé, admin ajuste avec motif, solde/audit cohérents.
8. `E2E-FA-01` — admin crée deux tarifs et budget ; reload conserve valeurs/versions.
9. `E2E-FA-02` — réservation multi-ressources valorisée ; Analytics exact, retour planning avec filtres/période.
10. `E2E-FA-03` — option forecast non préfacturable, confirmation committed puis ligne sélectionnable.
11. `E2E-FA-04` — tarif manquant visible sans bloquer Planning ; préfacturation interdite.
12. `E2E-FA-05` — draft client → contrôle lignes → export CSV → reload → snapshot immuable.
13. `E2E-FA-06` — source draft déplacée → stale → recalcul explicite → nouveaux montants et audit.
14. `E2E-X-01` — annulation Planning met à jour occupation/finance et règle le dossier selon son état physique.
15. `E2E-X-02` — viewer/planner : menus/actions conformes, appels directs refusés, aucun montant financier.
16. `E2E-X-03` — deux onglets modifient même order/budget/draft ; version obsolète, reload gagnant, SSE.
17. `E2E-X-04` — arrêt/redémarrage après sorties, retours et export ; états, soldes, snapshots et audits inchangés.

Une action irréversible/logique sensible (checkout, retour endommagé, ajustement, export, archive, release) exige une confirmation explicite. Les parcours de préparation ont une alternative clavier complète.

## 10. Performance et robustesse

### 10.1 Jeux et protocole

Graine `20260814`, build/runtime candidat, fichier JSON temporaire chaud :

- Stock/Rental : 500 articles, 2 000 assets, 10 000 mouvements, 1 000 orders, demande de 50 lignes ;
- Finance/Analytics : 100 ressources, 10 000 réservations/12 mois, 100 projets, 20 clients, 1 000 versions de tarifs, 100 drafts jusqu'à 500 lignes ;
- 20 utilisateurs locaux concurrents.

Effectuer au moins 5 échauffements et 30 mesures, consigner médiane/p95/max/erreurs, Node, OS, CPU/mémoire, taille du fichier et hash du générateur. Les écritures concurrentes sont sérialisées. Une comparaison de baseline exige le même environnement.

| ID | Mesure | Seuil |
|---|---|---|
| `PERF-001` | stock paginé par site | p95 < 300 ms |
| `PERF-002` | availability check 50 lignes | p95 < 300 ms |
| `PERF-003` | Analytics summary, 31 jours | p95 < 300 ms |
| `PERF-004` | Analytics breakdown paginé | p95 < 400 ms |
| `PERF-005` | mutation Planning + valorisation | p95 total < 250 ms |
| `PERF-006` | création/recalcul draft 500 lignes | p95 < 500 ms |
| `PERF-007` | réponse interactive | < 1 MiB, page max 100 hors export |
| `PERF-008` | écran chargé sur jeu de référence | exploitable < 2 s, filtres sans blocage prolongé |
| `PERF-009` | SSE autorisé après commit | visible < 3 s pour 100 % des clients mesurés |
| `PERF-010` | 20 sessions, dernière unité/ligne billing concurrente | aucune corruption, double allocation ou stock négatif |

Une régression > 15 % contre la baseline validée déclenche analyse même si le seuil absolu passe. Après charge : relire JSON, reconstruire soldes, recalculer agrégats/snapshots et vérifier aucune corruption ni fichier temporaire abandonné.

## 11. Ordre d'exécution du Gate QA

1. confirmer même état candidat/hash que REVIEW ;
2. `node --check server.js`, `node --check app.js` ;
3. tests domaine Rental/Stock puis Finance/Analytics ;
4. API, permissions, concurrence et intégration Planning ;
5. `npm test` complet, deux fois si une intermittence est suspectée ;
6. sécurité automatisée et inspection ciblée logs/SSE/CSV/statique ;
7. performance sur runner de référence ;
8. E2E interface et redémarrage ;
9. publier `docs/qa-report.md`, puis laisser Security/Performance, Integration et E2E rendre leurs propres gates indépendants.

Un test intermittent est un défaut, pas un succès après relance. Aucun test n'est assoupli pour correspondre à une implémentation incorrecte. Tout défaut reçoit sévérité, fixture, étapes, attendu/observé, preuve et test de non-régression.

## 12. Conditions `APPROVED`

Le Gate QA 0.2 est **APPROVED** uniquement si, sur le même état candidat :

- chaque critère d'acceptation des deux spécifications est relié à au moins un test automatisé ou E2E et passe ;
- `npm test` retourne 0, avec 100 % des tests 0.2 et de régression RC1 réussis, zéro skip/quarantaine non justifié ;
- zéro P0/P1 et zéro défaut ouvert affectant intégrité, stock négatif, double allocation, montant, tenant/site, RBAC, audit, atomicité, version ou immutabilité ;
- la matrice rôles × routes et les cas d'identifiants devinés passent côté serveur ;
- soldes reconstruits = journal, Analytics breakdown = summary, snapshots financiers = sources/version documentées ;
- les workflows multi-modules sont atomiques et aucun SSE/audit de succès n'est émis après rollback ;
- tous les seuils performance sont respectés avec preuves archivées ;
- aucun secret ou montant non autorisé ne fuit dans UI/API/logs/SSE/CSV, et aucune vulnérabilité critique/élevée n'est connue ;
- les 17 parcours E2E passent avec clavier/accessibilité, persistance et redémarrage applicables ;
- sauvegarde/conversion additive et procédure de rollback sont vérifiées sans exécuter de rollback destructif sur données réelles ;
- `docs/qa-report.md` identifie hashes, environnement, commandes, résultats, limites et verdict indépendant.

Sinon le verdict est **CHANGES REQUIRED**. Toute correction retourne à DEV puis repasse QA et les gates aval impactés. Ce plan ne met pas à jour `docs/project-status.md` car la mission est explicitement limitée à `docs/qa-plan-0.2.md`; cette mise à jour reste à effectuer par l'intégrateur.
