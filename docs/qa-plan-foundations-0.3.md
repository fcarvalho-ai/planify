# Plan QA — Fondations 0.3

Date de préparation : 2026-08-14  
Version cible : `0.3.0-alpha`  
Statut : plan de gate, exécution requise sur le même candidat avant verdict  
Références : `AGENTS.md`, `docs/spec-organization-01.md`, `docs/spec-resources-02.md`, `docs/spec-project-planning-sequence.md`, `docs/spec-mvp.md`, `docs/architecture.md`

## 1. Objectif et périmètre

Ce gate vérifie que les fondations 0.3 imposent, côté serveur comme dans l'interface, la séquence suivante :

```text
Organisation O1 → O2 → O3
  → site + service
  → ressources actives
  → client + projet/émission planifiable
  → série et cellules de planning
```

Sont inclus : multi-tenant et onboarding O1–O3, sites et services, salles/RH/équipements sérialisés, projet obligatoire, cellules jour/semaine/mois, déplacements, migration v2→v3, RBAC, isolation, sécurité, performance et parcours E2E. Le runtime CommonJS/JSON local reste la référence tant qu'une migration de stack n'est pas approuvée.

Sont exclus : facturation, workflow éditorial saison/épisode, réservation inter-sites dans une série, récurrence infinie, allocation automatique d'un numéro de série, migration TypeScript/React/SQLite.

## 2. Principes d'exécution et preuves

- Exécuter les tests ciblés, puis `npm test`, sur un fichier de données temporaire neuf et sur une copie v2 déterministe.
- Utiliser Node.js `>=20`, sans réseau, CDN ou SaaS. Consigner OS, version Node, commit ou empreinte du candidat, date, commandes exactes et fichier de fixture.
- Réinitialiser les données entre scénarios indépendants ; réserver les scénarios de concurrence à des workers partageant explicitement le même état.
- Vérifier après chaque mutation : réponse canonique, persistance après redémarrage, audit, version et SSE après commit. Vérifier après chaque refus : aucune écriture, aucun audit de succès et aucun SSE de succès.
- Les erreurs doivent respecter `{ error: { code, message, details?, requestId } }` et ne pas révéler l'existence d'un autre tenant.
- Les mesures de performance publient volumes, échauffement, itérations, p50, p95, maximum et configuration locale.
- Toute preuve manuelle E2E indique attendu, observé et capture ou journal expurgé. Aucun secret, cookie, jeton, donnée juridique, contact ou donnée RH sensible dans les artefacts.

## 3. Fixtures déterministes

### 3.1 Organisations, utilisateurs et périmètres

| Fixture | État et contenu | Usage |
|---|---|---|
| `org_eliote_props` | O1/O2/O3 complets, `active`, Paris + Boulogne | tenant principal |
| `org_eliote_location` | O1 complet, O2 incomplet, `draft` | blocage onboarding |
| `org_fav_location` | O1/O2 complets, O3 incomplet, `draft` | couverture de responsabilité |
| `org_hostile` | active, données aux identifiants connus mais sans membership partagé | tests IDOR/isolation |
| `admin_multi` | admin explicite sur les trois organisations, scopes globaux | changement de contexte |
| `admin_paris` | admin de `org_eliote_props`, scope Paris | gestion limitée au site |
| `planner_paris` | lecture ressources/maintenance et planification Paris | RBAC métier |
| `viewer_paris` | lecture seule Paris | refus de mutation |
| `viewer_hostile` | lecture seule de `org_hostile` | fuite inter-tenant |
| `user_no_site` | membership actif, liste de sites vide | doit n'accéder à aucun site |

Les identités O1 couvrent raison sociale, nom d'affichage, identifiant légal non secret, fuseau IANA, locale, devise, adresse et contact valides. Préparer des variantes avec chaque champ requis absent, format invalide et chaînes aux bornes.

### 3.2 Sites, services et offres

