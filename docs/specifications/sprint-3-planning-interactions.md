# Sprint 3 V1 — Interactions Planning

Date de cadrage : 2026-08-21  
Gate de sortie : `G3 — Planning manipulable`

## 1. Autorité et objectif

Cette spécification traduit les lignes Sprint 3 du Backlog V1 et l'Ordre de lancement V1 sans modifier leur séquence métier. Elle complète `docs/spec-mvp.md`, `docs/architecture.md` et le noyau G2 approuvé.

L'objectif G3 est de permettre à un planificateur de créer, déplacer, redimensionner et parcourir des réservations dans les vues Jour, Semaine, 6 semaines, Mois et 3 mois, sans incohérence de dates, de ressources, de capacité, de droits ou d'historique.

La règle PO plus récente reste prioritaire sur l'ancien texte MVP : toute réservation exige un `projectId` actif, appartenant à la société et au site autorisés. Le runtime demeure le monolithe local CommonJS/JSON ; aucune migration React, TypeScript, SQLite ou dépendance distante n'est incluse.

## 2. Périmètre canonique

| Story | Capacité | Critère testable |
|---|---|---|
| US-025 | Vue Jour | granularité horaire configurable, date et sélection exactes |
| US-026 | Vue Semaine | sept jours, week-end distingué sur toute la hauteur, horizontal stable |
| US-027 | Vue 6 semaines | quarante-deux jours lisibles et virtualisés |
| US-028 | Vue Mois | mois civil, réservations multi-jours sans ambiguïté |
| US-029 | Vue 3 mois | capacité à moyen terme, navigation fluide deux à trois mois en avance |
| US-030 | Aller à une date | date future atteinte en une action |
| US-031 | Centre temporel | changement de vue sans perdre la date observée |
| US-032 | Plein écran | planning maximisé, PlanyBot repliable, sortie restaurée par bouton/Échap |
| US-035 | Création souris | clic-glisser, ghost, dates exactes, popover léger, aucune écriture avant confirmation |
| US-036 | Déplacement | horizontal, vertical et diagonal, durée conservée, UI optimiste avec rollback |
| US-037 | Redimensionnement | bords gauche/droit, durée visible, validation serveur et recalcul PlanyBot |
| US-043 | Week-end ON/OFF | vendredi→lundi vaut 2 jours si OFF, 4 si ON |
| US-044 | Jours fériés | calendrier national/site et résultat reproductible |
| US-045 | Temps | jour, demi-journée et heure selon prestation/ressource |
| US-046 | Snapping | pas horaire en Jour, demi-journée/jour dans les vues longues, sans dérive pixel/date |
| US-047 | Ghost | destination et durée visibles, aucune mutation avant validation finale |

Sont exclus : facturation/encaissement, optimisation autonome PlanyBot, mobile, connecteurs externes, Planning Location complet et migration de stack.

## 3. Contrat temporel

- Stockage UTC, saisie et affichage dans le fuseau IANA du site.
- Intervalles semi-ouverts `[startsAt, endsAt)` ; deux réservations adjacentes ne sont pas en conflit.
- `option`, `confirmed`, `unavailable` et `maintenance` consomment la capacité ; `draft`, `completed` et `cancelled` ne la consomment pas.
- `completed` et `cancelled` sont terminaux.
- La date centrale, et non le premier pixel visible, est l'autorité lors d'un changement de vue.
- Pas de snapping : Jour = 60 minutes par défaut, configurable à 30 minutes ; Semaine = demi-journée ou jour selon la prestation ; 6 semaines/Mois/3 mois = jour.
- Un jour férié est identifié par `holidayCalendarId` du site et une date ISO. Sa consommation opérationnelle reste celle d'un jour ; sa règle commerciale est versionnée séparément et ne réécrit pas les devis acceptés.

## 4. Commandes et validations serveur

Les interactions graphiques consomment les commandes canoniques existantes `POST /api/v1/reservations`, `PATCH /api/v1/reservations/:id`, déplacement de cellule et duplication. Une évolution de période ou de ressource passe toujours par :

