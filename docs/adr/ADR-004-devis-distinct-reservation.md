# ADR-004 — Devis distinct de la réservation

Statut : adopté — 2026-08-19

Un devis est une proposition commerciale et une réservation une allocation opérationnelle. `QuoteLine -> 0..n Reservation`. Le devis accepté conserve ses lignes et son snapshot fiscal. La consommation planning est calculée séparément ; un dépassement prépare un devis complémentaire au lieu de réécrire l'historique.

Mapping transitoire RC1 : `organizationAdmin -> ADMIN`, `planner -> PLANNER`, `viewer -> READ_ONLY`. Les rôles V1 plus fins sont créés sans promotion implicite.