- Paris actif, fuseau `Europe/Paris`, services Post-production et Laboratoire actifs.
- Boulogne actif, Post-production actif, aucun Laboratoire.
- Lyon suspendu et un site d'`org_hostile` portant volontairement les mêmes noms/codes.
- Unités organisationnelles : racine, enfant, profondeur maximale autorisée, tentative de cycle et tentative de parent inter-tenant.
- Offres Post-production : montage, étalonnage, mixage, PAD ; variante `nonApplicable` avec motif ; offre Laboratoire quand l'activité le requiert.
- Memberships assurant puis n'assurant plus la présence d'un admin actif et la couverture de responsabilité de chaque site.

### 3.3 Ressources, Parc et volume

- 125 salles de montage distinctes sur Paris, codes `EDIT-001` à `EDIT-125`, noms normalisés, capacité 1 ; au moins une salle de chaque type étalonnage, mixage, PAD, laboratoire et un type futur configurable.
- Une salle `draft`, une `inactive`, une en maintenance, une avec réservation future et une salle active à Boulogne.
- Ressources humaines : une personne Paris, une multi-site dans la même organisation et une fixture contenant des champs RH interdits.
- 2 000 exemplaires matériels sérialisés : disponibles, affectés, maintenance, quarantaine et sortis ; deux numéros de série similaires et un exemplaire de l'autre tenant.
- Affectations : rôle requis et optionnel, 1 500 périodes historiques, une tentative de chevauchement et une concurrence sur le même exemplaire.
- Jeu de charge complet : 3 organisations, 10 sites, 25 services, 500 ressources, dont au moins 120 salles sur un site, 2 000 exemplaires, 1 500 affectations historiques et 10 000 réservations.

### 3.4 Clients, projets et planning

- Client actif Paris, client inactif, client Boulogne et client de l'autre tenant.
- Projet `EMI-001` actif/`ready` à Paris ; brouillon incomplet ; projet `on_hold` ; projet archivé ; projet Boulogne ; doublon de référence à casse/espaces différents ; même référence dans l'autre tenant.
- Séries `option`, `confirmed`, `cancelled` et cellules adjacentes, chevauchantes et concurrentes.
- Dates civiles : jour ordinaire, 2028-02-29, semaine lundi–dimanche, mois de 28/29/30/31 jours, passage heure d'été `2027-03-28` et heure d'hiver `2027-10-31` en `Europe/Paris`.
- Bornes : 366 jours/500 cellules acceptables, puis 367 jours et 501 cellules refusés.

### 3.5 Données v2 de migration

Préparer séparément : données v2 vierges, seed v2 valide, v2 partiellement incomplet, références projet en collision, réservation sans projet, réservation intra-journée, réservation couvrant exactement des jours civils, réservation multi-ressources sans salle, réservation avec salle + ressources complémentaires, stock déjà alloué et fichier tronqué/invalide. Chaque fixture possède un manifeste avant migration : IDs, nombres par collection, sommes de capacités/quantités, statuts, versions, liens et empreinte du fichier.

## 4. Matrice Organisation et onboarding O1–O3

| ID | Cas | Attendu |
|---|---|---|
| ORG-01 | Créer O1 avec tous les champs valides | brouillon persisté, identité canonique, audit, version 1 |
| ORG-02 | Omettre successivement chaque champ O1 ou fournir fuseau/format invalide | `422`, détail borné, aucune progression O2 |
| ORG-03 | Rejouer la création avec même clé/corps puis clé/corps différent | même résultat ; conflit d'idempotence sans mutation |
| ORG-04 | Configurer site, service et offres Post-production complètes | O2 validé seulement quand toutes les dépendances sont actives |
| ORG-05 | Omettre une catégorie obligatoire sans motif `nonApplicable` | `422 ONBOARDING_INCOMPLETE`, champ manquant explicite |
| ORG-06 | Déclarer activité Laboratoire sans offre correspondante | O2 bloqué ; ajout valide débloque O2 |
| ORG-07 | Activer avec admin mais site sans responsable, puis l'inverse | O3 bloqué dans les deux cas |
| ORG-08 | O1/O2 valides + admin actif + couverture de tous les sites | transition `draft → active`, audit et SSE après commit |
| ORG-09 | Tenter une ressource/projet/planning avant O3 | `409 PREREQUISITE_NOT_MET` ou `422 ONBOARDING_INCOMPLETE`, aucune entité aval |
| ORG-10 | Transitions active/suspended/archived et tentative de sortie d'archived | seules transitions autorisées ; archive terminale |
| ORG-11 | Retirer le dernier admin ou la dernière couverture de site | refus atomique ; organisation toujours administrable |
| ORG-12 | Changer de contexte avec `admin_multi` | nouveau contexte explicite ; caches, listes et SSE revalidés |
| ORG-13 | Demander un contexte sans membership ou avec scope site vide | refus non discriminant ; scope vide signifie aucun site |
| ORG-14 | Deux requêtes concurrentes modifient la même version | une réussite, une `VERSION_CONFLICT`, aucune perte |

