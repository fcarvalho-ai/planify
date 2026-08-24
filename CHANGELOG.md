# Changelog

## Non publié — 0.5.0-rc5-dev

- correction du scroll horizontal des vues 6 semaines, Mois et 3 mois : la virtualisation et le CSS partagent désormais la même largeur de colonne ;
- largeur totale de période figée pendant les reconstructions virtuelles, afin que les dernières dates restent atteignables en un seul défilement ;
- les vues longues conservent leurs 31/42/92 colonnes montées et ne reconstruisent plus la grille pendant le geste horizontal ;
- recette navigateur en plein écran et mode normal jusqu’aux dates terminales, avec 12 déplacements continus en 337 ms, suite complète 343/343, lint et build verts.

## 0.5.0-rc4 — 2026-08-24

- correction du parcours Projet → Planning : plusieurs réservations d’une même salle/date restent dans leur ligne ;
- cartes empilées compactes, hauteur bornée à trois cartes puis défilement local, y compris en heure et demi-journée ;
- rendu borné à 50 cartes par cellule avec compteur accessible des réservations supplémentaires ;
- index `ressource × créneau` construit en une passe, remplaçant le rescan de toutes les réservations pour chaque cellule ;
- gestionnaire de scroll aligné sur les dimensions réellement rendues ; demi-journées hors plage 09:00–18:00 exclues ;
- recette navigateur « Le Grand Format » : deux cartes de 58 px dans une ligne de 132 px, sans couverture ;
- REVIEW, QA, SECURITY et PERFORMANCE approuvés sans P0/P1 ; suite finale 341/341, lint et build verts ; benchmark 10k distribué p95 40,63 ms et scénario long 1 064,73 ms.

## 0.5.0-rc3 — 2026-08-24

- correction du scroll vertical du Planning : les réservations restent sous la ligne sticky des dates ;
- hiérarchie d’empilement consolidée entre événements, focus clavier, dates, colonne Ressources et angle fixe ;
- scroll vertical et horizontal, synchronisation des axes et virtualisation contrôlés sans régression ;
- recette navigateur réelle à `scrollTop=70`, dates au premier plan et console sans erreur ;
- REVIEW, QA, SECURITY et PERFORMANCE approuvés sans P0/P1 ; suite finale 340/340, lint et build verts.

## 0.5.0-rc2 — 2026-08-24

- correction du design system : alias sémantiques partagés par Pilotage, Réalisations et Finance ;
- onglets Pilotage actifs à nouveau lisibles, contraste texte/fond `4,86:1` ;
- contours et surfaces des écrans Réalisations et Finance restaurés ;
- focus clavier Pilotage renforcé à 3 px, contraste minimal `4,16:1` ;
- recette navigateur des six onglets et des écrans affectés sans erreur console ;
- REVIEW, QA, SECURITY et PERFORMANCE approuvés sans P0/P1 ; suite finale 340/340, lint et build verts.

## 0.5.0-rc1 — 2026-08-24

- six dashboards adaptés aux rôles : Direction, Finance, Planning, Commercial, Exploitation et Chef de projet ;
- KPI versionnés, définis et réconciliables avec filtres partageables, fraîcheur, sources et drill-down paginé ;
- exports Planning Excel/PDF et KPI Excel locaux, bornés et protégés par permissions et scopes ;
- API Analytics/BI JSON/CSV sur dix datasets, pagination, limites explicites et neutralisation des formules ;
- confidentialité des coûts et marges de bout en bout, matrice HTTP réelle 7 rôles × 6 dashboards × 3 parcours ;
- overrides de conflits centralisés, motivés, audités, idempotents et revalidés au rejeu ;
- surfaces authentifiées fail-closed sur toutes les routes : shell et overlays masqués, `inert` et contenu métier purgé après logout ou `401` ;
- REVIEW, QA, SECURITY, PERFORMANCE, INTEGRATION et E2E approuvés sans P0/P1 ; suite finale 339/339, lint et build verts.

## 0.4.0-rc1 — 2026-08-24

- registre des réalisations distinct du planning, confirmation et corrections append-only, rapprochement prévu/planifié/réalisé/facturable ;
- coûts internes datés, dépenses Projet versionnées et instantanés historiques empêchant toute réécriture des marges passées ;
- projections financières Backlog, Forecast 30/60/90 jours, Revenue Chain et marges avec traçabilité Devis/version/ligne ;
- capacité nette, occupation planifiée/réelle, seuils société/site versionnés, rentabilité multidimensionnelle et réalisé non facturé actionnable ;
- déduction déterministe des doubles options après filtrage des droits et exclusion des options perdues ;
- confidentialité Finance de bout en bout : permissions dédiées, projections API/UI, audit expurgé et isolation société/site/projet/client/devis/ressource/prestation ;
- migrations Sprint 7 Réalisations, Finance et Occupation avec sauvegardes privées vérifiées et rollbacks byte-exacts précédés d’un export obligatoire ;
- REVIEW, QA, SECURITY, PERFORMANCE, INTEGRATION et E2E approuvés sans P0/P1 ; suite finale 312/312, lint, build et OpenAPI verts.

## 0.3.0-rc1 — 2026-08-23

- PlanyBot contextuel : dialogue local, résumés Projet, conflits, disponibilité et recommandations de ressources explicables ;
- cycle sécurisé « PlanyBot propose, l’humain confirme, le moteur exécute », sans réservation ni écriture commerciale silencieuse ;
- propositions persistées, expirables et idempotentes, avec revalidation des droits, sites, Projets, ressources, versions et disponibilités au moment de confirmer ;
- analyse locale et bornée de plannings clients Excel/CSV/PDF texte, avec corrections humaines versionnées avant application ;
- provenance compacte des faits PlanyBot, historique et rejeu invalidés après révocation de permission ou réduction de scopes ;
- audit complet préparation/refus/confirmation/exécution, synchronisation SSE et persistance après redémarrage ;
- migration Sprint 6 avec sauvegarde privée vérifiée et rollback byte-exact précédé d’un export obligatoire ;
- REVIEW, QA, SECURITY, PERFORMANCE, INTEGRATION et E2E approuvés sans P0/P1 ; suite finale 270/270, lint et build verts.

## 0.2.0-rc2 — 2026-08-22

- page Équipe opérationnelle indépendante de l’onboarding Organisation : annuaire, compétences et indisponibilités ;
- annuaire Personnel minimal protégé par `planning.read`, isolé par société et périmètre de site, sans exposition des rôles, e-mails ou scopes ;
- gouvernance des accès maintenue sous `membership.read` et mutations Personnel sous `planning.write` ;
- contrôle navigateur réel avec le rôle Planificateur : deux membres autorisés et sélecteurs Personne renseignés ;
- REVIEW, QA, SECURITY et PERFORMANCE approuvés sans P0/P1 ; suite finale 262/262, lint et build verts.

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