1. authentification, CSRF et Origin ;
2. `planning.write`, société, site, projet et `entityScopes.resource` ;
3. validation de `version`, dates, statut, ressources et capacité ;
4. contrôle de conflit ou override motivé selon permission ;
5. écriture atomique et idempotente ;
6. audit avant/après avec opération/origine ;
7. SSE après commit ;
8. rollback visuel si la réponse échoue.

La prévisualisation ghost ne déclenche aucune mutation. Les appels de vérification restent sans effet de bord. Une réponse `409 VERSION_CONFLICT` ou `409 PLANNING_CONFLICT` restaure la représentation serveur et fournit un message actionnable.

## 5. Modèle additif

Le modèle Réservation existant reste l'autorité. Le Sprint 3 peut ajouter uniquement :

- `timeGranularity`: `hour | halfDay | day` ;
- `snapMinutes`: entier borné et compatible avec la granularité ;
- `holidayCalendarId`: identifiant optionnel résolu dans la société/site ;
- métadonnées d'interaction dans l'audit, jamais dans le calcul métier.

Les vues, ghosts, sélections et positions de pointeur restent des états frontend non persistés. Aucun pixel ou index de colonne ne devient une donnée métier.

Toute migration éventuelle est additive, marquée, sauvegardée et rejouable. Les champs historiques reçoivent des valeurs déterministes sans modifier dates, ressources, statuts ou liens commerciaux. Le rollback exige un export de reprise et restaure les octets source ; aucune perte silencieuse n'est admise.

## 6. UX et accessibilité

- Une seule zone de scroll verticale native synchronise Ressources et cellules ; l'axe horizontal reste visible et utilisable à la molette, au trackpad et au clavier.
- Les handles de resize sont invisibles au repos mais détectables au survol/focus, avec curseur et libellé accessibles.
- Toute interaction souris possède une alternative clavier et conserve un focus visible.
- Le ghost associe forme, libellé et période ; aucun état n'est communiqué par la couleur seule.
- Les week-ends et jours fériés utilisent un fond vertical continu avec texte/infobulle.
- PlanyBot informe et recommande ; il ne valide ni ne crée seul une réservation.

## 7. Performance et sécurité

Le dataset reste 250 ressources / 10 000 réservations. Les seuils G2 restent contraignants : lecture API p95 `<300 ms`, conflit et écriture p95 `<250 ms`, UI interactive `<2 s`. Les vues 3 mois et 6 semaines doivent conserver un DOM borné par virtualisation, sans reconstruction à chaque cran de molette.

Les identifiants devinés hors société/site/projet/ressource répondent `404`. Les payloads de drag/resize sont non fiables et intégralement revalidés côté serveur. Les libellés injectés dans le ghost et les messages sont échappés.

## 8. Incréments DEV

1. **S3-A — Vues et navigation** : US-025 à US-032, centre temporel, vue 3 mois, plein écran et régression scroll.
2. **S3-B — Création et ghost** : US-035, US-046, US-047, création souris/keyboard sans mutation anticipée.
3. **S3-C — Déplacement et resize** : US-036/037, optimiste contrôlé, rollback, conflits et PlanyBot.
4. **S3-D — Calendrier métier** : US-043 à US-045, week-end, jours fériés et granularités.

Chaque incrément inclut tests positifs/négatifs, documentation et mise à jour de statut. Une correction de gate revient à DEV puis repasse les gates impactés.

## 9. Critères Gate G3

G3 est `APPROVED` uniquement si, sur un candidat unique :

- les cinq vues gardent la date centrale et rendent les périodes exactes ;
- création, déplacement et resize fonctionnent par souris et clavier ;
- aucun ghost ne persiste avant confirmation ;
- conflits, version obsolète, terminalité et scopes échouent sans mutation ;
- week-end ON/OFF, jour férié, heure et demi-journée ont des résultats reproductibles ;
- reload/redémarrage conserve les réservations validées ;
- 250/10 000 respecte les seuils sans gel ni désalignement ;
- REVIEW, QA, SECURITY et PERFORMANCE concluent à zéro P0/P1 ;
- le parcours E2E `connexion → date → création → déplacement → resize → conflit → reload` est documenté.

