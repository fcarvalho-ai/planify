# Sprint 5 — Ressources avancées et temps réel

Date : 2026-08-21  
Références : Backlog V1 (`US-068`, `US-070` à `US-076`), Ordre de lancement V1, `docs/spec-mvp.md`, `docs/architecture.md`.  
Gate : **G5 — Multi-utilisateur fiable**.

## 1. Objectif et périmètre

Le Sprint 5 rend le planning utilisable simultanément par plusieurs opérateurs sans perte ni écrasement silencieux. Il couvre :

- la double option déterministe (`US-068`) ;
- la ressource générique « salle à définir » puis son affectation (`US-070`) ;
- les compétences et indisponibilités du personnel (`US-071`) ;
- la synchronisation temps réel, la présence, les verrous courts et trois planificateurs concurrents (`US-072` à `US-076`).

Sont exclus : migration React/TypeScript/SQLite, service distant, WebSocket externe, moteur IA distant et facturation. La RC1 conserve HTTP JSON + SSE local. Le SSE transporte des invalidations et de la présence bornée ; après une invalidation métier, le navigateur recharge la donnée canonique.

## 2. Invariants

1. La `version` optimiste est l'autorité finale. Une version obsolète répond `409 VERSION_CONFLICT` et ne modifie rien.
2. Un verrou de présence est temporaire, lié à une session, borné par un TTL serveur et libéré à la fin, à la déconnexion ou à l'expiration. Il ne remplace jamais la version.
3. Toute lecture, mutation, présence et diffusion SSE revalide société, site, projet et scopes d'entités ; une famille inconnue échoue fermée.
4. Les mutations métier restent atomiques, idempotentes lorsque rejouables, auditées, puis diffusées après commit. La présence éphémère n'est pas persistée dans `planify.json` et ne crée pas d'audit métier.
5. Une option consomme la capacité. Une option sans `optionGroupId` est indépendante : sa confirmation ne décide aucune autre option. Deux options concurrentes ne sont arbitrées ensemble que lorsqu'elles partagent un `optionGroupId` non vide sous le contrat `doubleOption`; la confirmation est atomique, la priorité valide gagne et l'autre option reste visible avec alerte et alternatives structurées.
6. Une réservation générique consomme une capacité de catégorie/site sans inventer une salle. Son affectation ultérieure exige une ressource active, compatible, disponible et autorisée.
7. Les compétences et indisponibilités sont des données structurées, bornées et tenant-scopées. PlanyBot ne propose que des personnes autorisées, compétentes et disponibles.

## 3. Contrats de données

### Présence et verrou éphémère

`ReservationPresence` : `reservationId`, `companyId`, `siteId`, `projectId`, `actorUserId`, `actorDisplayName`, `sessionId`, `intent` (`editing|moving|resizing`), `acquiredAt`, `expiresAt`. TTL cible : 20 secondes, renouvelable ; nettoyage opportuniste et à la fermeture de session.

API cible :

- `GET /api/v1/planning/presence?siteId=…` — présence visible dans le périmètre courant ;
- `PUT /api/v1/reservations/{id}/presence` — acquisition/renouvellement ;
- `DELETE /api/v1/reservations/{id}/presence` — libération idempotente.

Une présence étrangère active répond `423 RESERVATION_LOCKED` à l'acquisition. Une mutation concurrente conserve en plus le contrôle de `version`. Les gestes souris et clavier utilisent le même protocole. La libération manuelle, la déconnexion et l'expiration du TTL publient toutes `reservation.presenceReleased.v1` aux autres sessions encore autorisées.

Événements : `reservation.presence.v1` et `reservation.presenceReleased.v1`, filtrés comme la réservation. Aucun contenu libre n'est diffusé.

### Double option

Une réservation `option` peut porter `optionGroupId`, `optionPriority` et `optionExpiresAt`. La confirmation exécute une commande atomique qui contrôle capacité, version et priorité. À égalité, l'instant de commit serveur départage. Le projet perdant reçoit une alerte structurée et des ressources alternatives, sans annulation silencieuse.

### Ressource générique

Une allocation peut référencer soit `resourceId`, soit `resourceCategoryId` avec `generic: true`, jamais les deux. L'affectation remplace atomiquement l'allocation générique par une ressource réelle compatible et conserve la traçabilité `genericAllocationId`.

### Personnel

`PersonSkill` référence l'adhésion active d'une personne (`membershipId`), un code normalisé, un libellé et un niveau `1..5`. `PersonUnavailability` porte une période semi-ouverte, un site optionnel, un type (`leave|rtt|illness|unavailable`) et un statut (`confirmed|cancelled`). Deux indisponibilités actives d'une même personne ne peuvent pas se chevaucher.

API : `GET|POST /api/v1/person-skills`, `DELETE /api/v1/person-skills/{id}`, `GET|POST /api/v1/person-unavailabilities`, `DELETE /api/v1/person-unavailabilities/{id}`. Les lectures exigent `planning.read`; les mutations exigent `planning.write`, CSRF/Origin, scope d'adhésion et contrôle de version à l'annulation. Toutes les mutations exigent une `Idempotency-Key` : un rejeu exact restitue le résultat initial sans nouvel audit/SSE, tandis qu'un contenu divergent répond `409 IDEMPOTENCY_CONFLICT`.

