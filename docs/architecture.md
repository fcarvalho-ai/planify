# Architecture — Planning Post Prod MVP 0.1

Statut : décision d'architecture initiale  
Portée : MVP local, mono-instance  
Date : 2026-08-14

## 1. Décisions structurantes

Le MVP est un **monolithe modulaire** : une application web, une API et un moteur métier dans un même dépôt et un même processus de livraison. Les frontières de modules sont strictes, mais aucun microservice n'est introduit avant qu'un besoin mesuré ne le justifie.

Stack de référence :

- TypeScript en mode strict de bout en bout ;
- frontend React + Vite, application monopage responsive ;
- API HTTP Node.js, routes versionnées sous `/api/v1` ;
- SQLite en local, contraintes relationnelles et transactions activées ;
- migrations SQL versionnées et seed de démonstration déterministe ;
- tests unitaires et d'intégration sans service externe ;
- diffusion temps réel par Server-Sent Events (SSE), avec repli par rafraîchissement HTTP.

La version exacte des outils est figée dans le lockfile. Le démarrage et les tests ne doivent dépendre d'aucun SaaS, CDN, police distante, télémétrie ou accès réseau. Une fois les dépendances installées, le build est reproductible hors ligne.

### Pourquoi ce choix

SQLite réduit le coût d'installation et permet de livrer une application réellement exécutable localement. Les transactions suffisent à garantir les réservations sur une instance. Le schéma et les requêtes restent compatibles avec une migration ultérieure vers PostgreSQL, mais cette migration n'appartient pas au MVP.

### Alternatives écartées pour le MVP

- microservices : complexité d'exploitation sans bénéfice actuel ;
- WebSocket : protocole bidirectionnel inutile pour de simples invalidations ;
- authentification ou stockage cloud : incompatible avec l'exécution autonome locale ;
- cache distribué : SQLite et un cache mémoire borné suffisent à la charge cible.

## 2. Vue logique

```text
Navigateur
  ├─ Application Shell / Design System
  ├─ Planning / Dashboard / Administration
  └─ Client API typé + écoute SSE
               │
         HTTP JSON / SSE
               │
Serveur modulaire
  ├─ Auth & sessions
  ├─ Core (sociétés, sites, utilisateurs, rôles)
  ├─ CRM léger (clients, projets)
  ├─ Resources
  ├─ Planning (réservations, conflits, capacité)
  ├─ Dashboard
  └─ Audit / événements
               │
        Repositories + transactions
               │
             SQLite
```

Les dépendances vont de l'interface vers les cas d'usage, puis vers le domaine et les ports de persistance. Le domaine ne dépend ni du framework HTTP ni de SQLite. Un module ne lit pas directement les tables privées d'un autre module : il utilise un service applicatif ou un contrat partagé explicitement documenté.

## 3. Organisation recommandée du dépôt

```text
apps/
  web/                  # UI et client API
  server/               # composition HTTP, auth, SSE
packages/
  contracts/            # DTO, codes d'erreur, schémas de validation
  domain/               # types métier et invariants sans I/O
  ui/                   # design system
modules/
  core/
  resources/
  projects/
  planning/
  dashboard/
db/
  migrations/
  seed/
tests/
  integration/
  e2e/
docs/
```

Cette structure est une cible ; elle peut être simplifiée physiquement au démarrage si les frontières et les dépendances restent identiques.

## 4. Modèle de données

Toutes les clés primaires sont des UUID stockés en texte. Toutes les dates persistées sont des instants UTC ISO 8601 ; le fuseau IANA du site sert à l'affichage et aux saisies calendaires. Chaque table métier porte `created_at`, `updated_at` et, lorsqu'elle est modifiable concurremment, `version INTEGER`.

### Entités principales

