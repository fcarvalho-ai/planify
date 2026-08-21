# ADR-003 — Autorité SchedulingEngine

Statut : adopté — 2026-08-19

`SchedulingEngine` est l'unique autorité de chevauchement, capacité et disponibilité. Création, déplacement, redimensionnement, duplication et conversion Devis→Planning utilisent le même contrat. Le moteur reçoit des données déjà bornées au tenant, mais vérifie la cohérence société/site/projet des allocations. Un conflit bloque par défaut ; l'override exige permission et motif audité.
