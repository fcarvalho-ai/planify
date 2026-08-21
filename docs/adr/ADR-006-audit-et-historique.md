# ADR-006 — Audit et historique

Statut : adopté — 2026-08-19

L'audit est append-only. Une entrée contient acteur, société, action, type et identifiant de cible, date UTC, `error_id`, versions avant/après et détails structurés minimaux. Les secrets, cookies, contenus de fichiers clients, identifiants fiscaux complets et données libres sensibles sont interdits. Les événements de domaine ne remplacent pas l'audit : ils servent l'intégration et le rejeu, l'audit sert la preuve.