| Entité | Champs structurants | Contraintes |
|---|---|---|
| `companies` | `id`, `name`, `slug`, `default_timezone` | `slug` unique |
| `sites` | `id`, `company_id`, `name`, `timezone`, `active` | nom unique par société |
| `departments` | `id`, `company_id`, `site_id?`, `name` | rattachement à la même société |
| `users` | `id`, `company_id`, `email`, `display_name`, `password_hash`, `active` | email normalisé unique par société |
| `roles` | `id`, `company_id`, `name` | nom unique par société |
| `user_roles` | `user_id`, `role_id`, `site_id?` | unicité du triplet |
| `role_permissions` | `role_id`, `permission` | permission issue du catalogue fermé |
| `clients` | `id`, `company_id`, `name`, `code`, `active` | code unique par société |
| `projects` | `id`, `company_id`, `client_id`, `name`, `code`, `status`, `color`, `text_color` | code unique par société ; couleurs hexadécimales `#RRGGBB` avec contraste fond/texte `>= 4,5:1` |
| `article_catalog_items` | `id`, `company_id`, `sage_code`, `analytics_code`, `designation`, `currency`, `default_unit`, `tariffs_minor`, `version` | code analytique unique par société ; désignation et cinq tarifs HT versionnés ; les nouvelles lignes de devis figent un snapshot, les lignes historiques sans snapshot ne consultent jamais le catalogue à la lecture |
| `resources` | `id`, `company_id`, `site_id`, `department_id?`, `name`, `type`, `capacity`, `color`, `active` | capacité positive ; nom unique par site/type |
| `reservations` | `id`, `company_id`, `site_id`, `project_id?`, `title`, `status`, `starts_at`, `ends_at`, `notes`, `created_by`, `version` | `starts_at < ends_at` |
| `reservation_resources` | `reservation_id`, `resource_id`, `quantity` | quantité positive ; unicité du couple |
| `audit_events` | `id`, `company_id`, `actor_user_id?`, `action`, `entity_type`, `entity_id`, `occurred_at`, `details_json` | ajout uniquement |

Valeurs fermées :

- `resources.type` : `room`, `suite`, `equipment`, `person`, `other` ;
- `reservations.status` : `option`, `confirmed`, `cancelled` ;
- `projects.status` : `active`, `on_hold`, `completed`, `archived`.

Une réservation annulée ne consomme pas de capacité. Une option et une réservation confirmée consomment de la capacité et peuvent entrer en conflit. La suppression métier est, par défaut, une désactivation ou une annulation ; elle conserve l'audit.

### Index minimaux

- `reservations(company_id, site_id, starts_at, ends_at, status)` ;
- `reservation_resources(resource_id, reservation_id)` ;
- `resources(company_id, site_id, type, active)` ;
- `projects(company_id, client_id, status)` ;
- `audit_events(company_id, occurred_at DESC)`.

## 5. Invariants du moteur de planning

Pour une ressource et un intervalle semi-ouvert `[début, fin)`, il y a chevauchement si :

```text
existing.starts_at < candidate.ends_at
AND existing.ends_at > candidate.starts_at
```

Deux réservations adjacentes ne sont donc pas en conflit. La somme des quantités simultanées ne peut dépasser `resources.capacity`. Pour une salle ou une suite, la capacité par défaut est `1`.

Création, déplacement, redimensionnement et changement de ressources suivent la même transaction :

1. valider les entrées et le périmètre société/site ;
2. ouvrir une transaction d'écriture ;
3. relire les allocations chevauchantes actives ;
4. calculer les conflits ;
5. refuser avec `409 PLANNING_CONFLICT` ou enregistrer selon le mode demandé ;
6. incrémenter `version`, écrire l'audit et valider ;
7. publier une invalidation SSE après commit.

Le MVP adopte une règle stricte : un conflit bloquant empêche l'écriture. Un rôle autorisé peut utiliser `conflictPolicy: "override"`; l'override exige un motif, est audité et apparaît dans la réponse.

## 6. Contrats intermodules et API

### Convention HTTP

- JSON UTF-8 ; noms de champs en `camelCase` ;
- identifiants opaques ; dates ISO 8601 avec offset ;
- listes : `items`, `page`, `pageSize`, `total` ;
- mutations idempotentes lorsque `Idempotency-Key` est fourni ;
- contrôle concurrent optimiste via `version` dans la commande et `409 VERSION_CONFLICT` ;
- aucune information d'une autre société n'est révélée, y compris par les erreurs.

Réponse d'erreur stable :

```json
{
  "error": {
    "code": "PLANNING_CONFLICT",
    "message": "La ressource n'est pas disponible sur cette période.",
    "details": { "conflicts": [] },
    "requestId": "opaque-id"
  }
}
```

### Endpoints du MVP

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

GET    /api/v1/sites
GET    /api/v1/resources
POST   /api/v1/resources
PATCH  /api/v1/resources/:id
GET    /api/v1/clients
POST   /api/v1/clients
GET    /api/v1/projects
POST   /api/v1/projects
PATCH  /api/v1/projects/:id

GET    /api/v1/reservations?siteId=&from=&to=&resourceIds=&status=&projectId=
POST   /api/v1/reservations
GET    /api/v1/reservations/:id
PATCH  /api/v1/reservations/:id
DELETE /api/v1/reservations/:id       # annulation logique
POST   /api/v1/planning/conflicts/check

