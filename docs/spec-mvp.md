# Spécification fonctionnelle — MVP Planning Post Prod 0.1

Statut : base de développement et de validation  
Date : 2026-08-14

## 1. Objectif produit

Permettre à une société de post-production de visualiser et gérer l'occupation de ses ressources par site, de rattacher les réservations à des clients et projets, et d'éviter les conflits de capacité dans une interface professionnelle utilisable au quotidien.

Le MVP est livré comme une application locale de démonstration complète. Le Gate 01 n'est atteint que si les parcours métier fonctionnent de bout en bout dans l'interface, pas seulement via l'API.

## 2. Périmètre livré

### Inclus

- connexion et déconnexion ;
- navigation principale et sélection de site ;
- consultation des sociétés, sites et utilisateurs utiles au contexte ;
- création et modification de ressources ;
- création de clients et projets ;
- planning jour, semaine et mois ;
- création, consultation, modification et annulation de réservations ;
- déplacement par drag & drop et modification de durée ; le déplacement précis d’une cellule reste disponible pour une réservation en option ou confirmée, sur l’axe des salles comme sur l’axe des dates, et ne déplace pas les autres cellules de sa période ;
- réservation d'une ou plusieurs ressources ;
- statuts option, confirmé et annulé ;
- détection et présentation des conflits ;
- filtres par site, ressource, type, projet et statut ;
- dashboard d'occupation ;
- rafraîchissement entre onglets/utilisateurs locaux ;
- permissions, isolation société/site et audit des mutations sensibles.
- catalogue articles SAGE local et versionné : références dans les devis, snapshots historiques et dimensions analytiques stables ; la connexion effective au module de facturation SAGE reste hors périmètre.

### Hors périmètre

- location, stock, logistique et finance ;
- facturation, devis et rentabilité ;
- workflows détaillés saisons/épisodes/tâches ;
- synchronisation calendrier externe, email ou notifications push ;
- pièces jointes, commentaires collaboratifs et historique restaurable ;
- application mobile native ;
- multi-instance, haute disponibilité et mode hors connexion synchronisé ;
- prévision de capacité et fonctions d'IA.

## 3. Rôles et droits

| Rôle seedé | Capacités |
|---|---|
| Administrateur | gérer référentiels, utilisateurs, ressources, réservations, conflits et dashboard |
| Planificateur | lire référentiels, gérer clients/projets/réservations, voir dashboard, outrepasser un conflit avec motif |
| Lecteur | consulter planning, ressources, clients/projets et dashboard ; aucune mutation |

Les droits effectifs sont la combinaison du rôle et du périmètre de sites. Un utilisateur n'accède jamais aux données d'une autre société.

## 4. Parcours prioritaires

### P1 — Se connecter et choisir un site

L'utilisateur saisit ses identifiants, arrive sur le planning de son site par défaut et peut changer de site parmi ceux autorisés. La dernière vue et le dernier site sont conservés localement.

### P2 — Créer le contexte métier

Un administrateur crée une ressource avec nom, type, site, capacité et couleur. Un planificateur crée un client, choisit sa couleur de repérage dans le planning, puis crée un projet associé. Les nouvelles valeurs sont immédiatement disponibles dans le formulaire de réservation.

### P3 — Créer une réservation

Depuis une plage vide ou un bouton d'action, le planificateur renseigne titre, période, ressources, statut et projet facultatif. Les erreurs sont affichées près des champs. Après validation, la réservation apparaît sans rechargement complet.

### P4 — Déplacer ou redimensionner

Le planificateur déplace une réservation ou ajuste sa fin. Une prévisualisation donne la nouvelle période. L'enregistrement passe par le même contrôle métier que le formulaire. En cas de modification concurrente, l'UI recharge l'élément et invite à recommencer.

### P5 — Gérer un conflit

Si la capacité est dépassée, l'UI identifie la ressource, la période et les réservations en conflit. Par défaut, l'action est annulée. Un utilisateur autorisé peut confirmer un override en donnant un motif ; cet acte est audité.

### P6 — Analyser l'occupation

La vue d’ensemble affiche le taux d’occupation global selon trois lectures sélectionnables — journée civile, semaine du lundi au dimanche et mois civil — puis le détail progressif des salles de montage, de mixage et d’étalonnage. Une catégorie s’ouvre sans quitter la page ; une salle ouvre ensuite le planning sur la même période et avec la ressource filtrée. Un graphique permanent présente les six mois civils jusqu’au mois de situation.

La synthèse commerciale distingue explicitement le **CA devisé** (tous les Devis visibles hors archives), le **CA signé** (Devis acceptés) et les **Budgets non convertis** (Budgets visibles qui n’ont produit aucun Devis). Ces montants sont masqués lorsque l’acteur ne possède pas `quote.read`; aucun faux zéro ne remplace une donnée non autorisée.

