# Sécurité V1

Statut : candidat Gate G0 — 2026-08-19  
Décision RBAC : `docs/adr/ADR-007-rbac-et-perimetres-v1.md`

## Authentification et session

Sessions opaques, cookie `HttpOnly`, `SameSite=Lax`, `Secure` hors loopback, expiration et révocation à la déconnexion. Les mutations navigateur exigent CSRF et une Origin exacte autorisée.

## Autorisation

Sept rôles standards : `ADMIN`, `PLANNING_MANAGER`, `PLANNER`, `SALES`, `PROJECT_MANAGER`, `FINANCE`, `READ_ONLY`. Les permissions effectives proviennent des memberships et rôles actifs. Les scopes société/site/unité/projet sont intersectés côté serveur ; aucun tenant envoyé par le navigateur ne devient une autorité.

## Données et sorties

Validation et bornes sur les entrées, HTML échappé, erreurs non discriminantes, fichiers statiques en liste blanche. Cookies, jetons, mots de passe, fichiers clients et identifiants fiscaux complets sont exclus des logs et événements SSE.

## Migrations

La migration du catalogue RBAC est additive et rejouable : sauvegarde `0600`, digest source, projection de sortie et intégrité du marqueur. Toute altération du catalogue migré provoque `MIGRATION_MARKER_CONFLICT`.

## Observabilité protégée

Les logs JSON portent `correlationId`, `requestId`, utilisateur authentifié, opération, route, statut et durée. `/api/v1/technical-metrics` est réservé à `audit.read` et ne contient aucune donnée métier libre.