## 5. Sites, services et unités

| ID | Cas | Attendu |
|---|---|---|
| SITE-01 | CRUD site/service avec normalisation et unicité dans l'organisation | représentation canonique, ordre stable, version et audit |
| SITE-02 | Même code dans deux tenants | accepté sans collision inter-tenant |
| SITE-03 | Site/service de tenant A référencé depuis tenant B | refus non discriminant, aucun lien créé |
| SITE-04 | Unité enfant valide, profondeur maximale, cycle, parent inconnu/inter-tenant | hiérarchie valide acceptée ; dépassement/cycle/parent refusés atomiquement |
| SITE-05 | Service incompatible avec site ou offre inactive | rattachement/refonte aval refusé |
| SITE-06 | Suspendre/désactiver un site ou service utilisé | stratégie normative appliquée, jamais de cascade silencieuse ni perte d'historique |
| SITE-07 | Trier/paginer/rechercher sites et services homonymes | tri stable, total fiable, aucune fuite de tenant |
| SITE-08 | Accès admin Paris à une mutation Boulogne | refus de périmètre identique à un identifiant inexistant |

## 6. Ressources, salles, RH et équipements sérialisés

| ID | Cas | Attendu |
|---|---|---|
| RES-01 | Créer une ressource sans organisation/site/service complet | `ORGANIZATION_SETUP_INCOMPLETE`, aucune écriture |
| RES-02 | Créer puis retrouver 125 salles de montage | toutes distinctes, pagination `pageSize<=100`, tri `name,id`, filtres et total exacts |
| RES-03 | Codes avec casse/espaces et noms normalisés identiques dans un site/catégorie | `RESOURCE_CODE_ALREADY_EXISTS` / `RESOURCE_NAME_ALREADY_EXISTS` |
| RES-04 | Créer un type futur puis une salle de ce type | aucune dépendance à un catalogue codé en dur |
| RES-05 | Capacité 0, 1000, non entière ; schéma invalide ; >200 caractéristiques | `422`, aucune ressource partielle |
| RES-06 | Activer salle incomplète puis salle complète | `RESOURCE_ACTIVATION_INCOMPLETE` ; réussite persistante après redémarrage |
| RES-07 | Déplacer une salle historisée de site ; changer vers service compatible avec bonne/ancienne version | `RESOURCE_SITE_IMMUTABLE` ; changement audité ; `VERSION_CONFLICT` |
| RES-08 | Désactiver une salle avec réservation future | `RESOURCE_HAS_FUTURE_BOOKINGS`, aucun effet partiel |
| RES-09 | Injecter donnée RH sensible ou sites d'intervention d'un autre tenant | rejet ; aucune donnée sensible dans réponse/audit/SSE/log |
| RES-10 | Rechercher un exemplaire par référence/série puis l'affecter | données reprises du Parc, affectation + localisation + audit atomiques |
| RES-11 | Double affectation séquentielle et concurrente | une seule réussit ; autre `EQUIPMENT_ALREADY_ASSIGNED` |
| RES-12 | Exemplaire maintenance/quarantaine/sorti, autre site ou tenant | `EQUIPMENT_NOT_AVAILABLE` / `EQUIPMENT_SITE_MISMATCH`, aucun état partiel |
| RES-13 | Désaffecter sans puis avec motif | refus sans motif ; clôture, localisation et audit atomiques avec motif |
| RES-14 | Consulter historique après désaffectation/réaffectation et redémarrage | périodes non chevauchantes, acteurs/motifs conservés et immuables |
| RES-15 | Maintenance salle, équipement requis puis optionnel | salle indisponible ; requis bloquant ; optionnel dégradé avec motif |
| RES-16 | Salle draft/inactive et réservation option/confirmed/cancelled | non sélectionnable ; actifs consomment ; annulation libère |
| RES-17 | Mutation groupée de 20 puis 21 équipements | 20 accepté atomiquement ; 21 refusé sans écriture |
| RES-18 | Rejeu même clé/corps puis même clé/corps différent | même résultat canonique ; conflit de payload sans fuite d'acteur/site |