Sous la synthèse, une comparaison mensuelle permet de choisir un mois civil passé. Elle rapproche ce mois du mois courant, borné à la date de situation incluse, pour l’occupation globale, le CA devisé, le CA signé et les Budgets non convertis. Les valeurs commerciales sont recalculées sur chaque période — elles ne reprennent pas les cumuls historiques — et les mêmes permissions et scopes sont appliqués avant agrégation. Le CA signé suit la date d’acceptation et demeure acquis à cette date si le Devis est remplacé ensuite ; une acceptation future n’est jamais anticipée. Un Budget converti plus tard reste donc visible comme non converti à la clôture du mois comparé ou à la date de situation courante. Le mois précédent est proposé par défaut ; un mois courant, futur ou mal formé est refusé. La Vue d’ensemble exige toujours `dashboard.read` ; sans `quote.read`, les indicateurs et écarts commerciaux sont explicitement indisponibles, jamais remplacés par zéro.

Les bornes exactes sont affichées dans l’interface : du premier au dernier jour civil du mois passé choisi, et du premier jour à la date de situation pour le mois courant.

## 5. Règles métier

1. Une réservation a une fin strictement postérieure à son début.
2. Une réservation appartient à une société et un site uniques ; toutes ses ressources appartiennent au même périmètre.
3. Une réservation peut ne pas avoir de projet, mais un projet choisi doit être actif et appartenir à la même société.
4. Une réservation active possède au moins une ressource.
5. Les statuts `option` et `confirmed` consomment la capacité ; `cancelled` n'en consomme pas.
6. Les intervalles sont semi-ouverts : une réservation finissant à 10:00 et une autre commençant à 10:00 ne se chevauchent pas.
7. La capacité disponible est calculée par ressource sur tout segment de chevauchement.
8. Le changement de site d'une ressource déjà réservée est interdit dans le MVP ; elle doit être désactivée puis recréée.
9. L'annulation conserve la réservation et son audit ; elle n'est plus modifiable hors restauration, non incluse au MVP.
10. Toute mutation sensible conserve l'acteur, l'instant, l'entité et la nature du changement.

## 6. UX minimale attendue

- shell avec navigation vers Planning, Dashboard, Clients/Projets, Ressources et Administration selon permission ;
- vues jour/semaine/mois avec navigation précédent, aujourd'hui, suivant et accès direct à une date ;
- lignes de ressources lisibles, réservation différenciée par statut et par couleur Client sans dépendre uniquement de la couleur ;
- panneau latéral pour créer/éditer sans perdre le contexte du planning ;
- feedback immédiat pendant drag & drop, sauvegarde, erreur et conflit ;
- filtres combinables, visibles et réinitialisables ;
- navigation clavier des actions principales, focus visible, libellés accessibles ;
- largeur minimale officiellement supportée : 1024 px ; consultation responsive en dessous, édition complexe optimisée desktop ;
- états chargement, vide, erreur et accès refusé conçus explicitement.

## 7. Calcul du dashboard

Pour une période filtrée :

```text
taux d'occupation = durée-capacité réservée / durée-capacité disponible × 100
```

La durée-capacité réservée additionne les segments de réservations non annulées dans la fenêtre, bornés à la période. La durée-capacité disponible est la durée de la fenêtre multipliée par la capacité des ressources actives sélectionnées. Le MVP fonctionne en temps calendaire continu ; les horaires ouvrés et indisponibilités sont hors périmètre et doivent être signalés dans l'interface du dashboard.

## 8. Critères d'acceptation Gate 01

### Authentification et sécurité

- [ ] Avec des identifiants valides, l'utilisateur arrive sur le planning ; avec des identifiants invalides, aucun détail sur le compte n'est révélé.
- [ ] Un lecteur reçoit un refus côté serveur pour toute mutation, même si l'appel est fait hors interface.
- [ ] Un utilisateur de la société A ne peut ni lister, ni lire, ni modifier une entité de la société B ; les tests couvrent aussi les identifiants devinés.
- [ ] Une session expirée renvoie vers la connexion sans perdre silencieusement une mutation.

### Référentiels

- [ ] Un administrateur peut créer une ressource sur un site avec type, capacité et couleur, puis la filtrer dans le planning.
- [ ] Un planificateur peut créer un client et un projet associé ; le projet devient sélectionnable dans une réservation.
- [ ] Un planificateur peut attribuer au Client une couleur hexadécimale ; ses réservations la reprennent comme repère visuel, tandis que le nom du Client et le statut restent lisibles et accessibles sans dépendre de la couleur.
- [ ] Les doublons interdits et les données invalides produisent une erreur exploitable sans enregistrer partiellement.

### Planning

