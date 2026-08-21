# Feuille de route d’architecture — RC1 vers cible v1

Statut : proposition d’exécution incrémentale  
Date : 2026-08-14  
Point de départ : `0.1.0-rc1` Node.js/CommonJS, monolithe mono-processus, API + SSE, JSON atomique  
Cible : monolithe modulaire extractible décrit dans `docs/target-architecture-v1.md`

## 1. Objectif et contraintes

La trajectoire transforme progressivement l’implémentation RC1 sans réécriture globale, sans double source de vérité durable et sans imposer les composants optionnels du synoptique. Chaque phase doit pouvoir être livrée indépendamment, mesurée et annulée.

À tout instant, l’**autorité runtime** est le chemin effectivement basculé et validé : initialement `server.js` + `app.js` + `data/planify.json`. La cible v1 n’est qu’une direction. Une SPEC de lot approuvée autorise la migration ; après intégration et gates, le nouveau module/repository devient autorité uniquement sur son périmètre. Les autres périmètres restent sous autorité RC1. Un adaptateur de compatibilité ne devient jamais une seconde source de vérité.

Contraintes constantes :

- préserver les parcours Gate 01 et les contrats `/api/v1` tant qu’une version de remplacement n’est pas acceptée ;
- conserver le runtime local, autonome et hors ligne ;
- aucun changement de stack, persistance ou modèle sans spécification et rollback approuvés ;
- protéger les données existantes par sauvegarde, validation et répétabilité ;
- réutiliser les invariants serveur pour toutes les interfaces et intégrations ;
- passer tous les gates sur le même candidat avant release.

La cible introduit deux règles qui ne sont pas encore garanties par toutes les données RC1 : le module 04 est l’unique owner Client/Projet et `projectId` devient obligatoire pour toute réservation active. La compatibilité ne consiste donc pas à conserver indéfiniment les valeurs nulles : elles sont normalisées avant le handoff Planning selon la séquence ci-dessous.

## 2. Méthode de migration

La stratégie combine quatre techniques :

1. **Seams internes** : extraire contrats, domaine et repositories derrière les routes actuelles sans changer l’API.
2. **Strangler applicatif** : router un cas d’usage à la fois vers le nouveau module, avec adaptateur v1.
3. **Expand/contract données** : ajouter le nouveau schéma, copier et valider, basculer les écritures de façon contrôlée, puis retirer l’ancien format après fenêtre de rollback.
4. **Projections par événements** : dashboard, recherche, reporting et intégrations consomment des faits après commit, sans devenir autorités transactionnelles.

Une double écriture n’est admise que dans un lot transitoire court, avec un writer désigné, idempotence et test de divergence. La préférence est : gel d’écriture bref ou journal de changements + import vérifié, puis bascule atomique de configuration.

## 3. Séquence des phases

### Phase 0 — Baseline et décisions de migration

**But :** figer une référence fiable avant changement structurel.

Inclus : inventaire API/données/UI, caractérisation des invariants et erreurs, fixtures déterministes, métriques performance, sauvegarde/restauration JSON, matrice de permissions et scénario E2E Gate 01. La cible est documentée, mais aucun composant n’est remplacé.

Dépendances : aucune.  
Rollback : aucun changement runtime.  
Gate de sortie : SPEC approuvée pour la phase 1 ; `npm test` vert ; smoke local ; export/import JSON vérifié ; baseline latence et volume archivée ; divergences RC1/cible listées.

### Phase 1 — Frontières modulaires dans le monolithe actuel

**But :** rendre le code extractible avant de changer de stack ou de base.

Ordre obligatoire :

1. catalogue partagé des erreurs/DTO et contexte de requête ;
2. ports `clock`, identifiants, transaction, repository et événements ;
3. module 01 Organisation/auth, avec `companyId` canonique ;
4. module 02 Ressources, après publication du contexte Organisation ;
5. module 04 Clients/projets, owner unique des deux référentiels ;
6. module 03 Planning, seulement après publication des ports 02 et 04 et normalisation des `projectId` ;
7. module 10 Dashboard RC1 et audit en consommateurs de contrats ; l’incrément 10a Analytics vient après les projections durables.