## 7. Projet obligatoire et readiness

| ID | Cas | Attendu |
|---|---|---|
| PROJ-01 | Créer sans référence/client/site/champ requis | brouillon possible selon contrat, validation planning `PROJECT_NOT_READY` |
| PROJ-02 | Références équivalentes par casse/espaces dans une organisation | `PROJECT_REFERENCE_EXISTS` sans renommage implicite |
| PROJ-03 | Même référence dans deux organisations | acceptée et strictement isolée |
| PROJ-04 | Passer un projet complet de `draft` à `ready` | transition explicite, version, audit, SSE post-commit |
| PROJ-05 | Planifier sans `projectId`, avec projet inexistant, autre tenant/site, draft/on_hold/archived | `PROJECT_REQUIRED`, refus non discriminant, ou `PROJECT_NOT_READY` selon le cas |
| PROJ-06 | Projet prêt, actif, même organisation et site | validation réussie et résumé non ambigu |
| PROJ-07 | Rendre draft/pause/archive avec réservations actives futures | refus sans opération admin, motif et stratégie explicites |
| PROJ-08 | Ancienne réservation sans projet issue de migration | lisible/annulable ; déplacer, redimensionner, confirmer ou dupliquer refusé avec `PROJECT_REQUIRED` |

## 8. Planning : cellules, périodes et déplacements

| ID | Cas | Attendu |
|---|---|---|
| PLN-01 | Jour unique × une salle | exactement une cellule `[00:00, lendemain 00:00)` dans le fuseau du site |
| PLN-02 | Deux semaines complètes × trois salles | 42 cellules uniques, dates lundi–dimanche explicites |
| PLN-03 | Mois de 28/29/30/31 jours et 29 février | cardinalités exactes, aucune dépendance à la locale navigateur |
| PLN-04 | Jours DST Europe/Paris | cellule de 23 h puis 25 h UTC, toujours un jour civil |
| PLN-05 | 366 jours/500 cellules puis dépassement | bornes acceptées ; `RANGE_TOO_LARGE` avant toute écriture au-delà |
| PLN-06 | Prévisualiser puis changer salle/date/projet | ancien jeton invalide ; nouvelle prévisualisation requise |
| PLN-07 | Conflit créé entre preview et commit | recalcul au commit, `PREVIEW_STALE` ou `PLANNING_CONFLICT`, zéro cellule partielle |
| PLN-08 | Option et confirmed chevauchants, cancelled, puis deux cellules adjacentes | capacité cumulée correcte ; cancelled exclu ; adjacence acceptée |
| PLN-09 | Override sans droit, motif <10/>500, puis motif valide avec droit | refus ; refus ; succès global motivé et audité cellule par cellule |
| PLN-10 | Override sur matériel sérialisé maintenance/quarantaine/sorti | refus absolu, jamais surchargeable |
| PLN-11 | Déplacer une cellule vers salle disponible du même site | conserve date/projet/série/statut, incrémente version, audit et SSE |
| PLN-12 | Déplacer inter-site, vers draft/inactive, en conflit ou avec vieille version | refus, cellule exactement à sa position initiale |
| PLN-13 | Portées `cell`, `following`, `series` | défaut `cell`; décompte prévisualisé ; mutations multi-cellules atomiques |
| PLN-14 | Annuler cellule puis série | exception historique conservée ; cellules actives annulées ; capacité libérée |
| PLN-15 | Ajouter/retirer jours ou changer période | preview obligatoire, cellules explicites, aucun fantôme ni doublon |
| PLN-16 | Deux commits concurrents sur dernière capacité disponible | un seul succès ; autre conflit/version ; audit/SSE cohérents |
| PLN-17 | Série multi-salles + RH + matériel quantitatif/sérialisé | contrôle de toutes les cellules et allocations avant commit, tout ou rien |

