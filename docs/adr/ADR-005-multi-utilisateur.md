# ADR-005 — Concurrence multi-utilisateur

Statut : adopté — 2026-08-19

Toute entité modifiable porte une `version`. Une commande obsolète reçoit `409 VERSION_CONFLICT` avec une projection sûre. L'idempotence est liée à l'acteur, la société, la commande, la cible et le digest du payload. Les événements d'invalidation sont émis après commit et l'autorisation est revalidée en direct.