Les routes `/api/v1`, le SSE et le JSON restent en place. Les adaptateurs actuels appellent les nouveaux cas d’usage ; les repositories JSON implémentent les ports. Aucune dépendance npm n’est nécessaire par principe.

Dépendances : phase 0.  
Rollback : routage vers les handlers RC1 conservé lot par lot jusqu’à validation ; aucun changement de format de données.  
Gate de sortie : tests de contrat v1 ; parité fonctionnelle ; aucune lecture intermodule directe ; permissions et tenant testés négativement ; p95 sans régression significative ; E2E Gate 01 vert.

Matrice RBAC canonique à figer dans les tests avant migration Planning :

| Situation | Permission exacte | Admin | Planificateur | Lecteur | Audit exact |
|---|---|---:|---:|---:|---|
| capacité dépassée ou conflit entre réservations | `planning.override_conflict` | Oui | Oui | Non | `reservation.conflict.overridden` |
| calendrier d’indisponibilité d’une ressource | `planning.override_unavailability` | Oui | Non | Non | `reservation.unavailability.overridden` |

Si les deux situations existent, les deux permissions et les deux motifs sont requis. Les tests négatifs démontrent qu’aucune permission ne permet l’autre override.

### Phase 2 — Persistance relationnelle locale

**But :** remplacer JSON par SQLite sans modifier les comportements publics.

Pré-requis SPEC : schéma, contraintes, moteur/driver retenu, migrations, seed, verrouillage, sauvegarde, rollback et politique de compatibilité Node hors ligne. Les changements suivent :

1. migrations additives et repositories SQLite derrière les ports ;
2. outil déterministe JSON → SQLite, sans modifier la source ;
3. rapport de comptage, checksums/canoniques et contrôle des références ;
4. répétition sur copie et tests d’échec/interruption ;
5. fenêtre de bascule avec sauvegarde JSON, arrêt des écritures, import final, validation, activation du writer SQLite ;
6. conservation en lecture seule du snapshot JSON pendant la fenêtre de rollback ;
7. suppression différée de l’adaptateur JSON après acceptation.

#### Chaîne normative des migrations après le schéma v2 Stock

Le **schéma v2 Stock** est l’unique point d’entrée accepté : sa version et son intégrité sont vérifiées avant toute réécriture. La chaîne est atomiquement ordonnée ; une migration refuse toute version d’entrée différente et publie exactement la version de sortie annoncée :

| Ordre | Migration | Entrée → sortie | Effet et condition de sortie |
|---|---|---|---|
| 1 | **`foundation-01-organization-v2-to-v3`** | **v2 → v3** | `companyId` canonique, sites/utilisateurs/rôles résolus, aucune référence Organisation orpheline |
| 2 | **`foundation-01b-organization-fiscal-v3`** | **v3 → v3, marker additif** | profils/taux/policies fiscaux et monétaires ajoutés, `CompanyFiscalProfilePort.v1` publiable, marker/digest/comptages inscrits sans changer `schemaVersion` |
| 3 | **`foundation-02-resources-v3-to-v4`** | **v3 → v4** | exige les deux markers Organisation ; `resourceId` et références `companyId`/`siteId` résolus, références Stock validées, `ResourceCatalogPort.v1` publiable |
| 4 | **`foundation-04-projects-v4-to-v5`** | **v4 → v5** | Clients puis Projets migrés sous l’owner unique 04 ; Client technique par `companyId` et Projet technique de reprise par `companyId`/`siteId` créés et audités |
| 5 | **`foundation-03-planning-v5-to-v6`** | **v5 → v6** | réservations/allocations résolues, reprise des `projectId` absents terminée, contrainte `projectId` obligatoire activée |

