# Parcours UX — Planning Post Prod

Version UX : `0.1`  
Portée MVP : connexion, navigation, sociétés/sites, ressources, clients, projets, réservations, conflits, vues planning, filtres et dashboard occupation.

## 1. Modèle mental et rôles

L’application relie `Client → Projet → Saison/Épisode → Phase → Réservation → Ressource`. Une réservation est toujours rattachée à un site, une plage temporelle et au moins une ressource. Elle peut être `Option`, `Confirmée`, `Bloquée` ou `Annulée`.

Rôles UX de référence :

| Rôle | Besoin principal | Droits typiques |
|---|---|---|
| Planificateur | organiser et arbitrer | créer, déplacer, confirmer, résoudre conflits |
| Responsable de site | contrôler capacité | tout le site, override justifié, dashboard |
| Opérateur | voir son travail | lecture, commentaires, disponibilité selon règle |
| Administrateur | configurer le périmètre | sociétés, sites, utilisateurs, ressources, permissions |
| Lecteur | suivre | lecture seule, export si autorisé |

L’interface masque les actions interdites. Si une permission change pendant une session, une action devenue interdite échoue sans perdre les données saisies et explique comment les copier/récupérer.

## 2. Navigation globale

Entrée après connexion :

- Si une seule société et un seul site : ouvrir `Planning > Aujourd’hui`.
- Si plusieurs sites : restaurer le dernier périmètre autorisé ; à défaut ouvrir le sélecteur.
- Si aucune ressource n’existe et rôle administrateur : onboarding `Créer le site → Ajouter les ressources → Inviter l’équipe`.
- Si aucune ressource et non administrateur : écran explicatif avec contact administrateur.

Recherche globale `⌘/Ctrl K` : chercher projet, client, réservation, ressource et commande. Résultats regroupés, maximum 5 par groupe, navigation clavier. Sélectionner une réservation ouvre sa date, sa ressource et l’inspecteur.

## 3. Flux A — Connexion et choix du périmètre

### Parcours nominal

1. L’utilisateur saisit ses identifiants ou utilise le SSO.
2. Pendant validation, le bouton conserve son libellé et devient indisponible.
3. Si MFA requis, saisir le code ; autoriser coller et gestionnaire de mots de passe.
4. L’application restaure le dernier site encore autorisé.
5. La page Planning s’ouvre avec annonce `Site X, semaine du …`.

### Exceptions

- Identifiants invalides : erreur générique, focus sur l’alerte, champs conservés sauf mot de passe selon politique.
- Session expirée : modal de reconnexion ; au succès, restaurer filtres et brouillon local si valide.
- Site retiré : sélectionner le premier site autorisé et afficher un bandeau explicatif.
- Hors ligne : lecture du dernier planning en cache si disponible, mutations désactivées et bannière persistante.

### Critères frontend

- Entrée confirme le formulaire ; erreurs reliées aux champs.
- Aucune redirection ouverte via paramètre URL.
- Le site actif est visible dans l’app shell à tout moment.

## 4. Flux B — Créer les données préalables

### B1. Créer un client

Déclencheurs : `Clients > Nouveau client` ou création inline depuis un projet.

1. Ouvrir un drawer avec raison sociale requise, nom court, contacts et notes.
2. À la saisie, rechercher les doublons normalisés ; afficher les correspondances sans bloquer.
3. `Créer` sauvegarde puis confirme par toast.
4. Depuis un projet, le nouveau client est automatiquement sélectionné et le focus passe au champ suivant.

Erreur serveur : conserver le formulaire, afficher l’erreur près de l’action et proposer `Réessayer`.

### B2. Créer un projet

1. Depuis `Projets > Nouveau` ou la création de réservation, sélectionner/créer un client.
2. Saisir nom requis, code facultatif, dates, site principal, couleur d’identification.
3. Les dates incohérentes sont validées inline.
4. Après création : ouvrir la fiche projet ; depuis une réservation, revenir au formulaire avec projet sélectionné.

### B3. Créer une ressource

1. `Ressources > Ajouter` ; choisir type (salle, station, équipement, personne/autre selon modèle).
2. Saisir nom, site, capacité, horaires, indisponibilités récurrentes et couleur facultative.
3. Détecter un nom dupliqué dans le même site ; autoriser avec confirmation si la règle métier le permet.
4. Après création, proposer `Créer une réservation` et `Ajouter une autre ressource`.

## 5. Flux C — Explorer le planning

### Entrée et changement de vue

1. Arrivée sur la dernière vue utilisée, centrée sur aujourd’hui sauf URL explicite.
2. `J`, `S`, `M` changent Jour/Semaine/Mois quand aucun champ n’est actif.
3. Flèches de toolbar changent de période ; `T` revient à aujourd’hui.
4. Le chargement conserve la grille actuelle et affiche un indicateur dans la plage de dates.
5. La sélection, les filtres et la position de scroll sont conservés entre vues lorsque possible.

### Filtres