## 9. Migration v2→v3 et rollback

| ID | Cas | Attendu |
|---|---|---|
| MIG-01 | Migrer données vierges et seed valide deux fois | schéma v3 valide ; second passage sans mutation ni doublon |
| MIG-02 | Vérifier sauvegarde avant écriture | copie atomique lisible, empreinte et manifeste v2 exacts |
| MIG-03 | Projets avec référence/code valide | IDs stables, référence normalisée, alias lecture temporaire si prévu |
| MIG-04 | Collision de références normalisées | projets conservés `draft`, anomalie `DUPLICATE_REFERENCE`, aucun renommage inventé |
| MIG-05 | Déduire `primarySiteId` | renseigné seulement si toutes les réservations historiques démontrent le même site |
| MIG-06 | Réservation sans projet | `legacyUnassigned`, lisible et annulable seulement, anomalie `PROJECT_REQUIRED` |
| MIG-07 | Réservation intra-journée | `legacyTimed`, instants/statut/version/audit conservés |
| MIG-08 | Réservation couvrant des jours civils exacts et plusieurs salles | une cellule par salle/date, sans trou ni doublon |
| MIG-09 | Réservation sans salle principale | `legacyTimed` + `ROOM_REQUIRED`, ressources complémentaires préservées |
| MIG-10 | Stock/allocation déjà liée | aucun mouvement ou débit dupliqué ; quantités et historique conservés |
| MIG-11 | v2 partiellement incomplet | migration contrôlée, anomalies actionnables, aucune fausse entité de correction |
| MIG-12 | Fichier tronqué ou interruption simulée | original intact, aucun v3 partiel publié, erreur exploitable sans donnée sensible |
| MIG-13 | Comparer manifestes avant/après | conservation IDs, statuts, acteurs, versions, audits, totaux et liens ; écarts tous expliqués |
| MIG-14 | Rollback avant mutation v3 | restauration byte-for-byte de la sauvegarde v2, application redémarrable |
| MIG-15 | Rollback après mutation v3 | refus de restauration destructive ; export de sécurité et procédure approuvée exigés |

## 10. RBAC et isolation

Appliquer chaque ligne aux routes de contexte, sites/services, ressources, types, affectations, projets, séries, cellules, audit et SSE.

| Acteur | Lecture autorisée | Mutations autorisées | Refus obligatoires |
|---|---|---|---|
| Admin organisation | tenant et sites explicitement couverts | gestion selon permissions, override si accordé | autre tenant, site hors scope |
| Admin Paris | Paris | mutations Paris seulement | Boulogne et autre tenant |
| Planificateur Paris | contexte, ressources/maintenance, projets/planning Paris | planification selon permissions | gestion ressources/organisation, override sans permission |
| Lecteur Paris | lectures Paris | aucune | toutes mutations, même avec bouton/route devinée |
| Membership sans site | contexte minimal | aucune | toute donnée de site |
| Utilisateur autre tenant | son tenant uniquement | selon ses droits locaux | tous IDs du tenant cible |

Cas obligatoires : suppression du `organizationId` client comme autorité, modification d'un ID dans chemin/query/corps, pagination et recherche ne comptant jamais les objets cachés, erreur identique objet absent/hors périmètre, audit filtré, reconnexion/changement de contexte invalidant caches et flux, et révocation de membership/site fermant ou neutralisant immédiatement le SSE.

## 11. Sécurité