Il est interdit de sauter, réordonner ou fusionner **`foundation-01-organization-v2-to-v3` → `foundation-01b-organization-fiscal-v3` → `foundation-02-resources-v3-to-v4` → `foundation-04-projects-v4-to-v5` → `foundation-03-planning-v5-to-v6`**. Les quatre identifiants historiques ne sont ni renommés ni réinterprétés ; le marker 01b est additif, immuable et ne possède pas d’alias court. Chaque étape produit une table de correspondance ancien → nouvel identifiant lorsque des identifiants changent, ainsi que digest, comptages, contrôles de références et handoff signé. Une étape ne démarre pas si le handoff précédent révèle une référence orpheline, une divergence, un marker absent/désordonné ou une version inattendue.

Canoniques que toute SPEC de cette chaîne recopie à l’identique :

- identifiant d’Organisation : `companyId` dans DTO/API/événements et `company_id` en persistance ; `organizationId` est rejeté en `400 VALIDATION_ERROR` avec `details: { "field": "organizationId", "reason": "FIELD_NOT_ALLOWED" }` ;
- Client technique : champs exacts `id`, `companyId`, `name`, `code`, `active`, `systemManaged`, `migrationPurpose`, `version`, `createdAt`, `updatedAt`, avec `name: "Reprise RC1"`, `code: "MIGRATION-RC1"`, `active: true`, `systemManaged: true`, `migrationPurpose: "rc1_project_backfill"` ;
- Projet technique : champs exacts `id`, `companyId`, `siteId`, `clientId`, `name`, `code`, `status`, `color`, `systemManaged`, `migrationPurpose`, `version`, `createdAt`, `updatedAt`, avec `name: "Reprise RC1 — <siteId>"`, `code: "MIGRATION-RC1-<siteId>"`, `status: "active"`, `color: "#64748B"`, `systemManaged: true`, `migrationPurpose: "rc1_project_backfill"` ;
- audits : `client.recovery.created`, `project.recovery.created`, `reservation.project.backfilled` ; événements : `client.recovery.created.v1`, `project.recovery.created.v1`, `reservation.project.backfilled.v1` ;
- rattachement : `migrationId: "foundation-03-planning-v5-to-v6"`, `companyId`, `siteId`, `reservationId`, `previousProjectId: null`, `projectId` ; aucun `legacyUnassigned` ;
- permissions : `planning.override_conflict` pour capacité/conflit de réservation et `planning.override_unavailability` pour calendrier indisponible ; elles ne sont ni alias ni substituts.

#### Marker additif `foundation-01b-organization-fiscal-v3`

Préconditions : `schemaVersion=3`, marker/digest conforme de `foundation-01-organization-v2-to-v3`, marker 01b absent, aucun marker Ressources ou aval, writer applicatif arrêté et snapshot v3 immuable/restaurable.

Le writer 01b ajoute atomiquement les profils fiscaux/monétaires, `vatRates` et policies fiscales/ISO 4217 versionnées sans modifier les identifiants ni collections existants. Il initialise les versions et ne convertit une ancienne donnée que si la policy la valide ; tout rejet est compté comme anomalie, jamais promu silencieusement. Chaque profil effectivement converti écrit l’audit masqué `company.fiscalProfile.migrated` avec `migrationId: "foundation-01b-organization-fiscal-v3"`. Il inscrit une seule fois dans `migrations[]` l’identifiant littéral `foundation-01b-organization-fiscal-v3`, le digest source/sortie, les versions de policy et les comptages profils/identifiants/taux/rejets. `schemaVersion` reste strictement `3`.

Déterminisme de migration : même snapshot source v3 + mêmes policies versionnées produit les mêmes données métier, comptages et anomalies. Les identifiants générés dérivent de clés métier stables ; l’horodatage technique n’entre pas dans le digest métier. Marker présent avec digest/policies/comptages conformes retourne sans écriture, audit ni événement ; toute divergence bloque. Le migrateur hors ligne n’émet pas de SSE.