Filtres MVP : site, département, type de ressource, ressource, client, projet, statut et conflits.

1. Ouvrir `Filtres` (`F`) ; rechercher et sélectionner plusieurs valeurs.
2. L’application applique immédiatement et met à jour l’URL.
3. Une barre résume les critères sous forme de chips supprimables.
4. `Effacer` réinitialise tous les filtres, avec `Annuler` disponible 8 s.
5. Un résultat vide indique quels filtres sont actifs et propose `Effacer les filtres`.

Les vues enregistrées sont hors MVP ; l’URL partageable couvre le besoin initial.

### Sélection et détail

- Clic/Entrée sur une réservation : sélection + drawer, sans navigation complète.
- Flèches précédent/suivant du drawer suivent l’ordre visuel filtré.
- Fermer restaure focus et scroll.
- Un lien `Ouvrir la fiche projet` est disponible sans perdre le contexte (retour vers même URL planning).

## 6. Flux D — Créer une réservation

### Déclencheurs

- Bouton global `Nouvelle réservation` (`C`).
- Sélection/drag d’une plage vide dans une ligne ressource.
- Action depuis une fiche projet ou ressource.

### Parcours nominal

1. Ouvrir le drawer `Nouvelle réservation` avec ressource, date et heure préremplies depuis le contexte.
2. Choisir projet requis (client déduit), phase/épisode facultatif selon configuration.
3. Choisir une ou plusieurs ressources autorisées.
4. Saisir début et fin ; durée calculée et modifiable. Les champs indiquent timezone du site.
5. Choisir statut initial `Option` ou `Confirmée` selon permission.
6. Ajouter opérateurs, notes et référence facultatives.
7. Une vérification de disponibilité débouncée affiche `Disponible`, avertissements ou conflits.
8. Activer `Créer la réservation`. Après succès, fermer ou conserver le drawer selon préférence, sélectionner le bloc créé et afficher un toast.

### Validation

- Projet, ressource, début et fin requis ; fin strictement après début.
- Une réservation multi-ressources est atomique : toutes réussissent ou aucune.
- Les erreurs inline apparaissent au blur et au submit ; au submit, focus sur la première erreur.
- Un conflit bloquant remplace l’action par `Résoudre le conflit`; l’override n’apparaît qu’avec permission.
- Double clic sur `Créer` ne crée jamais de doublon (bouton verrouillé + idempotence backend).

### Création rapide

Le drag sur plage vide ouvre un mini-popover avec projet, statut, horaire et `Créer`. `Plus de détails` ouvre le drawer avec les valeurs conservées. Échap annule sans mutation.

### Succès et suite

Toast : `Réservation créée` avec `Ouvrir` et `Annuler` si la suppression compensatoire est autorisée. La réservation reçoit brièvement un highlight non animé en mode reduced-motion.

## 7. Flux E — Déplacer et redimensionner

### Pointeur

1. Au survol/focus, afficher poignée et curseur adaptés.
2. Au début du drag, mémoriser état initial et annoncer les instructions.
3. Afficher un fantôme dans le créneau cible avec horaire, ressource et différence (`+30 min`).
4. Vérifier localement les collisions connues pendant le mouvement ; vérifier côté serveur au drop.
5. Drop valide : mise à jour optimiste, puis confirmation discrète.
6. Drop invalide : retour à la position initiale, message précis et focus conservé.

### Clavier

1. Focus sur la carte, `M` pour déplacer ou `R` pour modifier la fin.
2. Flèches : 15 min ; `Shift` : 1 h ; `Alt/Option` : 5 min ; `Ctrl/Cmd + haut/bas` : ressource.
3. La région live annonce chaque cible et conflit.
4. Entrée confirme ; Échap restaure exactement l’état initial.

### Concurrence

Si la réservation a changé depuis son chargement : ne pas écraser. Restaurer la version serveur, ouvrir un panneau comparatif court (`Votre changement` / `Version actuelle`) et proposer `Reprendre avec la version actuelle`.

### Mobile

Action `Déplacer` depuis le menu : choisir date, heure, ressource dans une feuille plein écran, prévisualiser les conflits, puis confirmer. Aucun drag obligatoire.

## 8. Flux F — Détecter et résoudre un conflit

### Présentation

Le conflit apparaît simultanément sur la carte, dans le drawer et dans le résumé `Conflits` de la toolbar. Il indique : sévérité, cause, entités concernées, plage exacte et solutions.

### Résolution guidée

1. Cliquer `Voir le conflit`.
2. Ouvrir un panneau listant la réservation concurrente et les règles violées.
3. Proposer, dans cet ordre : créneaux proches disponibles, ressources équivalentes, passage en Option si autorisé, modification manuelle.
4. Prévisualiser la solution dans la grille sans sauvegarde.
5. `Appliquer` relance la vérification serveur, puis sauvegarde.
6. En cas d’override autorisé, demander une justification requise (10–500 caractères) et annoncer que l’action est auditée.

