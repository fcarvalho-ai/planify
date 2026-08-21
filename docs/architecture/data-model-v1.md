# Modèle de données conceptuel V1

Statut : candidat Sprint 0 — persistance JSON RC1, mapping relationnel cible

| Agrégat | Clé et relations | Invariants structurants |
|---|---|---|
| User | `id`, memberships vers Company, Role et scopes | actif, email normalisé, aucune autorité tenant dans la requête |
| Role | `id`, `companyId`, code V1, permissions | catalogue fermé, affectation explicite, aucune promotion de migration |
| Client | `id`, `companyId`, contacts 0..n, grilles 0..n | code unique par société, archivage logique |
| Project | `id`, `companyId`, `clientId`, sites autorisés | Client actif, société identique, référence obligatoire du Planning |
| Site | `id`, `companyId`, fuseau IANA | société identique à toute ressource/réservation |
| Service | `id`, `companyId`, unité interne | actif pour être proposé au catalogue |
| Resource | `id`, `companyId`, `siteId`, capacité | capacité positive, disponibilité déléguée au SchedulingEngine |
| PricingGrid | `id`, portée catalogue/client/projet, période | une seule portée, version, devise |
| PricingLine | grille, source, unité, prix mineur | priorité projet > client > catalogue, période semi-ouverte |
| Budget | projet, lignes, versions | indépendant du Planning, ne contribue pas directement au CA |
| Quote | projet, client snapshot, fiscal snapshot | `QuoteLine -> 0..n Reservation`, historique commercial immuable |
| Reservation | projet, site, intervalle, allocations | projet obligatoire, `[start,end)`, capacité cumulée, version |
| AuditLog | société, acteur, action, cible, `error_id` | append-only, détails assainis |
| DomainEvent | séquence, type, société, cible, payload | append-only, ordre monotone, rejeu borné au tenant |

## Conventions

- Identifiants opaques ; JSON `camelCase`, cible SQL `snake_case`.
- Instants UTC ISO 8601, dates métier `YYYY-MM-DD`, fuseau IANA sur Site.
- Montants en unités mineures sous forme de chaînes entières ; aucun flottant financier.
- Toute entité concurrente porte `version >= 1`, `createdAt`, `updatedAt`.
- Les suppressions métier sont logiques sauf données éphémères explicitement documentées.

## Migration cible

Le passage JSON→SQLite sera une migration dédiée : sauvegarde byte-for-byte, digest source, création du schéma, import transactionnel, comptages par table, projection métier comparée, marqueur signé par digest, reprise idempotente et rollback testé. Sprint 0 ne transforme aucune donnée utilisateur.