Rollback : avant tout marker aval, arrêter le writer, restaurer le snapshot v3 et vérifier son digest ; le marker et les ajouts fiscaux disparaissent ensemble. Après démarrage de Ressources ou consommation commerciale, le rollback est bloqué jusqu’à inversion validée ; toute perte éventuelle exige l’autorisation explicite du PO selon la règle générale.

Handoff fiscal : Organisation 01 publie `CompanyFiscalProfilePort.v1`; Commercial 08, owner/writer exclusif des Devis, appelle `snapshotForQuote({ companyId, siteId?, taxDate, requestedVatRateId? }, authContext)`. Le `CompanyFiscalSnapshot` exact est celui de `docs/target-architecture-v1.md`, section 4.4. Résumé déterministe : adresse légale validée, identifiants requis dans l’ordre `businessRegistration`, `establishment`, `vat`, `taxNumber`, `other`, taux applicable à `taxDate` dans le fuseau résolu, snapshot complet immuable à la création/révision. Seul `capturedAt` dépend de l’horloge serveur. Finance 09a reste non fiscal : coûts/revenus/marges seulement, sans ownership du taux ni du snapshot.

#### `foundation-03-planning-v5-to-v6` — reprise normative des Projets

Préconditions : schéma v5 validé ; writer applicatif arrêté ; snapshot v5 restaurable ; Client technique `MIGRATION-RC1` et Projet technique `MIGRATION-RC1-<siteId>` présents pour chaque couple `companyId`/`siteId` concerné avec les DTO exacts de `docs/target-architecture-v1.md` ; aucun doublon de code ou de périmètre.

`foundation-03-planning-v5-to-v6` exécute, dans une transaction :

1. inventorier toutes les réservations avec `projectId` absent, y compris annulées afin de préserver leur historique ;
2. vérifier pour chacune `companyId`, `siteId`, ressources et références ; une ambiguïté ou un périmètre absent bloque toute la migration ;
3. associer exclusivement le Projet technique dont `companyId` et `siteId` correspondent à la réservation ;
4. enregistrer dans le journal de migration l’ancien `projectId: null`, le nouveau `projectId`, la version initiale de la réservation et l’identifiant `foundation-03-planning-v5-to-v6` ;
5. écrire l’audit append-only `reservation.project.backfilled` pour chaque rattachement ;
6. vérifier que zéro réservation ne conserve un `projectId` nul ou invalide et que les comptes avant/après concordent ;
7. activer la contrainte non nulle/FK de `projectId`, incrémenter le schéma en v6 et seulement alors publier le handoff au writer 03.

Décision unique : aucun choix manuel, Projet générique global, conservation de `null`, champ `legacyUnassigned`, pseudo-ID ou fallback silencieux n’est permis. Après v6, toute réservation référence un Projet 04 réel. L’adaptateur `/api/v1` peut seulement matérialiser une omission en `projectId` technique explicite du même site pendant sa dépréciation ; il renvoie cette valeur canonique.

Rollback de **`foundation-03-planning-v5-to-v6`**, v6→v5 :

1. arrêter le writer 03 et prendre un snapshot v6 ;
2. vérifier dans le journal chaque ligne touchée par `foundation-03-planning-v5-to-v6` et comparer `projectId`/version courants ;
3. si aucune ligne n’a changé depuis la migration, retirer la contrainte v6, restaurer `projectId: null` uniquement pour ces lignes, écrire un audit compensatoire, puis marquer le schéma v5 ;
4. ne pas supprimer le Client/les Projets techniques : leur suppression appartient au rollback de `foundation-04-projects-v4-to-v5`, v5→v4, après preuve qu’aucune référence ne subsiste ;
5. si une réservation reprise a été réaffectée, modifiée ou créée après cutover, ne jamais écraser son état. Produire l’export inverse et le rapport de conflits ; sans inversion complète et sans perte, le rollback reste bloqué ;
6. si le seul retour possible entraîne une perte, obtenir l’autorisation explicite du PO identifiant exactement les réservations et mutations perdues avant toute action.

