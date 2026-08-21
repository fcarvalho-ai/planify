# Architecture V1 — vue d’ensemble

Statut : candidat Gate G0 — 2026-08-19

```text
index.html + app.js + styles.css/planning.css
                  |
                  v
          API HTTP JSON /api/v1
                  |
      +-----------+-----------+
      |           |           |
 Scheduling   Pricing   QuoteConsumption
   Engine      Engine         Engine
      |           |           |
      +-----------+-----------+
                  |
       server.js : auth, RBAC, audit,
       événements, SSE, mutations atomiques
                  |
          data/planify.json (RC1)
```

Le runtime reste volontairement CommonJS, mono-processus et autonome pendant le Gate G0. Les frontières exécutables résident sous `packages/`. `server.js` demeure l’adaptateur HTTP et le writer unique du fichier JSON. La cible TypeScript/React/SQLite de `docs/architecture.md` nécessite une migration séparée, sauvegardée et réversible.

## Autorités

- Le serveur est l’unique autorité des droits, périmètres, dates, capacités, tarifs et consommations.
- `SchedulingEngine` valide intervalles, quantité, disponibilité et capacité.
- `PricingEngine` applique projet, puis client, puis catalogue.
- `QuoteConsumptionEngine` sépare vendu, planifié, réalisé et dépassement.
- PlanyBot ne fait que préparer ou expliquer une commande soumise ensuite aux mêmes contrôles serveur.

## Flux d’une mutation sensible

Authentification → RBAC et scopes → validation → idempotence/version → mutation atomique → audit et événement persisté → notification SSE après succès.

## Limites RC1

Le JSON atomique protège un seul processus local, pas plusieurs instances. La production, la base relationnelle, les secrets administrés et le monitoring externe sont hors Sprint 0 et ne peuvent pas être activés par simple configuration.
