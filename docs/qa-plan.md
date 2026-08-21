# Plan QA exécutable — Planning Post Prod MVP 0.1

Statut : stratégie de validation indépendante  
Responsable : Agent 08 — QA / Test Engineer  
Date : 2026-08-14  
Références : `docs/spec-mvp.md`, `docs/architecture.md`

## 1. Objectif et principes

Ce plan démontre que le MVP respecte ses contrats métier, API, données, sécurité, UX et performance. Il est indépendant de la structure finale du code : les assertions portent sur les comportements publics, les invariants documentés et l'état persistant.

Règles QA :

- chaque test part d'une base neuve ou d'un état explicitement nommé ;
- aucune suite ne dépend de l'ordre d'exécution ni d'un accès réseau externe ;
- temps figé, UUID déterministes et fuseau explicite dans les tests concernés ;
- les tests négatifs vérifient le statut, le code d'erreur stable, l'absence d'écriture partielle et l'absence de fuite de données ;
- un test n'est modifié que si le contrat produit change ou si le test est objectivement erroné ;
- tout défaut reproductible reçoit un cas de non-régression avant clôture ;
- les preuves de test contiennent commande, commit, environnement, durée et résultat, sans secrets ni données libres sensibles.

## 2. Environnement et commandes contractuelles

Les noms exacts seront raccordés aux scripts du dépôt dès leur création. Le projet doit exposer au minimum les commandes équivalentes suivantes :

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:security
npm run test:perf
npm run test
npm run build
```

En CI, utiliser Node dans la version du dépôt, le lockfile figé, un répertoire SQLite temporaire par worker et `TZ=UTC`. Les scénarios navigateur définissent eux-mêmes `Europe/Paris`. Aucun test ne doit réutiliser la base de développement.

Artefacts attendus : rapport JUnit, couverture, traces/captures des seuls E2E en échec, rapport d'accessibilité, résultats performance JSON et logs serveur corrélés par `requestId`.

## 3. Données de référence

### 3.1 Jeu fonctionnel `qa-base`

| Alias | Donnée stable |
|---|---|
| `company-a` | Société A, fuseau par défaut `Europe/Paris` |
| `company-b` | Société B, destinée aux tests d'isolation |
| `site-a-paris` | société A, `Europe/Paris` |
| `site-a-lyon` | société A, `Europe/Paris` |
| `site-b-paris` | société B, `Europe/Paris` |
| `admin-a` | toutes permissions, sites A Paris et Lyon |
| `planner-a` | gestion clients/projets/planning, override, site A Paris uniquement |
| `viewer-a` | lecture seule, site A Paris uniquement |
| `planner-b` | planificateur de société B |
| `room-a1` | salle A Paris, capacité 1 |
| `suite-a2` | suite A Paris, capacité 1 |
| `render-a3` | équipement A Paris, capacité 3 |
| `room-a-lyon` | salle A Lyon, capacité 1 |
| `room-b1` | salle société B, capacité 1 |
| `client-a1` / `project-a1` | client et projet actifs de société A |
| `project-a-archived` | projet archivé de société A |
| `client-b1` / `project-b1` | client et projet actifs de société B |

Les mots de passe sont des secrets de démonstration locaux, injectés dans le runner et jamais consignés dans les rapports. Les identifiants sont fixes dans les fixtures, mais l'API les traite comme opaques.

### 3.2 Jeu temporel `qa-calendar`

Sur `room-a1`, le 15 janvier 2026 :

- `R1` confirmée, `[09:00, 10:00)`, quantité 1 ;
- `R2` option, `[10:00, 11:00)`, quantité 1 ;
- `R3` annulée, `[09:30, 10:30)`, quantité 1.

Sur `render-a3`, capacité 3 :

- `R4` confirmée, `[09:00, 11:00)`, quantité 2 ;
- `R5` option, `[10:00, 12:00)`, quantité 1.

Toutes les valeurs API sont des instants ISO 8601 avec offset et sont vérifiées en UTC en base.

### 3.3 Jeu performance `qa-perf`

Générateur déterministe, graine `20260814` : 1 société, 2 sites, 100 ressources actives réparties entre les types, 20 utilisateurs, 10 000 réservations dans la fenêtre mesurée, statuts et quantités contrôlés, index statistiques actualisés. Le générateur écrit un manifeste avec les comptes et une somme de contrôle pour garantir la comparabilité.

## 4. Tests unitaires

| ID | Cas et entrée | Résultat attendu |
|---|---|---|
| `U-PLN-001` | existante `[09:00,10:00)`, candidate `[10:00,11:00)` | aucun chevauchement |
| `U-PLN-002` | candidate incluse, englobante, chevauchement à gauche/droite | chevauchement dans les quatre cas |
| `U-PLN-003` | intervalles identiques | chevauchement |
| `U-PLN-004` | début égal à fin ou fin antérieure | validation refusée |
| `U-CAP-001` | capacité 3, `R4` quantité 2 et `R5` quantité 1 | accepté, pic égal à 3 |
| `U-CAP-002` | ajouter quantité 1 sur `[10:30,11:30)` au cas précédent | refusé uniquement sur le segment `[10:30,11:00)` |
| `U-CAP-003` | réservation annulée chevauchante | quantité ignorée |
| `U-CAP-004` | quantité 0, négative ou supérieure à la capacité seule | validation refusée |
| `U-STA-001` | `option` et `confirmed` | consomment la capacité |
| `U-STA-002` | annulation | libère la capacité ; seconde annulation idempotente selon contrat HTTP |
| `U-STA-003` | modification d'une réservation annulée | refusée |
| `U-DASH-001` | fenêtre 09:00–11:00, capacité 1, une heure occupée | occupation 50 % |
| `U-DASH-002` | réservation 08:00–10:00, fenêtre 09:00–11:00 | durée bornée à 1 h, occupation 50 % |
| `U-DASH-003` | période sans réservation / sans ressource sélectionnée | 0 %, aucune division par zéro |
| `U-TZ-001` | aller DST Europe/Paris, `2026-03-29T01:30+01:00` à `03:30+02:00` | durée réelle 1 h, stockage UTC exact |
| `U-TZ-002` | retour DST, les deux occurrences locales de 02:30 avec offsets distincts | instants distincts et ordre stable |
| `U-VAL-001` | enums inconnues, date sans offset, UUID invalide, couleur invalide, titre vide | erreur de validation structurée |
| `U-PERM-001` | catalogue de permissions fermé | permission inconnue impossible |

Objectif de couverture : 100 % des branches des fonctions d'invariants planning, capacité, autorisation et dashboard ; au moins 85 % lignes/branches sur le domaine global. La couverture ne remplace aucun cas limite explicite.

## 5. Tests API, base et intégration

### 5.1 Contrats API

| ID | Action | Assertions |
|---|---|---|
| `API-AUTH-001` | login valide puis `/auth/me`, logout | cookie opaque `HttpOnly`, `SameSite=Lax`, `Secure` hors localhost ; session inutilisable après logout |
| `API-AUTH-002` | email inconnu puis mauvais mot de passe | même statut, même code et message non discriminant |
| `API-VAL-001` | payload mal formé sur chaque mutation | 4xx documenté, enveloppe `{error:{code,message,details,requestId}}`, aucune écriture |
| `API-LIST-001` | pagination bornes 1, page vide, taille max+1 | `items/page/pageSize/total` cohérents ; taille abusive refusée ou bornée selon contrat |
| `API-FLT-001` | combinaisons site, ressources, statut, projet, fenêtre | intersection correcte ; aucune donnée hors fenêtre/périmètre |
| `API-IDEM-001` | deux POST identiques avec même `Idempotency-Key` | une seule réservation/audit, réponse canonique identique |
| `API-IDEM-002` | même clé avec payload différent | conflit explicite, aucune seconde écriture |
| `API-VER-001` | deux PATCH avec la même version N | le premier produit N+1 ; le second reçoit `409 VERSION_CONFLICT` et n'écrase rien |
| `API-RES-001` | mutation réussie | représentation canonique complète, dates/relations/version à jour |
| `API-NOTFOUND-001` | UUID absent puis UUID d'une autre société | réponses indistinguables quant à l'existence de l'entité |

Chaque endpoint listé dans l'architecture doit avoir au moins : succès, entrée invalide, non authentifié, permission insuffisante et périmètre interdit.

### 5.2 Persistance et transactions

| ID | Précondition / action | Résultat attendu |
|---|---|---|
| `DB-MIG-001` | base vide, appliquer toutes les migrations | schéma complet, contraintes et index minimaux présents |
| `DB-MIG-002` | rejouer la commande de migration | aucun changement destructif, succès |
| `DB-SEED-001` | exécuter le seed deux fois | comptes métier identiques, aucune duplication |
| `DB-CON-001` | capacité/quantité non positive, `starts_at >= ends_at`, doublons uniques | contrainte DB refuse même en contournant l'API |
| `DB-FK-001` | relations cross-company/site et suppression d'une référence utilisée | refus, intégrité conservée |
| `DB-ATOM-001` | réservation sur deux ressources, conflit sur la seconde | aucune réservation, allocation ni audit partiel |
| `DB-ATOM-002` | simuler une erreur d'audit avant commit | toute la mutation est rollbackée, aucun SSE |
| `DB-WAL-001` | 20 écritures concurrentes bornées | aucun conflit de capacité accepté, aucune erreur `busy` non gérée |
| `DB-PERSIST-001` | écrire, arrêter proprement, redémarrer | données et versions identiques |

### 5.3 Planning, conflits, audit et temps réel

| ID | Scénario | Résultat attendu |
|---|---|---|
| `INT-PLN-001` | créer sur `room-a1` `[10:00,11:00)` adjacent à `R1` | 201, aucun conflit |
| `INT-PLN-002` | créer `[09:30,10:30)` sur `room-a1` | `409 PLANNING_CONFLICT`, détail ressource/période/réservations, aucune écriture |
| `INT-PLN-003` | même conflit avec override autorisé et motif non vide | succès, motif/acteur audités, réponse signale l'override |
| `INT-PLN-004` | override sans permission ou motif blanc | 403 ou validation 4xx, aucune écriture/audit de succès |
| `INT-PLN-005` | créer à la place de `R3` annulée | succès |
| `INT-PLN-006` | déplacer/redimensionner vers un conflit | même contrôle et même atomicité qu'une création |
| `INT-PLN-007` | projet archivé ou cross-company, ressource autre site | refus sans écriture partielle |
| `INT-PLN-008` | désactiver une ressource puis tenter de réserver | refus ; les anciennes réservations restent lisibles |
| `INT-RES-001` | changer le site d'une ressource déjà réservée | refus métier |
| `INT-AUD-001` | création, mise à jour, annulation, override | événements append-only avec acteur, instant, entité, action et détails attendus |
| `INT-SSE-001` | mutation commitée avec deux sessions autorisées | événement versionné émis après commit ; recharge ciblée possible |
| `INT-SSE-002` | transaction rollbackée | aucun événement émis |
| `INT-SSE-003` | écouteur d'une autre société/site | aucun événement hors périmètre |
| `INT-SSE-004` | coupure SSE | reconnexion/repli HTTP sans doublon ni perte durable d'état |

## 6. Matrice autorisations et sécurité

Pour chaque ligne, tester via appel HTTP direct, pas uniquement par masquage UI.

| Action | Admin A | Planner A | Viewer A | Planner B |
|---|---:|---:|---:|---:|
| lire planning site A Paris | oui | oui | oui | non |
| muter réservation A Paris | oui | oui | non | non |
| override conflit A Paris | oui | oui | non | non |
| gérer ressource | oui | non sauf permission explicite | non | non |
| gérer client/projet A | oui | oui | non | non |
| lire dashboard A | oui | oui | oui | non |
| lire audit A | selon permission `audit.read` | selon permission | non | non |
| accéder site A Lyon | oui | non | non | non |

Cas sécurité obligatoires :

- `SEC-TEN-001` : substituer dans URL, query et payload les UUID de société B ; aucun contenu, compte, total, conflit, timing volontaire ou message ne révèle B ;
- `SEC-TEN-002` : envoyer `companyId` A ou B depuis le client ; l'autorité vient exclusivement de la session ;
- `SEC-CSRF-001` : mutation sans jeton, jeton invalide, origine absente/interdite ; refus ; origine autorisée + jeton valide ; succès ;
- `SEC-SES-001` : cookie altéré, expiré, ancien cookie après reconnexion ; refus et aucune mutation silencieuse ;
- `SEC-BF-001` : tentatives de login répétées par compte et adresse ; limitation active sans permettre l'énumération ;
- `SEC-INJ-001` : charges SQL dans filtres, recherche, UUID et champs libres ; aucune exécution ni erreur SQL divulguée ;
- `SEC-XSS-001` : notes/titres avec HTML, SVG, attributs événementiels et URL script ; rendu texte, aucun script exécuté ;
- `SEC-LOG-001` : provoquer erreurs auth et mutations ; logs sans cookie, jeton CSRF, mot de passe ni notes libres ;
- `SEC-HDR-001` : vérifier politiques de contenu et en-têtes défensifs retenus, types MIME et absence de stack trace en production ;
- `SEC-DEP-001` : audit des dépendances de production ; aucune vulnérabilité critique ou élevée connue à la release ;
- `SEC-NET-001` : exécuter build et application après installation avec réseau bloqué ; aucune requête SaaS/CDN/télémétrie.

## 7. Tests UI et E2E

Exécuter sur le navigateur principal supporté à 1440×900 et 1024×768. Ajouter une passe consultation à 768 px. Les sélecteurs utilisent rôles/labels ou attributs de test stables, jamais les classes visuelles.

### 7.1 Composants et accessibilité

- validations inline associées aux champs, résumé lisible et focus placé sur la première erreur ;
- états chargement, vide, erreur, accès refusé et nouvelle tentative ;
- navigation clavier complète des actions essentielles, focus visible, ordre logique, fermeture/retour de focus du panneau latéral ;
- libellés accessibles des champs et actions iconiques ; statuts distinguables autrement que par couleur ;
- filtres combinables, visibles, réinitialisables et reflétés de façon stable dans l'URL ou l'état documenté ;
- drag & drop avec feedback, ainsi qu'une alternative clavier ou formulaire pour modifier les mêmes valeurs ;
- axe temporel et réservations lisibles dans les vues jour/semaine/mois ; aucune collision masquant une action essentielle ;
- scan automatisé sans violation critique ou sérieuse sur connexion, planning, formulaire, conflit et dashboard, complété par une vérification clavier manuelle.

### 7.2 Parcours E2E Gate 01

| ID | Parcours utilisateur | Preuve attendue |
|---|---|---|
| `E2E-001` | connexion planner, site par défaut, changement de site autorisé, mémorisation après reload | site/vue conservés, aucun site interdit proposé |
| `E2E-002` | admin crée une ressource ; planner crée client puis projet | valeurs immédiatement filtrables/sélectionnables |
| `E2E-003` | créer une réservation confirmée multi-ressources | visible sans reload puis identique après reload et dans les 3 vues |
| `E2E-004` | déplacer une réservation | dates modifiées, durée conservée, persistance après reload |
| `E2E-005` | redimensionner puis tenter une fin invalide | durée valide persistée ; cas invalide bloqué et expliqué |
| `E2E-006` | provoquer un conflit, annuler, puis override avec motif | détail lisible ; aucune écriture au premier essai ; succès et audit au second |
| `E2E-007` | deux contextes navigateur éditent la même version | second reçoit conflit de version, donnée rechargée, aucune perte |
| `E2E-008` | mutation dans contexte B autorisé du même périmètre | contexte A actualisé en moins de 3 s sans reload complet |
| `E2E-009` | combiner filtres site/type/ressource/projet/statut puis réinitialiser | résultats exacts dans planning ; remise à zéro complète |
| `E2E-010` | dashboard sur jeu connu puis clic vers planning | taux exacts, période et filtres conservés |
| `E2E-011` | viewer navigue et tente les mutations via UI puis API | actions absentes/inactives et refus serveur systématique |
| `E2E-012` | session expire pendant un formulaire rempli, tentative de sauvegarde | retour connexion et avertissement explicite ; aucune mutation perdue silencieusement |
| `E2E-013` | période vide du dashboard | 0 %, état vide, aucune erreur console |

Le parcours critique `connexion → client → projet → ressource → réservation → déplacement → conflit → dashboard` est aussi exécuté en un scénario continu sur base neuve.

## 8. Performance et robustesse

Protocole : build production, base `qa-perf`, machine et versions consignées, cinq passes d'échauffement, au moins 30 mesures par opération, processus concurrents contrôlés, résultats bruts archivés. Un résultat n'est comparé à une baseline que sur environnement équivalent.

| ID | Charge | Seuil de sortie |
|---|---|---|
| `PERF-API-001` | GET planning semaine, 100 ressources et 10 000 réservations | p95 serveur < 300 ms, 0 erreur |
| `PERF-API-002` | contrôle conflit + écriture sans conflit | p95 < 250 ms, cohérence 100 % |
| `PERF-CON-001` | 20 utilisateurs locaux, mélange 80 % lectures / 20 % mutations pendant 10 min | aucune corruption, aucun conflit dépassant la capacité, taux erreur inattendu 0 % |
| `PERF-UI-001` | ouverture du planning chargé | contenu exploitable < 2 s après démarrage local |
| `PERF-UI-002` | scroll/pan/drag sur 100 lignes | cible 60 fps ; aucune tâche longue répétée > 100 ms ; interaction sans blocage visible |
| `PERF-SSE-001` | mutation vers 20 clients connectés | actualisation ciblée < 3 s pour 100 % des clients locaux |
| `ROB-001` | redémarrage après charge puis vérification d'intégrité SQLite | aucune corruption ou perte de donnée commitée |
| `ROB-002` | requêtes planning successives avec changement rapide de fenêtre | requêtes obsolètes annulées/dédupliquées, aucune donnée tardive affichée |

Une régression supérieure à 15 % contre la baseline validée déclenche une analyse même si le seuil absolu reste respecté.

## 9. Ordre d'exécution et triage

Pipeline minimal :

1. installation verrouillée, lint/typecheck et build ;
2. migrations sur base vierge et seed répétable ;
3. unitaires ;
4. API, DB, permissions et intégration ;
5. sécurité automatisée ;
6. E2E Gate 01 et accessibilité ;
7. performance sur runner dédié ;
8. test manuel exploratoire ciblé sur calendrier, conflits, clavier et messages d'erreur.

Sévérité :

- `S0` : perte/corruption de données, fuite inter-sociétés, contournement auth ; bloque immédiatement ;
- `S1` : parcours Gate 01 impossible, capacité incorrecte, écrasement concurrent, vulnérabilité élevée ; bloque la release ;
- `S2` : fonction dégradée avec contournement acceptable, accessibilité sérieuse, seuil performance raté ; bloque sauf décision produit explicite ;
- `S3` : défaut mineur sans risque métier ; documenté et priorisé.

Chaque ticket comporte environnement, fixture, étapes minimales, attendu/réel, preuve, sévérité et test de régression proposé. Les intermittences sont traitées comme défauts : pas de relance automatique servant à rendre la CI verte.

## 10. Critères de sortie

La QA rend `APPROVED` uniquement lorsque :

- toutes les cases Gate 01 sont reliées à au moins un test et toutes passent sur base neuve ;
- 100 % des tests unitaires, intégration, API, DB, permissions, sécurité et E2E critiques passent sur deux exécutions consécutives ;
- zéro défaut ouvert `S0`, `S1` ou `S2`, et aucun test quarantiné sans défaut et date de résolution ;
- les objectifs de couverture du domaine sont atteints ;
- aucune vulnérabilité critique ou élevée connue n'est livrée ;
- les seuils API, UI, concurrence et SSE sont respectés avec rapports archivés ;
- migrations et seed sont rejouables, les données persistent après redémarrage, le build fonctionne hors ligne après installation ;
- le parcours critique est validé au clavier et ne présente aucune violation d'accessibilité critique/sérieuse ;
- la revue QA est indépendante du développeur et le rapport identifie commit, versions et environnement.

Sinon, le verdict est `CHANGES REQUIRED`, avec retour au responsable du module concerné. Une dérogation ne peut pas masquer un invariant de sécurité, d'isolation, d'intégrité ou de capacité.

## 11. Traçabilité Gate 01

| Domaine Gate 01 | Tests principaux |
|---|---|
| Authentification / session | `API-AUTH-*`, `SEC-SES-001`, `E2E-001`, `E2E-012` |
| Permissions / isolation | matrice autorisations, `SEC-TEN-*`, `E2E-011` |
| Référentiels | `API-VAL-001`, `DB-CON-001`, `E2E-002` |
| Création / vues planning | `INT-PLN-001`, `E2E-003` |
| Déplacement / redimensionnement | `INT-PLN-006`, `E2E-004`, `E2E-005` |
| Capacité / statuts / conflits | `U-CAP-*`, `U-STA-*`, `INT-PLN-002` à `INT-PLN-005`, `E2E-006` |
| Concurrence / temps réel | `API-VER-001`, `DB-WAL-001`, `INT-SSE-*`, `E2E-007`, `E2E-008` |
| Filtres | `API-FLT-001`, `E2E-009` |
| Dashboard | `U-DASH-*`, `E2E-010`, `E2E-013` |
| Accessibilité | section 7.1 et parcours critique clavier |
| Performance | `PERF-*`, `ROB-*` |
| Installation / persistance | `DB-MIG-*`, `DB-SEED-001`, `DB-PERSIST-001`, `SEC-NET-001` |