Le rollback restaure une version cohérente complète ; l’application ne démarre jamais sur une combinaison v5/v6 partielle.

#### Writers et handoffs de bascule

| Étape | Writer unique | Lecteurs de compatibilité | Condition de handoff |
|---|---|---|---|
| Avant cutover | repositories JSON RC1 | UI/API RC1 | snapshot restaurable, mutations arrêtées, schéma v2 Stock validé |
| `foundation-01-organization-v2-to-v3` | migrateur du même identifiant | aucun chemin de production | `companyId`/sites/utilisateurs complets, correspondances et isolation vérifiées |
| `foundation-01b-organization-fiscal-v3` | migrateur fiscal 01b | aucun chemin de production | `schemaVersion=3`, marker/digest/comptages conformes, `CompanyFiscalProfilePort.v1` publiable |
| `foundation-02-resources-v3-to-v4` | migrateur du même identifiant | aucun chemin de production | Ressources résolues sous 01, port v1 et références Stock validés |
| `foundation-04-projects-v4-to-v5` | migrateur du même identifiant | aucun chemin de production | Clients/Projets complets, owner unique 04, Projet technique par `companyId`/`siteId` |
| `foundation-03-planning-v5-to-v6` | migrateur du même identifiant | aucun chemin de production | toutes réservations rattachées à 01/02/04, aucune sans Projet, audit de reprise complet |
| Après cutover | repositories SQLite modulaires 01/02/04/03 | adaptateurs `/api/v1` en lecture/commande, jamais writers | E2E, cohérence, performance, sauvegarde et rollback approuvés |

Le writer n’est transféré qu’une fois par périmètre, par configuration explicite après handoff. Le migrateur ne reçoit aucune requête utilisateur ; l’adaptateur v1 appelle le nouveau writer après cutover et ne double-écrit jamais.

Dépendances : phase 1 et décision de driver.  
Rollback : arrêter l’application, restaurer le snapshot JSON pris avant bascule et réactiver l’adaptateur JSON. Toute écriture post-bascule empêche un rollback aveugle : un export inverse complet et validé est obligatoire. Si celui-ci est impossible ou incomplet, le rollback est bloqué jusqu’à une **autorisation explicite du PO acceptant précisément la perte identifiée** ; aucun agent technique ne peut accepter cette perte par défaut.  
Gate de sortie : migrations aller répétables sur base neuve et existante ; import sans perte ; contraintes tenant/site/version/capacité validées ; atomicité multi-ressources + audit ; restauration testée ; 100 ressources/10 000 réservations dans les budgets ; suite complète et E2E avec redémarrage.

### Phase 3 — Outbox, projections et services transverses locaux

**But :** découpler les lectures dérivées et préparer notifications/intégrations sans infrastructure distribuée.

Ordre : outbox transactionnelle ; dispatcher/worker local idempotent ; invalidations SSE depuis événements commités ; projection d’occupation du module 10 ; audit append-only ; recherche SQL bornée ; exports locaux ; inbox de notifications. Les fichiers éventuels restent dans un stockage local non statique derrière un port.

Dépendances : phase 2 pour outbox transactionnelle robuste.  
Rollback : désactiver les consommateurs et reconstruire les projections depuis les données transactionnelles/outbox ; les commandes cœur restent opérationnelles.  
Gate de sortie : aucun événement avant commit ; redelivery/rejeu/ordre testés ; lag et erreurs observables ; reconstruction déterministe ; SSE < 3 s local ; aucune fuite tenant dans projections, exports ou recherche.

### Phase 4 — Frontend modulaire et contrats typés

**But :** isoler le shell, le client API et les surfaces métier sans interrompre l’UI livrée.

La migration TypeScript/React/Vite est une décision distincte. Si approuvée, elle utilise un montage par route/écran : shell et design system locaux, client API généré/partagé, puis Planning, Dashboard, Ressources, Projets et Administration. L’ancien écran reste disponible derrière un flag local jusqu’à parité. Si la migration de stack n’est pas approuvée, la même modularisation s’applique en JavaScript/CommonJS.

