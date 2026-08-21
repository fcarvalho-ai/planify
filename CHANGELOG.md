# Changelog

## 0.2.0-rc1 — 2026-08-21

- fondations V1 G0 : contrats partagés, RBAC et scopes société/site/projet/entité, idempotence, audit, SSE et OpenAPI ;
- référentiels V1 G1 : Clients, Projets, responsables, catégories de ressources, tarifs hiérarchisés, recherche universelle et analytics ;
- noyau Planning/Commercial G2 : réservations liées au Projet, devis accepté exploitable, virtualisation 250 ressources / 10 000 réservations et scrolling natif ;
- interactions Planning G3 : cinq vues, grille horaire IANA/DST, création, déplacement et redimensionnement souris/clavier, snapping et focus accessible ;
- continuité Planning/Devis G4 : sélection rectangulaire, copie/collage, lots atomiques, annuler/rétablir, autosave et écarts commerciaux ;
- ressources avancées G5 : doubles options isolées, ressources génériques, compétences et indisponibilités, présence multi-opérateur et synchronisation SSE ;
- isolation inter-site des indisponibilités Personnel, permissions SSE fail-closed et connexions bornées ;
- migrations Sprint 1 et Sprint 5 sauvegardées, vérifiées et accompagnées de procédures de rollback avec export privé ;
- gates G0 à G5, Integration et E2E approuvés sans P0/P1 ; suite finale 260/260, lint et build locaux verts.

## 0.2.0-alpha.1 — 2026-08-14

- architecture cible globale et roadmap incrémentale formalisées ;
- module Stock 07a : articles, exemplaires, emplacements et grand livre signé ;
- disponibilité physique, allocations liées au planning et libérations idempotentes ;
- maintenance depuis disponible ou quarantaine, avec audit et SSE ;
- migration RC1 v1→v2 atomique et sauvegarde vérifiable ;
- interface Parc matériel, Stock et Maintenance avec RBAC, filtres et drawers accessibles ;
- durcissement Origin, revalidation des replays et révocation des flux SSE ;
- 51 tests domaine, API, Stock, migration, sécurité et intégration.

## 0.1.0-rc1 — 2026-08-14

- shell professionnel responsive, connexion locale et navigation ;
- planning jour, semaine et mois avec filtres combinés ;
- création, édition, déplacement, redimensionnement et annulation logique ;
- contrôle de capacité cumulée et détection des conflits semi-ouverts ;
- clients, projets, ressources, sites et données de démonstration ;
- dashboard d’occupation pondéré ;
- API versionnée, sessions, CSRF, RBAC, isolation de périmètre, audit, SSE et concurrence optimiste ;
- persistance locale atomique et fallback prototype explicite ;
- 19 tests de domaine automatisés.