Un conflit résolu disparaît sans supprimer l’historique. Un conflit introduit par une mutation externe déclenche un toast persistant et incrémente le compteur, sans voler le focus.

## 9. Flux G — Modifier, annuler ou supprimer

### Modifier

Drawer détail → `Modifier`. Les données sont revalidées en direct. En quittant avec changements : `Continuer l’édition`, `Ignorer`, `Enregistrer` si valide.

### Annuler

Action métier privilégiée : définir statut `Annulée`, conserver l’historique et demander un motif facultatif/requis selon politique. La carte disparaît des vues par défaut mais reste affichable via filtre.

### Supprimer

Réservé aux erreurs de saisie et permissions dédiées. Dialogue avec projet, ressource et plage ; bouton `Supprimer la réservation`. Succès : toast avec `Annuler` 8 s si restauration possible. Si liée à des objets bloquants, expliquer et proposer `Annuler la réservation`.

## 10. Flux H — Dashboard occupation

1. Entrée sur période `Cette semaine` et site actif.
2. Les KPI chargent indépendamment ; la date de dernière actualisation est visible.
3. Changer période/site met à jour tous les modules et l’URL.
4. Cliquer `Occupation 78 %` ouvre le planning filtré sur la période et les ressources incluses.
5. Cliquer un conflit ouvre directement le drawer de la réservation.
6. En absence de données, expliquer le calcul et proposer `Créer une réservation` ou `Configurer les horaires` selon cause.

Définition visible dans tooltip : `Occupation = heures réservées confirmées / heures disponibles configurées` ; les Options peuvent être activées dans une comparaison distincte, jamais mélangées silencieusement.

## 11. Raccourcis et command palette

| Raccourci | Action |
|---|---|
| `⌘/Ctrl K` | recherche/command palette |
| `C` | nouvelle réservation |
| `T` | aujourd’hui |
| `J / S / M` | jour / semaine / mois |
| `F` | filtres |
| `[` / `]` | période précédente / suivante |
| `E` | éditer la sélection |
| `M` | déplacer la sélection |
| `R` | redimensionner la sélection |
| `Échap` | annuler/fermer le niveau actif |
| `?` | aide raccourcis |

Les raccourcis à une touche sont désactivés lorsqu’un champ ou éditeur possède le focus. Ils sont remappables à terme et toujours doublés par une commande visible.

## 12. États transverses et récupération

| Situation | Comportement attendu |
|---|---|
| sauvegarde lente | état `Enregistrement…`, autres actions incompatibles désactivées |
| erreur réseau | brouillon conservé, `Réessayer`, détails techniques copiables mais repliés |
| perte de connexion | bannière, lecture possible, mutations mises en attente seulement si sûres |
| données supprimées ailleurs | fermer détail, toast explicite, retirer l’élément sans recharger toute la page |
| permission refusée | expliquer le périmètre requis, conserver saisie exportable |
| aucun résultat | nommer filtres/période, proposer réinitialisation |
| gros volume | virtualisation, indicateur de total, recherche serveur |

Les brouillons de formulaires sont gardés localement 24 h, chiffrés/isolés par utilisateur si l’architecture le permet, et supprimés après succès ou déconnexion.

## 13. Scénarios E2E d’acceptation UX

1. **Création complète** : créer client, projet, ressource puis réservation confirmée ; chaque retour garde le contexte et le résultat est visible au planning.
2. **Création rapide** : sélectionner 10:00–12:00 sur Studio A, créer une Option en moins de 20 s et 6 interactions principales.
3. **Déplacement accessible** : déplacer au clavier une réservation de 30 min, confirmer et entendre le nouveau créneau via lecteur d’écran.
4. **Conflit bloquant** : provoquer une double réservation, identifier les deux objets, appliquer une ressource alternative, constater la disparition du conflit.
5. **Concurrence** : deux sessions modifient la même réservation ; la seconde ne perd ni n’écrase silencieusement les données.
6. **Filtres partageables** : filtrer site + ressource + statut, copier l’URL, retrouver la même vue dans une nouvelle session autorisée.
7. **Responsive** : sur `390×844`, consulter l’agenda, créer et déplacer sans drag ni défilement horizontal obligatoire.
8. **Permissions** : un lecteur voit les détails mais aucune action de mutation ; accès direct par URL refusé proprement.
9. **Dashboard** : un KPI ouvre le planning avec période et filtres corrects ; le retour restaure le dashboard.
10. **Résilience** : couper le réseau pendant l’édition ; aucune saisie perdue, reprise possible après reconnexion.

## 14. Instrumentation produit (sans données sensibles)

Événements recommandés : `planning_viewed`, `filter_applied`, `booking_create_started/succeeded/failed`, `booking_moved`, `booking_resized`, `conflict_shown/resolved/overridden`, `dashboard_drilldown`. Propriétés : vue, durée d’action, type de ressource, sévérité, méthode pointeur/clavier/mobile ; exclure noms clients, projets, notes et identifiants personnels. Mesurer taux de succès, temps médian de création et abandon par étape.