Dépendances : contrats stabilisés phase 1 ; projections phase 3 utiles mais non obligatoires.  
Rollback : désactiver le flag de la nouvelle surface ; contrats API inchangés.  
Gate de sortie : parité des parcours E2E, clavier/focus/contraste, erreurs et concurrence, test sans réseau/CDN, budget de chargement et interaction, aucun fallback fail-open.

### Phase 5 — Extension métier contrôlée

**But :** livrer les modules 05–09 par chaînes de valeur, pas tous simultanément, et positionner le premier lot Finance `0.2` comme **09a**.

Ordre indicatif et dépendances :

1. **05 Équipes** après modèle RH/compétences approuvé ; alimente Planning et capacité.
2. **07a Socle stock** : articles, emplacements, quantités, mouvements atomiques et audit. Il précède Location afin de rester l’unique autorité de l’état physique.
3. **06a Location matériel** après stabilisation Ressources + Planning et après 07a ; réserve, sort et retourne les articles du stock via contrat. Elle ne tient aucun inventaire parallèle.
4. **07 Stock/logistique avancé** : kits, transferts, inventaires et codes-barres/QR. Ce slice peut suivre 06a car Location ne dépend que du socle 07a.
5. **08 Commercial/options et Devis** après décision sur expiration/priorité des options ; crée une intention de projet/planning via contrats et devient owner/writer exclusif du Devis et de son `CompanyFiscalSnapshot`, obtenu via `CompanyFiscalProfilePort.v1`.
6. **09a Finance 0.2 non fiscal** après modèles minimaux de coûts/revenus et séparation des droits ; fournit marge opérationnelle et exports, sans écrire dans Projets/Location, choisir un taux, calculer la fiscalité du Devis ni posséder son snapshot. Facturation, paiements et comptabilité complète restent des incréments 09 ultérieurs.

Chaque module est un lot produit séparé avec SPEC, migrations additives, permissions, audit, tests et E2E. Aucun module futur n’est simulé par un fallback dans le cœur.

Rollback : flag de capacité + désactivation des nouvelles commandes ; migrations expand/contract ; conservation des enregistrements sans suppression destructive.  
Gate de sortie par module : critères produit acceptés, contrats publiés, isolation tenant, sécurité des données, performance représentative et parcours E2E propres au module.

### Phase 6 — 10a Analytics, prévision, reporting et assistant

**But :** positionner **10a Analytics** puis développer 11, 12 et 14 sur des données fiables et gouvernées.

**10a Analytics** étend le dashboard RC1 par des projections d’occupation, d’activité et, selon permission, de coûts/revenus issus de 09a. Ces projections restent des modèles de lecture reconstruisibles ; 03 Planning et 09 Finance restent autorités transactionnelles. Le reporting (14) commence sur les projections locales et exports. La prévision (11) exige historique, qualité de données, scénarios versionnés et explications. L’assistant (12) commence par recherche/lecture locale avec actions en mode proposition ; toute mutation repasse par une commande autorisée et demande confirmation selon le risque.

Un warehouse n’est ajouté qu’après mesure de charge analytique et définition de rétention. Une IA externe exige une SPEC données/sécurité, un mode opt-in et un fonctionnement cœur sans fournisseur.

Dépendances : phase 3 ; données suffisantes issues des phases 5 selon cas.  
Rollback : désactiver projection/modèle/assistant ; aucun effet sur les sources transactionnelles.  
Gate de sortie : exactitude/reproductibilité, provenance, permissions de niveau ligne, absence de décision automatique non autorisée, budgets coût/latence et revue sécurité/confidentialité.

### Phase 7 — Intégrations externes et notifications multicanales

**But :** ouvrir le module 15 et les canaux du 13 sans coupler le cœur à un tiers.

