# ADR-007 — RBAC et périmètres V1

Statut : adopté — 2026-08-19

Le catalogue système contient exactement sept rôles standards : `ADMIN`, `PLANNING_MANAGER`, `PLANNER`, `SALES`, `PROJECT_MANAGER`, `FINANCE` et `READ_ONLY`. Ils sont créés par une migration additive, authentifiée par sauvegarde et digests, puis automatiquement installés pour toute nouvelle société. Ils sont non modifiables ; des rôles personnalisés peuvent coexister.

L'autorité effective vient des rôles reliés à la membership active. `ADMIN` porte le joker serveur `*`; les autres rôles utilisent une liste fermée. Les rôles historiques `organizationAdmin`, `planner` et `viewer` restent temporairement disponibles pour la compatibilité RC1, sans devenir la norme V1.

Le serveur intersecte chaque permission avec `companyId` issu de la session et le périmètre de membership. Une entité d'une autre société, d'un site non autorisé ou d'un projet explicitement exclu répond comme absente. L'interface ne constitue jamais une autorité d'accès.

Rollback : retirer uniquement les rôles V1 créés par le marqueur `foundation-00-rbac-catalog-v1` s'ils ne sont reliés à aucune membership. La sauvegarde byte-for-byte reste la preuve de l'état source ; les rôles historiques ne sont ni supprimés ni modifiés par cette migration.
