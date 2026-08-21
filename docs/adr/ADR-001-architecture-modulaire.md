# ADR-001 — Monolithe modulaire incrémental

Statut : adopté — 2026-08-19

## Décision

Conserver le processus Node.js/CommonJS et la persistance JSON de la RC1 pendant le Sprint 0, tout en introduisant des packages sans I/O pour les contrats transverses. Les dépendances vont du HTTP vers les cas d'usage, puis vers le domaine. Aucun package de domaine ne dépend de `server.js`, du DOM ou du stockage.

## Modules

- `packages/shared` : erreurs et enveloppes API ;
- `packages/auth` : rôles, permissions et scopes ;
- `packages/events` : événements persistables et rejouables ;
- `packages/audit` : entrées append-only ;
- `packages/scheduling` : temps, chevauchements et capacité ;
- `packages/pricing` : résolution tarifaire ;
- `packages/quote-consumption` : vendu, planifié, réalisé et dépassement.

## Conséquences

Les modules existants restent utilisables. La migration physique vers `apps/`, SQLite ou TypeScript exige un plan séparé, des migrations et un rollback. Aucun microservice n'est introduit.