Progression : API REST publique documentée ; imports/exports validés ; webhooks signés ; un connecteur pilote ; connecteurs suivants sur le même cadre. Les canaux email/SMS/Teams/Slack restent adaptateurs optionnels ; l’inbox locale constitue le mode dégradé.

Dépendances : outbox phase 3, contrat du module source, gestion des secrets et décision fournisseur.  
Rollback : couper le connecteur/canal ; conserver les jobs en erreur et permettre un rejeu contrôlé ; le cœur continue localement.  
Gate de sortie : idempotence, signature/rejeu, quotas/timeouts/retry/circuit breaker, rotation des secrets, mapping versionné, tests sandboxés et aucune exfiltration inter-tenant.

### Phase 8 — Scalabilité et haute disponibilité, si déclenchées

**But :** rendre l’application multi-instance seulement quand les mesures l’exigent.

Séquence obligatoire : PostgreSQL et stratégie de concurrence ; sessions partagées ; outbox/bus durable ; objets partagés ; workers idempotents ; migrations rolling ; load balancer ; tests de panne ; sauvegardes/restauration ; orchestration et auto-scaling en dernier.

Dépendances : SLO/RPO/RTO décidés, charge ou disponibilité mesurée, capacité opérationnelle.  
Rollback : déploiement canary/blue-green, compatibilité N/N-1, migrations expand/contract, restauration et retour mono-instance documentés.  
Gate de sortie : tests de bascule/panne, absence de double traitement, cohérence tenant, objectifs p95/SLO atteints et exercices de restauration conformes.

## 4. Carte des dépendances

```text
Phase 0 Baseline
   └─ Phase 1 Frontières modulaires
       ├─ Phase 2 SQLite
       │   └─ Phase 3 Outbox/projections/services transverses
       │       ├─ Phase 6 10a Analytics/prévision/reporting/assistant
       │       └─ Phase 7 Intégrations/notifications externes
       ├─ Phase 4 Frontend modulaire
       └─ Phase 5 Extensions métier (05 ; 07a → 06a → 07 avancé ; 08 → 09a)

Phase 8 Multi-instance/HA dépend de 2 + 3 + SLO/RPO/RTO mesurés
```

Les phases 4 et 5 peuvent progresser par lots après stabilisation de leurs contrats ; elles ne doivent pas retarder la consolidation des données. Les phases 6–8 restent conditionnelles.

## 5. Gate standard de chaque lot

| Gate | Preuve minimale attendue |
|---|---|
| SPEC | inclus/exclus, critères testables, API/données/UI/sécurité/performance, compatibilité, migration et rollback |
| DEV | ownership déclaré, diff ciblé, tests positifs/négatifs, syntaxe valide, aucun secret/artefact |
| REVIEW | revue indépendante du diff et consommateurs, aucun P0/P1, rapport rattaché à l’état testé |
| QA | tests ciblés puis `npm test`, commande/date/Node/résultat, zéro échec |
| SECURITY | auth/CSRF/RBAC/tenant/XSS/statique/secrets/abus/dépendances, aucun critique/élevé |
| PERFORMANCE | mesure des chemins affectés ; planning 100/10 000 et budgets p95 si concerné |
| INTEGRATION | frontend/API/persistance/SSE, données existantes, démarrage local, aucun réseau requis |
| E2E | parcours UI concernés, permissions, erreur/concurrence, persistance après reload/redémarrage |
| RELEASE | même candidat pour tous les gates, version/changelog/demo/rollback/statut exacts |

Une phase structurelle ne peut pas s’appuyer sur les rapports `APPROVED` de la RC1 : elle doit produire des preuves fraîches. L’auteur du lot ne rend pas seul le verdict indépendant.

## 6. Contrôles de bascule des données

Avant toute bascule JSON → SQLite ou SQLite → PostgreSQL :