- [ ] Une ouverture générale du Planning se positionne sur la date civile courante en Europe/Paris, y compris après connexion ; une ouverture depuis une réservation précise conserve la date de cette réservation.
- [ ] Un planificateur crée une réservation confirmée sur une ressource disponible et la retrouve après rechargement.
- [ ] Le même ensemble de données est consultable en vues jour, semaine et mois.
- [ ] Le drag & drop modifie correctement début et fin, conserve la durée et persiste après rechargement.
- [ ] Le redimensionnement modifie la durée, respecte une fin postérieure au début et persiste après rechargement.
- [ ] Deux réservations adjacentes sont acceptées ; deux réservations qui se chevauchent au-delà de la capacité sont refusées avec détail du conflit.
- [ ] Une option bloque la capacité ; une réservation annulée la libère.
- [ ] Un planificateur autorisé peut outrepasser un conflit uniquement avec un motif non vide, visible dans l'audit.
- [ ] Une mise à jour utilisant une ancienne `version` est refusée sans écraser la version récente.
- [ ] Les filtres site, ressource/type, projet et statut sont combinables et modifient planning et résultats de façon cohérente.
- [ ] Le défilement vertical conserve l'alignement exact entre la colonne Ressources et la grille jusqu'aux dernières lignes, y compris lorsque la barre de défilement horizontale est présente.
- [ ] Une mutation effectuée dans un second onglet provoque l'actualisation ciblée du premier en moins de 3 secondes sur la machine locale.

### Dashboard

- [ ] Pour un jeu de données contrôlé, les taux globaux et par ressource correspondent au calcul défini, y compris une réservation coupée par les bornes de période.
- [ ] Les filtres du dashboard correspondent à ceux du planning et le passage dashboard → planning conserve période et périmètre.
- [ ] Une période vide affiche 0 % et un état vide, sans division par zéro.

### Qualité, accessibilité et performance

- [ ] Le parcours connexion → client → projet → ressource → réservation → déplacement → conflit → dashboard passe en E2E sans intervention technique.
- [ ] Les actions essentielles sont utilisables au clavier et le focus reste visible ; les statuts ne reposent pas uniquement sur la couleur.
- [ ] Avec 100 ressources et 10 000 réservations dans la fenêtre de test, la lecture API du planning respecte p95 < 300 ms et l'interface reste interactive pendant le défilement.
- [ ] Le projet s'installe, migre, se seed, démarre, se build et exécute ses tests à partir des commandes documentées sans service réseau externe à l'exécution.
- [ ] Après un redémarrage, les données persistent et les migrations sont rejouables sans corruption.

## 9. Stratégie de tests exigée

- unitaires : chevauchement, capacité, transitions de statut, métriques d'occupation, fuseaux et DST ;
- API : validation, erreurs stables, pagination, filtres, version optimiste et idempotence ;
- base : contraintes, migrations aller, seed répétable, atomicité d'une réservation multi-ressources ;
- permissions : matrice rôles × actions et isolation société/site, avec cas négatifs ;
- intégration : transaction conflit/override/audit et invalidation après commit seulement ;
- UI : formulaires, filtres, clavier, états d'erreur et conflit ;
- E2E : parcours Gate 01 sur base neuve ;
- performance : jeu déterministe de 100 ressources et 10 000 réservations, résultats archivés pour comparaison.

Une fonctionnalité n'est pas terminée tant que ses critères automatisables ne sont pas testés, qu'une revue indépendante n'a pas rendu `APPROVED` et que la suite d'intégration reste verte.

## 10. Données de démonstration

Le seed doit créer une société, deux sites dans le fuseau `Europe/Paris`, trois rôles, au moins deux utilisateurs documentés pour la démo, dix ressources de types variés, trois clients, cinq projets et des réservations couvrant : disponible, option, confirmé, adjacent, conflit potentiel et annulé. Les secrets de démonstration sont réservés au mode local et clairement identifiés comme tels.

## 11. Definition of Done de la release

- toutes les fonctions du périmètre sont intégrées et les critères Gate 01 sont démontrables ;
- revue code, QA, sécurité, performance, intégration et E2E validées indépendamment ;
- aucune vulnérabilité critique ou élevée connue dans les dépendances livrées ;
- migrations et seed fonctionnent sur une base vierge ;
- build de production local démarrable et procédure de rollback documentée ;
- changelog, version `0.1.0` et instructions de démonstration prêts ;
- seuls les choix d'interface et d'expérience métier sont alors soumis au Product Owner.

## 12. Décisions à réévaluer après le MVP

- calendrier d'horaires ouvrés et indisponibilités pour affiner la capacité ;
- PostgreSQL et verrouillage adapté au multi-instance ;
- authentification d'entreprise (OIDC/SSO) ;
- granularité des départements, équipes et ressources humaines ;
- règles métier d'option : expiration, priorité et relances ;
- séparation éventuelle de l'audit et des événements d'intégration.