| ID | Menace/test | Critère |
|---|---|---|
| SEC-01 | Mutation sans session, CSRF absent/invalide, `Origin` malveillante | `401` ou `403`, aucune mutation/audit/SSE succès |
| SEC-02 | Origine loopback exacte autorisée puis variante trompeuse (`evil`, sous-domaine, port non prévu) | seule liste stricte acceptée |
| SEC-03 | IDOR tenant/site sur toutes les entités et historiques | aucune existence, total, nom ou timing distinctif divulgué |
| SEC-04 | Changement organisation/site pendant requêtes en vol | chaque requête liée au contexte/session validé ; aucun cache croisé |
| SEC-05 | Logout, expiration, révocation de membership/site avec SSE ouvert | flux fermé ou événements neutralisés immédiatement |
| SEC-06 | XSS stockée/réfléchie dans noms, motifs, notes, référence et caractéristiques | sortie échappée, aucune exécution après liste/détail/SSE |
| SEC-07 | Identifiants légaux, contacts et champs RH interdits | absents des logs, erreurs, audit public, SSE et réponses non nécessaires |
| SEC-08 | Logo/actif local si présent : MIME, taille, nom, contenu actif/path traversal | validation stricte, stockage sûr, aucun fichier arbitraire servi |
| SEC-09 | Accès statique à `data/`, `.git/`, serveur, tests, docs, `.env` et chemins encodés | `404` sans contenu sensible |
| SEC-10 | Corps surdimensionné, collections > bornes, profondeur/chaînes extrêmes, JSON invalide | refus borné, serveur stable, aucune écriture partielle |
| SEC-11 | Rejeu idempotent après perte de site, rôle ou membership | autorisation réévaluée ; aucun ancien résultat sensible divulgué |
| SEC-12 | Brute force/auth discriminante, fixation/rotation/expiration de session | réponses non discriminantes, session opaque `HttpOnly`, `SameSite=Lax`, rotation correcte |

Aucune vulnérabilité critique ou élevée n'est compatible avec `APPROVED`.

## 12. Performance et robustesse

### Données et protocole

- Organisation : 20 organisations, 20 sites, 100 services et 1 000 memberships.
- Ressources : jeu complet défini en 3.3, avec 125 salles sur un même site.
- Planning : 120 salles et 10 000 réservations, vues jour/semaine/mois avec conflits représentatifs.
- Au moins 30 itérations mesurées après échauffement ; tests concurrents de double affectation, dernière capacité, version et changement de contexte.

| ID | Parcours mesuré | Budget strict |
|---|---|---|
| PERF-01 | listes/contexte organisation, sites, services, memberships | p95 `<300 ms` |
| PERF-02 | `GET /resources` filtré et paginé | p95 `<300 ms` |
| PERF-03 | recherche équipement série/référence | p95 `<250 ms` |
| PERF-04 | affectation équipement complète avec audit | p95 `<250 ms` |
| PERF-05 | fiche salle + équipements actifs | p95 `<300 ms` |
| PERF-06 | lecture planning semaine, 120 salles/10 000 réservations | p95 `<300 ms` |
| PERF-07 | contrôle conflit + écriture planning | p95 `<250 ms` |
| PERF-08 | première liste/planning exploitable | `<2 s` |
| PERF-09 | filtre/recherche de 120+ salles après réponse | retour visuel `<200 ms`, aucun gel |
| PERF-10 | invalidation SSE après commit | client cohérent `<3 s` |

Surveiller mémoire, taille des réponses paginées, temps maximal, boucle événementielle et absence de croissance après changements répétés de tenant/SSE. Un p95 hors budget ou une mesure non reproductible bloque le gate performance.

## 13. Parcours E2E obligatoires