PlanyBot reconnaît les compétences Montage, Assistanat montage, Étalonnage, Mixage et Technique. Une recherche de personnel ne retourne que les adhésions actives visibles, portant la compétence demandée et sans indisponibilité confirmée intersectant la période. Il ne révèle ni email ni téléphone et ne crée aucune réservation.

## 4. Interface

- Un indicateur non fondé sur la couleur affiche « X modifie cette réservation » et l'intention en cours.
- L'acquisition commence au focus ou au début d'un geste sensible ; un heartbeat renouvelle tant que l'édition reste active ; fermeture, annulation et changement de contexte libèrent.
- Une perte de verrou ou un `409` arrête l'aperçu optimiste, restaure le snapshot et propose de recharger.
- Les alternatives clavier existantes déclenchent le même protocole de présence que la souris.
- La double option et la ressource générique ont des libellés explicites, des alternatives et un résumé accessible.
- Le formulaire de réservation sépare explicitement « Salle précise » et « Salle à définir ». Dans le second cas, seule une catégorie active du site est demandée ; aucune cellule de salle fictive n'est rendue.
- Les réservations à affecter sont regroupées au-dessus de la grille avec leur projet, période, catégorie et quantité. L'opérateur choisit une ressource réelle compatible ; un refus de disponibilité laisse la réservation générique intacte et explique le motif.
- Le statut Option révèle un bloc « Double option » : groupe, priorité et échéance. L'interface affiche textuellement « Double option », « Option retenue » ou « Option perdue », sans dépendre uniquement d'une couleur.
- O3 « Membres et accès » expose deux panneaux professionnels : compétences et indisponibilités. Chaque suppression est logique, chaque période utilise des champs date/heure natifs et un message rappelle que PlanyBot applique le filtre automatiquement.

## 5. Sécurité, performance et rollback

- Auth, CSRF/Origin et `planning.read`/`planning.write` sont requis selon la route.
- Les identifiants devinés hors périmètre répondent `404`; aucune présence d'un autre tenant n'est révélée.
- Les structures éphémères sont bornées par TTL et nombre de sessions actives ; une session ne peut ouvrir qu'un flux SSE à la fois et une limite globale protège le processus. Chaque famille d'événement possède une permission de lecture explicite, les familles inconnues échouent fermées et aucun texte utilisateur n'est injecté dans le SSE.
- Cible G5 : trois opérateurs concurrents, visibilité des changements en quelques secondes, aucune perte ; références Planning 250 ressources/10 000 réservations, lecture p95 `<300 ms`, mutation/conflit p95 `<250 ms`, UI `<2 s`.
- La première tranche présence/SSE est sans migration de données : rollback = retirer les routes/UI et vider la mémoire éphémère. Les tranches double option, générique et personnel utilisent des migrations additives, marqueurs d’intégrité, sauvegardes et rollbacks documentés.

La tranche S5-B utilise le marqueur additif `sprint-5-advanced-resources-v1`. Elle ne réécrit aucune réservation historique : elle active uniquement les champs optionnels et contrôle leurs invariants à chaque relecture. Avant le marqueur, une sauvegarde byte-exacte privée (`0600`) est créée. `rollbackSprint5AdvancedResources({ exportFile })` exige un export de récupération distinct avant de restaurer cette sauvegarde.

La tranche S5-C ajoute le marqueur `sprint-5-personnel-v1` après S5-B et les collections `personSkills` / `personUnavailabilities`. Sa sauvegarde byte-exacte est privée (`0600`). `rollbackSprint5Personnel({ exportFile })` vérifie le marqueur et sa sauvegarde, exige un export privé distinct, puis restaure exactement la source post-S5-B ; le rollback avancé peut ensuite être exécuté séparément si le retour complet du Sprint 5 est demandé.

## 6. Tranches et critères de sortie

1. **S5-A Temps réel fiable** : présence/TTL/libération, invalidation SSE, scopes et conflit de version ; tests à deux puis trois sessions.
2. **S5-B Options et génériques** : double option déterministe, catégorie générique puis affectation réelle. Sortie DEV : contrats API, migration/rollback, formulaire conditionnel, file « Salles à définir », affectation et états d'arbitrage intégrés ; tests API/Planning et smoke navigateur isolé verts.
3. **S5-C Personnel** : compétences, absences et filtrage PlanyBot. Sortie DEV : API, migration additive, interface O3, audit/SSE et tests négatifs de chevauchement/RBAC intégrés.
4. **S5-D G5** : E2E trois planificateurs, concurrence, timeout, déconnexion/reconnexion, redémarrage avec persistance, benchmarks et gates indépendants. Le test automatisé doit prouver la diffusion SSE aux deux autres sessions, un verrou court concurrent, un `409` sur version obsolète sans écrasement, la libération à la déconnexion et la reprise après redémarrage.

G5 est `APPROVED` uniquement si les trois opérateurs voient les changements sans rechargement manuel, qu'aucune mutation ne s'écrase silencieusement et que REVIEW, QA, SECURITY et PERFORMANCE portent sur la même empreinte.