GET    /api/v1/dashboard/occupancy?siteId=&from=&to=&resourceIds=
GET    /api/v1/events                 # SSE, événements du périmètre autorisé
```

`PATCH /reservations/:id` couvre l'édition, le drag & drop et le redimensionnement. Il reçoit toujours `version`; les champs temporels sont validés ensemble. Les réponses de mutation renvoient la représentation canonique complète.

### Événements internes

Événements versionnés : `reservation.created.v1`, `reservation.updated.v1`, `reservation.cancelled.v1`, `resource.updated.v1`. Leur enveloppe contient `eventId`, `occurredAt`, `companyId`, `siteId`, `entityId`, `entityVersion`. Le SSE sert d'invalidation ; après réception, le client recharge les plages affectées plutôt que de reconstruire l'état depuis l'événement.

## 7. Sécurité

- authentification locale par email/mot de passe ; mot de passe haché avec un algorithme adaptatif disponible dans la stack retenue ; aucun mot de passe en clair, log ou seed de production ;
- session opaque dans un cookie `HttpOnly`, `SameSite=Lax`, `Secure` hors localhost, avec expiration absolue et rotation à la connexion ;
- protection CSRF pour toute mutation ; vérification stricte de l'origine en complément ;
- validation structurée de toutes les entrées et requêtes SQL paramétrées uniquement ;
- autorisation côté serveur sur chaque cas d'usage, jamais fondée sur l'état visuel du frontend ;
- `company_id` injecté depuis la session, jamais accepté comme autorité depuis le client ; `site_id` vérifié contre les affectations ;
- messages d'authentification non discriminants et limitation des tentatives par compte + adresse ;
- notes rendues comme texte, sans HTML non assaini ;
- secrets uniquement via variables d'environnement et fichier local ignoré par Git ;
- journaux sans cookie, jeton, mot de passe ni contenu libre sensible.

Permissions minimales : `core.manage`, `resource.read`, `resource.manage`, `client.manage`, `project.manage`, `planning.read`, `planning.write`, `planning.override_conflict`, `dashboard.read`, `audit.read`. Le seed fournit `admin`, `planner` et `viewer`.

## 8. Performance et observabilité

Charge de référence du MVP : 100 ressources visibles, 10 000 réservations sur la période consultée, 20 utilisateurs locaux concurrents. Les objectifs sur machine de développement standard, base chaude, sont :

- lecture planning semaine p95 < 300 ms côté API ;
- contrôle de conflit + écriture p95 < 250 ms ;
- interaction pan/zoom/drag perceptuellement fluide, cible 60 fps ;
- affichage initial exploitable < 2 s après démarrage local.

Le serveur émet des logs JSON avec `requestId`, route, statut, durée et identité pseudonymisée. Le frontend mesure en développement le temps de rendu. Le planning virtualise les lignes de ressources et ne charge que la fenêtre temporelle visible avec marge. Les requêtes sont annulables et dédupliquées.

## 9. Exploitation locale et évolution

Une commande documentée démarre le serveur et le frontend ; une autre initialise/migre/seed la base ; une troisième exécute tous les tests. La base et les fichiers générés résident dans un répertoire local ignoré par Git. Une sauvegarde consiste à copier SQLite après checkpoint ou via l'API de sauvegarde SQLite.

Avant un déploiement multi-instance, il faudra remplacer SQLite par PostgreSQL, renforcer la stratégie de verrouillage, externaliser les sessions et adopter un bus d'événements. Ces changements sont explicitement hors MVP.

## 10. Risques et parades

| Risque | Impact | Parade MVP |
|---|---|---|
| écritures SQLite concurrentes | contention ou erreurs `busy` | transactions courtes, mode WAL, délai `busy`, un seul processus d'écriture |
| ambiguïtés de fuseau/DST | décalage de réservation | UTC en stockage, fuseau IANA par site, tests sur changements d'heure |
| drag & drop écrasant une modification | perte de mise à jour | version optimiste obligatoire, rechargement et message explicite |
| gros planning saturant le navigateur | UI lente | requête par fenêtre, virtualisation, profilage sur jeu de 10 000 réservations |
| fuite inter-sociétés | incident majeur | filtre serveur systématique, tests négatifs d'isolation, revue sécurité |
| dérive des contrats entre UI/API | régressions | source de schémas partagée, validation runtime et tests de contrat |
| dépendance à des actifs distants | démarrage impossible hors ligne | tous les actifs embarqués, aucune requête CDN/SaaS |
