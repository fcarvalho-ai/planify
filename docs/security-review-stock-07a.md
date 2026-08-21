# Revue sécurité indépendante — Stock 07a

Date : 2026-08-14  
Périmètre : `server.js`, `app.js`, `tests/stock.test.js`, migration JSON v1 → v2, API/SSE et exposition statique Stock 07a  
Références : `AGENTS.md`, `docs/spec-rental-stock.md`, `docs/architecture.md`, `docs/qa-plan-0.2.md`  
Reviewer : Agents 10+11 indépendants (aucune modification du code ni des tests)

## Verdict final

**APPROVED**

Les deux P1 et le P2 du rapport initial sont corrigés et fermés par inspection puis revalidation dynamique. Aucun P0/P1 sécurité ne reste ouvert sur Stock 07a. Les origines sont contrôlées sur le login et les mutations, un replay idempotent réautorise sa cible et reste scellé à l'acteur, et les clients SSE sont revalidés lors des émissions/heartbeats puis fermés au logout, à l'expiration ou à la révocation.

## Environnement et preuves fraîches

Environnement : macOS 26.5.2, Apple M1 Max, 64 Gio, Node.js v26.6.0. Tous les probes utilisent un port loopback et un fichier `PLANIFY_DATA_FILE` temporaire supprimé après exécution ; `data/planify.json` n'a pas été modifié.

- `node --check server.js && node --check app.js` : succès.
- `npm test` hors sandbox, le 2026-08-14 : **47 tests, 47 succès, 0 échec**, durée 2,921 s.
- Probe Origin login/mutations : origine hostile, origine `null` et requête navigateur sans `Origin` refusées `403 ORIGIN_INVALID`; login et mutation same-origin acceptés `200`/`201`; client Node sans `Origin` depuis loopback accepté `200` conformément à la politique locale.
- Probe idempotence : ouverture `201`, clôture `200`, rejeu légitime du même acteur et même périmètre `200`; après réduction de l'acteur à Paris, rejeux ouverture et clôture Boulogne `404 NOT_FOUND`; rejeu par un autre acteur Paris `404 NOT_FOUND`.
- Intégrité après les trois replays refusés : mouvements `22 → 22`, audits `3 → 3`, enregistrements d'idempotence `2 → 2`.
- Probe SSE : logout `204` puis flux terminé (`done: true`); utilisateur désactivé puis émission, flux terminé; horloge avancée de 9 h puis émission, session expirée et flux terminé.
- Probe réduction de site SSE avec émetteur autorisé sur Paris et Boulogne : création Boulogne `201`, aucun événement reçu après 350 ms par le client réduit à Paris; création Paris `201`, événement Paris reçu dans le même flux.

## Fermeture des constats

### [FERMÉ — ex-P1] Replay idempotent de maintenance inter-site/inter-acteur

`validateIdempotentTarget` est désormais exécuté avant toute restitution idempotente. Pour l'ouverture, il exige `maintenance.manage` puis résout l'asset avec `stockAssetFor`; pour la clôture, il résout le dossier et exige que son asset reste autorisé. Les enregistrements sont recherchés et persistés avec `companyId + actorUserId + command + targetId + key`, et le hash du payload reste vérifié.

La reproduction initiale ne fonctionne plus : le même acteur après retrait du site Boulogne et un acteur Paris distinct reçoivent chacun `404`, sans mouvement, audit ou record idempotent supplémentaire. Le rejeu légitime avant réduction continue de restituer le résultat initial sans doublon.

### [FERMÉ — ex-P1] Contrôle strict de l'origine

Le login contrôle maintenant l'origine avant de lire les identifiants. Toutes les autres mutations passent par `mutationGuard`, qui vérifie d'abord `originAllowed`, puis le CSRF. La liste autorisée comprend l'origine loopback exacte calculée depuis le protocole/hôte et les origines explicitement configurées dans `PLANIFY_ALLOWED_ORIGINS`; `null`, les formes non canoniques et les origines étrangères sont refusées.

La politique originless reste bornée : un client non navigateur est admis seulement depuis loopback, sauf activation explicite de `PLANIFY_ALLOW_ORIGINLESS_MUTATIONS`; un client de type navigateur sans `Origin` est refusé. Le probe démontre simultanément les refus hostiles et les parcours positifs same-origin/CLI.

### [FERMÉ — ex-P2] SSE après logout, expiration, révocation ou réduction de site

Chaque client SSE conserve son token et est revalidé sur chaque émission et heartbeat : session toujours présente et identique, expiration, utilisateur actif, société et sites relus depuis la base. Le logout ferme immédiatement tous les flux du token. Une session expirée ou un utilisateur désactivé est supprimé/fermé; une réduction de sites met à jour l'autorisation du flux sans divulguer les événements retirés.

Les quatre comportements ont été vérifiés dynamiquement. Le cas de réduction est particulièrement probant : l'événement Boulogne commité n'arrive pas au client Paris, alors que l'événement Paris suivant arrive bien, ce qui exclut à la fois la fuite et une fausse réussite due à une fermeture générale du flux.

## Autres contrôles confirmés

- Auth/RBAC : session opaque aléatoire, cookie `HttpOnly; SameSite=Lax`, `Secure` en production, permissions serveur distinctes `equipment.*`, `stock.*`, `maintenance.*`; viewer refusé sur mutations dans la suite fraîche.
- Isolation : `companyId` vient de la session ; assets, emplacements, balances, mouvements et maintenances sont filtrés par société/sites ; les identifiants directs hors site répondent génériquement `404`.
- Grand livre : aucune route publique n'accepte `entries`; legs construits côté serveur, catalogues type/compte fermés, séquences et soldes négatifs validés, aucun PATCH/DELETE de mouvement. La route d'ajustement avancé reste absente (`404`).
- Idempotence allocation/libération : cible réautorisée, même clé + même payload rejouée sans doublon, payload différent refusé `409 IDEMPOTENCY_CONFLICT`, seconde libération refusée sans solde négatif.
- XSS UI Stock : données métier libres rendues via `esc(...)` ou `textContent`; enums injectés dans classes/statuts validés côté serveur. Aucun sink exploitable identifié.
- Statique/migration : liste blanche de cinq actifs publics ; sources serveur, configuration, dépôt et données/backup hors exposition. Backup de migration créé en `0600` par écriture exclusive puis renommage.
- Logs/SSE : logs limités aux métadonnées techniques; enveloppes SSE sans motif, notes, cookie ou CSRF et filtrées société/site après revalidation.
- Dépendances : aucune dépendance npm externe déclarée.

## Limites et recommandation non bloquante

- Les scénarios correctifs détaillés ont été exécutés comme probes indépendants temporaires et ne figurent pas encore comme tests de non-régression nommés dans `tests/stock.test.js`. Leur ajout au prochain lot est recommandé afin de figer Origin, replay cross-site/inter-acteur et révocation SSE dans `npm test`.
- La configuration distante via `PLANIFY_ALLOWED_ORIGINS` n'a pas été testée avec terminaison TLS réelle ; la comparaison canonique et le rejet par défaut ont été inspectés. La RC locale loopback, cible de cet incrément, est couverte dynamiquement.