1. Créer `org_eliote_props`, compléter O1, constater O2/O3 verrouillés, configurer Paris/Post-production/offres, affecter admin et responsables, puis activer.
2. Vérifier séparément les blocages O1, O2 et O3 et que chaque refus laisse les modules aval inaccessibles.
3. Avec `admin_multi`, passer entre les trois organisations ; vérifier navigation, listes, compteurs, URL/état, cache et SSE sans fuite.
4. Créer et activer les types/salles attendus, injecter le jeu de 125 salles, retrouver `EDIT-117` par code, service et pagination, puis redémarrer.
5. Créer une ressource humaine multi-site autorisée ; vérifier refus des champs RH sensibles et invisibilité inter-tenant.
6. Rechercher un exemplaire sérialisé depuis la salle, l'affecter sans ressaisie, vérifier fiche/historique ; provoquer une double affectation concurrente ; désaffecter avec motif et réaffecter.
7. Passer un équipement requis en maintenance, constater indisponibilité et refus planning ; vérifier qu'un équipement optionnel ne produit que l'état dégradé prévu.
8. Tenter de planifier sans projet, puis créer client + projet `EMI-001`, valider `ready` et reprendre l'assistant sans entité fantôme.
9. Créer une série jour, une série de deux semaines × trois salles (42 cellules) et une série mensuelle traversant un changement DST ; recharger et contrôler chaque cellule.
10. Déplacer une cellule seule, puis `following` et `series`; provoquer conflit, vieille version et cible inter-site ; vérifier retour visuel exact et atomicité.
11. Tester conflit de capacité, override motivé autorisé, refus sans droit, annulation de cellule/série et libération de capacité ; confirmer actualisation SSE d'une seconde session.
12. Rejouer les parcours lecture/mutation comme Planificateur, Lecteur, admin Paris et utilisateur hostile ; vérifier tous les refus serveur même si l'UI est contournée.
13. Migrer la fixture v2 complète vers v3, vérifier rapport/anomalies/conservation, redémarrer, tester legacy sans projet, puis prouver le rollback avant mutation v3.
14. Couper puis redémarrer l'application sans réseau ; vérifier persistance des organisations, ressources, affectations, projets, séries, cellules, versions et audits.

Les parcours clavier couvrent assistant, filtres, pagination, dialogues conflit/override et déplacement. Le focus reste visible, chaque contrôle a un nom accessible et aucun statut n'est communiqué par la couleur seule.

## 14. Ordre du gate et critères de sortie

Ordre d'exécution : validation fixtures → tests unitaires domaine → API/intégration → migration → suite complète `npm test` → sécurité → performance → E2E UI/persistance/SSE → relecture des preuves sur le même candidat.

Le verdict est **APPROVED** uniquement si toutes les conditions suivantes sont simultanément démontrées :

- même empreinte candidate pour QA, sécurité, performance, intégration et E2E ;
- `npm test` et toutes les suites ciblées exécutées réellement : zéro échec, zéro test désactivé, ignoré, quarantiné ou résultat indéterminé ;
- 100 % des cas obligatoires de ce plan exécutés, avec attendu = observé et preuve reproductible ;
- onboarding O1/O2/O3 réellement bloquant côté serveur et aucune création aval prématurée ;
- isolation organisation/site et RBAC sans aucune fuite, notamment IDOR, SSE, cache, recherche, audit et rejeu idempotent ;
- projet obligatoire sur toute nouvelle planification, sans faux projet ni fallback ;
- cellules jour/semaine/mois, DST, capacité, conflits, déplacements et annulations atomiques et persistants ;
- migration v2→v3 idempotente, sauvegarde et rollback prouvés, conservation intégrale ou écarts explicitement approuvés, aucune corruption/perte/duplication ;
- budgets p95/UI/SSE respectés sur les volumes prescrits ;
- aucune vulnérabilité critique/élevée, aucun P0/P1 ouvert, aucune perte ou corruption de données ;
- rapports QA, sécurité, performance, intégration et E2E datés, complets et cohérents ; documentation de release/rollback et statut projet mis à jour par l'intégrateur.

Toute condition non mesurée vaut non satisfaite. Tout test rouge, preuve ancienne, limite omise, anomalie de migration, dépassement de budget ou P0/P1 impose **CHANGES REQUIRED**. Une correction renvoie au DEV puis rejoue ce gate et tous les gates aval impactés.

## 15. Livrables attendus à l'exécution

- `docs/qa-report.md` : environnement, état candidat, commandes, totaux, anomalies et verdict QA.
- `docs/security-review.md` : modèle de menace, cas exécutés, sévérité et verdict.
- `docs/performance-report.md` : protocole, volumes, p50/p95/max et verdict.
- preuves E2E expurgées, rapport de migration et manifestes avant/après.
- `docs/project-status.md` mis à jour par l'intégrateur ; ce plan mono-fichier ne le modifie pas.