1. identifier le writer unique de chaque périmètre et bloquer les mutations concurrentes pendant le cutover ;
2. sauvegarder la source et tester sa restauration ;
3. exécuter la migration sur une copie avec journaux sans données sensibles ;
4. comparer nombres d’entités, identifiants, relations, versions, instants et agrégats métier ;
5. tester réservations adjacentes, conflits, annulations, overrides et isolation ;
6. exécuter la suite et l’E2E sur la cible ;
7. basculer par configuration explicite ;
8. surveiller erreurs, latence et divergences ;
9. conserver la source en lecture seule durant la fenêtre de retour ;
10. transférer le writer au nouveau repository seulement après les handoffs `foundation-01-organization-v2-to-v3` → `foundation-01b-organization-fiscal-v3` → `foundation-02-resources-v3-to-v4` → `foundation-04-projects-v4-to-v5` → `foundation-03-planning-v5-to-v6` complets ;
11. retirer l’ancien chemin uniquement après approbation release.

Une conversion silencieuse au démarrage est interdite. Une migration échouée laisse la source intacte et n’ouvre pas l’application en mode partiellement migré. Tout rollback susceptible de perdre une mutation confirmée requiert l’autorisation explicite du PO après chiffrage et identification des données concernées.

## 7. Décisions à obtenir au fil de la trajectoire

| Moment | Décision | Recommandation par défaut |
|---|---|---|
| Avant phase 2 | driver SQLite, politique de sauvegarde et durée de rollback | solution native Node maintenue et testable hors ligne ; snapshot avant bascule |
| Avant phase 4 | migration TypeScript/React ou modularisation JS | ne migrer la stack qu’après contrats stabilisés et prototype de parité |
| Avant module 05 | données RH, compétences, contrats et confidentialité | minimiser les données personnelles et séparer les permissions |
| Avant 07a/06a | modèle articles/emplacements/mouvements, puis règles de location | Stock est autorité physique ; Location ne gère que son cycle métier |
| Avant 08/09a | règles d’option, coûts/revenus et périmètre Finance 0.2 | limiter 09a à marge opérationnelle/exports ; différer facturation et paiements |
| Avant 10a | KPI, fraîcheur des projections et droits sur données financières | projections reconstruisibles, sources 03/09a seules autorités |
| Avant phases 6–7 | rétention, consentement, fournisseurs, secrets et budgets | local/opt-in, cœur utilisable sans tiers |
| Avant phase 8 | SLO, RPO/RTO, charge, région, budget et astreinte | conserver mono-instance tant que les déclencheurs ne sont pas atteints |

Ces décisions sont volontairement différées : le synoptique fixe les capacités attendues, pas leurs fournisseurs ni leur date de distribution.

## 8. Indicateurs de progression utiles

La progression ne se mesure pas au nombre de technologies ajoutées. Les indicateurs suivis par lot sont :

- pourcentage d’endpoints v1 couverts par tests de contrat et par cas d’usage modulaire ;
- zéro accès direct aux données privées d’un autre module ;
- taux de réussite migration/restauration sur jeux déterministes ;
- divergence de données nulle après bascule ;
- p95 lecture planning et écriture/conflit ;
- délai d’invalidation/projection, backlog et taux de rejeu ;
- couverture de la matrice rôles × actions × périmètres ;
- nombre de P0/P1 et vulnérabilités critiques/élevées ouverts ;
- disponibilité du mode local sans réseau ni connecteur.

## 9. Prochain lot recommandé

Le prochain lot sûr est **Phase 0 puis premier seam de Phase 1** : caractériser les contrats actuels et introduire, sans modifier l’API ni le JSON, le contexte `companyId`, puis les cas d’usage dans l’ordre 01 Organisation → 02 Ressources → 04 Clients/Projets → 03 Planning. Ce lot réduit le risque des migrations suivantes et permet de vérifier la cible sur le cœur métier avant toute nouvelle dépendance.

Il doit faire l’objet d’une SPEC approuvée distincte précisant les fichiers, tests, compatibilité et rollback. Ce document n’autorise pas à démarrer automatiquement la migration.
