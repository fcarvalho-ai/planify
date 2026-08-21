# Parcours UX — Parc matériel, stock, maintenance et locations

Version UX : `0.2-draft`  
Date : 2026-08-14  
Références : `docs/design-system.md`, `docs/spec-rental-stock.md`, `docs/target-architecture-v1.md`  
Portée : cible des lots ordonnés `07a Stock socle → 06a Location` ; les éléments du lot 07 avancé sont explicitement différés.

## 1. Principes et modèle mental

L’interface répond en priorité à quatre questions : **quel matériel existe**, **où il se trouve**, **quand il est disponible** et **qui en a la garde**. Elle ne présente jamais un compteur local comme une vérité autonome : l’état physique vient du Stock 07a, la période du Planning 03 et la progression du dossier de Location 06a.

Chaîne visible :

```text
Article de catalogue
  ├─ suivi sérialisé → exemplaire physique → emplacement / état / condition
  └─ suivi en quantité → solde par emplacement

Réservation Planning (facultative) → dossier de location → lignes
  → préparation / affectation → sortie → garde externe → retour
  → quarantaine éventuelle → maintenance → état final explicite
```

Règles UX structurantes :

- la disponibilité combine période, site, emplacement, quantité, affectations et état physique ; elle n’est jamais déduite uniquement du badge d’un exemplaire ;
- les intervalles sont semi-ouverts `[début, fin)` : deux dossiers adjacents peuvent utiliser le même matériel ;
- couleur, icône et libellé textuel portent ensemble chaque état ;
- toute mutation montre `Enregistrement…`, puis succès ou erreur récupérable ;
- aucune action interdite ne devient possible par une URL, un raccourci ou le scan simulé ;
- les mutations sensibles demandent une confirmation nommant la conséquence ;
- l’interface ne propose aucun override d’un stock négatif ni d’un exemplaire sorti, en maintenance, en quarantaine ou retraité ; seul un conflit temporel peut exposer l’override Planning aux personnes autorisées, avec motif audité ;
- une mise à jour SSE conserve le contexte et le focus, signale le changement et recharge uniquement la collection affectée.

## 2. Navigation et architecture d’information

### 2.1 Destinations

Le rail principal ajoute un groupe `Matériel & logistique`, visible si au moins une permission de lecture correspondante est accordée :

1. `Parc matériel` — catalogue et exemplaires ;
2. `Stock` — soldes par article/emplacement et journal des mouvements ;
3. `Maintenance` — dossiers ouverts et historique ;
4. `Locations` — dossiers de préparation, sortie et retour.

Sur desktop, ces quatre vues peuvent être regroupées sous une entrée de rail et une sidebar contextuelle de `240px`. Sur tablette, la sidebar devient un panneau overlay. Sur mobile, elles se trouvent sous `Plus > Matériel & logistique`, avec `Locations` proposé en raccourci lorsque l’utilisateur possède `rental.checkout` ou `rental.return`.

Les entrées `Kits`, `Transferts`, `Inventaires`, `Imprimer des codes` et `Scanner avec la caméra` sont absentes des lots 07a/06a. Elles ne sont ni grisées ni simulées. Leur apparition attend le Gate DEV du lot 07 avancé.

### 2.2 Barre supérieure et URL

Le sélecteur société/site reste visible. Le site actif filtre toutes les listes ; une action multi-site n’est jamais implicite. L’URL encode destination, recherche, filtres, page, tri et entité ouverte :

```text
#equipment?site=…&tab=assets&status=maintenance&asset=…
#stock?site=…&location=…&item=…&tab=balances
#maintenance?site=…&status=open&record=…
#rentals?site=…&status=ready&from=…&to=…&order=…
```

Retour/avance restaure filtres, tri, page, sélection et scroll. Un lien depuis Planning ouvre le dossier lié ; `Retour au planning` restitue date, filtres et réservation sélectionnée. Un lien depuis une fiche article vers Stock applique l’article et le site comme filtres.

### 2.3 Recherche globale

`⌘/Ctrl K` recherche articles, SKU, exemplaires, numéros de série, codes de scan et dossiers. Les résultats sont regroupés, limités au périmètre autorisé et annoncés par catégorie. Le code exact d’un exemplaire arrive en premier, sans révéler l’existence d’un résultat hors société/site.

## 3. Grammaire d’état

### 3.1 Exemplaires et condition

| Valeur | Libellé visible | Renfort | Action principale possible |
|---|---|---|---|
| `available` | Disponible | coche + emplacement | affecter, déplacer administrativement |
| `allocated` | Affecté | marque-page + dossier/période | ouvrir le dossier |
| `out` | Sorti | flèche sortante + détenteur/dossier | enregistrer un retour |
| `maintenance` | En maintenance | outil + dossier maintenance | clôturer la maintenance si autorisé |
| `quarantine` | En quarantaine | bouclier alerte + motif | ouvrir une maintenance |
| `retired` | Retiré du parc | archive + date | consulter l’historique |

La condition est présentée séparément : `Bon`, `Usé`, `Endommagé`, `Inconnu`. `Disponible · Usé` reste possible ; le statut et la condition ne sont jamais fusionnés en une seule couleur.

### 3.2 Dossiers de location

| Statut | Libellé | Explication courte | Action primaire |
|---|---|---|---|
| `draft` | Brouillon | aucune affectation exclusive | Préparer |
| `preparing` | En préparation | matériel réservé, lignes à compléter | Terminer la préparation |
| `ready` | Prêt | toutes les lignes sont préparées | Enregistrer la sortie |
| `partiallyOut` | Sortie en cours | une partie sortie, checkout encore ouvert | Continuer ou clôturer la sortie |
| `out` | Sorti | checkout fermé, aucun retour enregistré | Enregistrer un retour |
| `partiallyReturned` | Retour en cours | une partie reste en garde externe | Continuer le retour |
| `returned` | Retourné | tout le matériel sorti a été rendu | Consulter |
| `cancelled` | Annulé | terminal, allocations libérées | Consulter |

Une progression numérique accompagne le statut : `Préparé 8/10`, `Sorti 3/8`, `Retourné 1/3`. En `partiallyOut`, l’action `Retour` est absente et une aide explique : `Clôturez d’abord la sortie pour libérer le reliquat et commencer les retours.`

### 3.3 Maintenance

| Statut | Libellé | Actions |
|---|---|---|
| `open` | Ouverte | consulter, clôturer |
| `completed` | Terminée | consulter la résolution et l’état final |
| `cancelled` | Annulée | consulter le motif |

La clôture demande obligatoirement une résolution et une condition finale. `Bon` ou `Usé` remet l’exemplaire disponible ; `Endommagé` le place en quarantaine. Cette conséquence est affichée avant confirmation.

## 4. Écran Parc matériel

### 4.1 Structure

Deux onglets : `Articles` et `Exemplaires`. Le dernier onglet est persisté par utilisateur. La toolbar contient recherche bornée, site, catégorie, mode de suivi, statut/condition selon l’onglet, emplacement, disponibilité pour une période, densité, colonnes et action de création selon permission.

#### Table Articles

| Colonne par défaut | Contenu |
|---|---|
| Article | nom + catégorie |
| SKU | valeur monospace/tabulaire |
| Suivi | Sérialisé / Quantité |
| Site(s) | résumé, sans agréger des sites non autorisés |
| Physique | quantité sur site |
| Réservé | quantité réservée sur la fenêtre active |
| Disponible | quantité disponible sur la fenêtre active |
| État | Actif / Désactivé |
| Actions | Ouvrir, Voir le stock, Modifier selon droit |

La fenêtre utilisée pour `Réservé` et `Disponible` est visible au-dessus de la table. Sans fenêtre choisie, le libellé devient `Disponible maintenant` et le fuseau du site est indiqué.

#### Table Exemplaires

| Colonne par défaut | Contenu |
|---|---|
| Exemplaire | article + numéro de série |
| Code scan | masqué si permission insuffisante |
| Statut | badge textuel + icône |
| Condition | texte + icône |
| Site / emplacement | deux niveaux lisibles |
| Affectation | dossier et période, ou tiret |
| Ressource liée | lien Planning facultatif |
| Mise à jour | date/heure locale |
| Actions | Ouvrir, Maintenance, Modifier selon droit |

Entête sticky, lignes `40px` en dense ou `48px` en standard, pagination serveur et colonnes épinglables/redimensionnables. La sélection multiple ne déclenche aucune mutation physique dans 07a ; elle sert seulement à comparer ou exporter si cette fonction est autorisée ultérieurement.

### 4.2 Drawer article

Entête : nom, SKU, badge actif, précédent/suivant, fermer. Sections :

1. `Résumé` — mode de suivi, catégorie, unité, notes ;
2. `Disponibilité` — fenêtre, physique, réservé, disponible, explication du calcul ;
3. `Par emplacement` — soldes sans double comptage ;
4. `Exemplaires` pour un article sérialisé ;
5. `Historique` — mouvements liés, paginés ;
6. `Administration` — modifier/désactiver selon permission.

Le formulaire de création/édition valide le SKU normalisé, le mode de suivi fermé et l’unité `Pièce`. La désactivation est confirmée par `Désactiver l’article`; le dialogue précise que l’historique est conservé et que l’article ne pourra plus être ajouté à un nouveau dossier.

### 4.3 Drawer exemplaire

Entête : article + numéro de série, statut et condition. Sections : identité, localisation actuelle, disponibilité temporelle, affectation/dossier, ressource Planning liée, maintenance active, mouvements et audit. L’état physique n’est jamais édité par un select générique : seules les commandes métier autorisées (`Ouvrir une maintenance`, clôture, retour, changement administratif d’emplacement disponible) peuvent le modifier.

Créer un exemplaire exige article sérialisé, numéro de série, site et emplacement cohérents. Une erreur `SERIAL_NUMBER_EXISTS` devient `Ce numéro de série est déjà utilisé dans votre société.` sans afficher l’autre exemplaire. Un emplacement d’un autre site est retiré des options et toute réponse serveur incohérente bloque l’enregistrement.

## 5. Écran Stock

### 5.1 Onglet Soldes

La vue par défaut est une table `Article × Emplacement`. Filtres : site requis, emplacement, article/catégorie, suivi, disponibilité pour une fenêtre et recherche. Colonnes : article/SKU, emplacement, physique disponible, maintenance, quarantaine, réservé, disponible pour la fenêtre, sorti, dernière séquence.

Les nombres sont alignés à droite et utilisent des chiffres tabulaires. Les en-têtes définissent précisément chaque compte dans un tooltip et une description accessible. `Disponible` n’est jamais affiché sans la fenêtre qui le détermine. Une valeur nulle est `0`, pas un tiret. Une anomalie de projection affiche `Solde à vérifier` avec une action réservée aux administrateurs ; l’UI ne fabrique pas de valeur de remplacement.

Clic sur une ligne : drawer de solde avec décomposition, exemplaires concernés, allocations actives et derniers mouvements. Un lien `Voir les dossiers bloquants` ouvre Locations filtré.

### 5.2 Onglet Mouvements

Journal en lecture seule trié par séquence décroissante. Colonnes : séquence, date/heure, type lisible, article/exemplaire, quantité, origine/destination ou compte, dossier, acteur, motif, corrélation. Les legs techniques sont repliés par défaut sous `Voir l’écriture` et restent disponibles aux profils autorisés.

Un mouvement ne propose ni modifier ni supprimer. Une éventuelle correction future apparaît comme mouvement compensatoire lié, jamais comme édition. Les filtres article, exemplaire, dossier, type, période et emplacement sont cumulables. Le `correlationId` regroupe visuellement les lignes d’une même sortie ou d’un même retour.

### 5.3 États vides et anomalies

- aucun article : `Le parc matériel est vide.` + `Créer un article` pour l’administrateur ; sinon contact administrateur ;
- aucun mouvement : `Aucun mouvement pour ces filtres.` + `Effacer les filtres` ;
- emplacement vide : `Aucun stock physique dans cet emplacement.` ;
- disponibilité nulle : afficher les causes accessibles (`3 réservés`, `1 en maintenance`) et les liens vers les sources ;
- erreur de reconstruction/projection : panneau persistant, données affectées marquées indisponibles et aucune mutation fondée sur un solde incertain.

## 6. Écran Maintenance

### 6.1 Liste

Filtres : site, statut, article, exemplaire, condition et période d’ouverture. Colonnes : dossier maintenance, exemplaire/article, site/emplacement précédent, raison, ouvert le/par, durée, statut, résultat. Les maintenances ouvertes sont en premier sans modifier le tri annoncé.

L’action `Ouvrir une maintenance` n’est visible qu’avec `maintenance.manage`. Elle ouvre un drawer demandant exemplaire disponible ou en quarantaine, raison bornée et confirmation. Le résumé indique : `L’exemplaire deviendra indisponible immédiatement et sera déplacé vers l’état En maintenance.`

### 6.2 Détail et clôture

Le drawer affiche chronologie, raison, statut physique, dossier/location lié éventuel, mouvements et audit. `Clôturer la maintenance` ouvre un dialogue avec :

- résolution obligatoire ;
- condition finale `Bon`, `Usé` ou `Endommagé` ;
- emplacement de retour lorsqu’une remise disponible est possible ;
- conséquence calculée et annoncée avant le bouton.

Bouton : `Clôturer et rendre disponible` ou `Clôturer et placer en quarantaine`. Une version obsolète recharge le dossier et demande de recommencer ; aucune résolution saisie n’est fusionnée silencieusement.

## 7. Écran Dossiers de location

### 7.1 Liste opérationnelle

La vue propose deux présentations : `Table` et `À traiter`. `À traiter` regroupe `À préparer`, `Prêts à sortir`, `Sorties en cours`, `À retourner` et `Retours en cours`; ce n’est qu’une projection de lecture des statuts canoniques.

Filtres : site, période, statut, projet, réservation, client, type interne/externe, responsable et recherche. Colonnes table : référence/titre, projet/client, période, statut, progression, responsable, matériel, dernière activité, actions.

Actions rapides permises : `Préparer`, `Sortir`, `Retourner`. Elles ouvrent toujours le drawer/flow correspondant ; aucune transition physique ne part d’un simple clic de ligne. Les dossiers terminaux restent consultables via filtres.

### 7.2 Création du dossier

Déclencheurs : `Nouveau dossier`, réservation Planning ou fiche projet. Depuis Planning, site, période, projet, client et réservation sont lus de la représentation canonique et affichés en lecture seule. Un dossier autonome exige projet ou titre explicite, site, période et emplacement d’origine.

Étapes du drawer :

1. `Contexte` — type interne/externe, réservation éventuelle, projet/client, période et responsable ;
2. `Lignes` — recherche d’articles actifs, quantité entière positive, suppression/réordonnancement ;
3. `Disponibilité` — résultat par ligne pour la fenêtre, avec causes et sources ;
4. `Résumé` — site, période, lignes, notes et action `Créer le brouillon`.

Le prix, la caution, l’assurance, l’amortissement, les kits et le transport n’apparaissent pas. Un double envoi reste idempotent. Après succès, le dossier s’ouvre avec l’action `Commencer la préparation`.

### 7.3 Fiche dossier

Entête sticky : titre/référence, statut, période, site, progression globale, précédent/suivant et fermer. Barre d’étapes non interactive : `Brouillon → Préparation → Prêt → Sortie → Retour`, avec les statuts partiels inscrits sous l’étape active.

Sections :

- `Contexte` — réservation/projet/client, période, emplacements, responsable ;
- `Lignes` — demandé, affecté/préparé, sorti, retourné, restant ;
- `Conflits et disponibilité` — résultat frais et horodaté ;
- `Historique` — transitions, mouvements corrélés et audits ;
- `Notes` — texte échappé ;
- `Liens` — ouvrir Planning, projet, article, exemplaire ou maintenance.

Le pied sticky expose une seule action primaire correspondant au statut. `Modifier` n’est permis qu’aux étapes où période/lignes sont modifiables. `Annuler le dossier` apparaît en secondaire uniquement sans sortie ; son dialogue précise que les allocations seront libérées. Après une sortie, l’action est absente et l’aide indique qu’un retour/régularisation est requis.

## 8. Préparation et affectation

L’écran de préparation est un mode du drawer, agrandi jusqu’à `520px` sur desktop et plein écran sur mobile. Chaque ligne présente article, demandé, préparé, disponibilité et erreurs locales.

Pour un article sérialisé :

1. ouvrir la ligne ;
2. rechercher par numéro de série/code ou utiliser le scan simulé ;
3. cocher exactement le nombre demandé d’exemplaires éligibles ;
4. voir site, emplacement, condition et prochains conflits de chaque choix ;
5. valider l’affectation de la ligne.

Pour un article en quantité : saisir une quantité entière entre `0` et le disponible, avec boutons `−/+` accessibles et saisie directe. Une ligne incomplète reste marquée `À compléter` ; `Marquer prêt` reste désactivé avec la raison textuelle et un lien vers la première ligne incomplète.

`Commencer la préparation` relance le contrôle serveur. `STOCK_CONFLICT` ouvre le panneau de résolution, sans affectation partielle silencieuse. Pour un conflit temporel seulement, proposer créneau adjacent, autre exemplaire ou retour vers Planning ; l’override apparaît uniquement avec permission Planning, motif requis et avertissement d’audit.

## 9. Scan / QR simulé

Le simulateur sert à tester la vitesse et l’accessibilité de la préparation, sortie et retour sans prétendre fournir le scan matériel différé du lot 07 avancé.

### 9.1 Déclenchement et saisie

Bouton `Saisir un code` ou raccourci `S` dans un flow logistique actif. Il ouvre un champ nommé `Code exemplaire`, compatible avec :

- saisie manuelle ;
- collage ;
- lecteur “keyboard wedge” émulé qui envoie des caractères puis Entrée ;
- bouton démo `Utiliser un code du jeu d’essai`, absent en production.

Le libellé reste `Saisie simulée`; aucune icône caméra ni demande de permission appareil. Le code n’est jamais interprété comme URL ou HTML. Le champ a une longueur bornée, ignore les séparateurs de fin configurés et conserve la casse/normalisation définie par le serveur.

### 9.2 Résultats

- code exact et attendu : ajouter/sélectionner l’exemplaire, annoncer son nom, numéro, état et compteur (`2 sur 4 préparés`) ;
- code déjà traité dans l’opération : ne pas doubler, signal sonore facultatif doublé par `Déjà ajouté` ;
- code connu mais mauvaise ligne : proposer de passer à la ligne correcte, sans mutation ;
- exemplaire indisponible : afficher cause (`Sorti`, `Maintenance`, `Quarantaine`, `Conflit temporel`) et action pertinente ;
- mauvais site ou hors périmètre : `Code introuvable ou non accessible pour ce site`, sans révélation ;
- code inconnu : conserver le focus, sélectionner la saisie et proposer `Réessayer` ;
- erreur réseau : mettre en pause la saisie, ne rien ajouter localement et proposer `Réessayer`.

Une file visuelle montre les cinq dernières tentatives avec succès/échec textuel. Elle n’est pas une file hors connexion et disparaît à la fermeture. Chaque code est confirmé côté serveur avant de compter dans une mutation.

## 10. Sortie partielle

`Enregistrer la sortie` ouvre une feuille transactionnelle :

1. résumé du dossier et avertissement si la période a commencé/expiré ;
2. lignes avec préparé, déjà sorti et `À sortir maintenant` ;
3. sélection d’exemplaires ou quantité, saisie/scan simulé possible ;
4. choix obligatoire : `Garder la sortie ouverte` ou `Clôturer la sortie` ;
5. résumé des conséquences ;
6. confirmation explicite.

Avec `Garder la sortie ouverte`, au moins une unité doit sortir et le dossier devient `Sortie en cours`; le retour demeure indisponible. Avec `Clôturer la sortie`, le reliquat préparé non sorti est clairement listé comme `sera libéré`, le dossier devient `Sorti` et aucune sortie complémentaire ne sera possible.

Les boutons nomment le résultat : `Sortir 3 unités et garder ouverte` ou `Sortir 3 unités et clôturer`. Une fermeture sans unité lors de la première sortie est refusée. Après succès, afficher le statut, la progression et le nombre encore en garde ; ne pas proposer d’annulation toast d’un mouvement physique.

## 11. Retour partiel et retour endommagé

`Enregistrer un retour` n’est disponible que pour `out` ou `partiallyReturned`. La feuille présente uniquement le reliquat encore en garde.

Par exemplaire sérialisé, l’utilisateur sélectionne/scan le code, choisit condition observée (`Bon`, `Usé`, `Endommagé`) et emplacement de retour autorisé. Pour un article en quantité, il saisit quantité, condition du lot et emplacement. Des conditions différentes exigent des groupes de lignes distincts afin que la conséquence reste explicite.

Avant confirmation :

- `Bon` / `Usé` → `Disponible à [emplacement]` ;
- `Endommagé` → `Quarantaine à [emplacement]`, jamais disponible ;
- résumé `Retourner N maintenant · M resteront sortis`.

Un retour partiel place le dossier en `Retour en cours`. Le dernier reliquat place le dossier en `Retourné`. Le bouton devient `Retourner 2 exemplaires`; un dialogue renforcé apparaît dès qu’un élément est endommagé : `Retourner et placer 1 exemplaire en quarantaine`. Après succès, un lien `Ouvrir une maintenance` est proposé aux administrateurs, sans ouverture automatique.

## 12. Conflits, erreurs et concurrence

### 12.1 Panneau de conflit

Le panneau est ancré à la ligne fautive et répète dans un résumé supérieur : article, demandé, disponible, période et cause. Causes visibles : chevauchement temporel, maintenance, quarantaine, quantité insuffisante, site incompatible. Il ne montre les détails d’un dossier concurrent que si l’utilisateur est autorisé à le lire.

Ordre des solutions : autre exemplaire/quantité, période adjacente via Planning, réduction de quantité, retirer la ligne. Un état physique indisponible n’affiche jamais `Forcer`.

### 12.2 Traduction des erreurs API

| Code | Message et récupération UX |
|---|---|
| `STOCK_CONFLICT` | `Le matériel n’est plus disponible pour cette période.` Recharger les causes et reprendre la ligne. |
| `ASSET_UNAVAILABLE` | `Cet exemplaire n’est pas disponible : [cause autorisée].` Choisir un autre exemplaire. |
| `INSUFFICIENT_STOCK` | `Disponible : X sur Y demandés.` Réduire ou changer période/article. |
| `INVALID_ORDER_TRANSITION` | `Cette action n’est plus possible dans l’état actuel du dossier.` Recharger le dossier. |
| `ORDER_NOT_FULLY_PREPARED` | Lister et focaliser les lignes incomplètes. |
| `ORDER_NOT_FULLY_RETURNED` | Lister le reliquat encore en garde. |
| `LOCATION_NOT_EMPTY` | `Cet emplacement contient encore du matériel.` Ouvrir le stock filtré. |
| `SERIAL_NUMBER_EXISTS` | Erreur inline sans révéler l’entité existante hors périmètre. |
| `VERSION_CONFLICT` | Recharger la version gagnante, conserver une copie lisible de la saisie et inviter à recommencer ; aucune fusion silencieuse. |
| `FORBIDDEN` | Fermer les actions devenues interdites, conserver le brouillon copiable, indiquer le droit requis sans détail sensible. |
| `NOT_FOUND` | Retirer l’entité de la liste et annoncer qu’elle n’est plus disponible ou accessible. |
| `VALIDATION_ERROR` | Associer chaque détail autorisé au champ/à la ligne, puis focaliser la première erreur. |

Les erreurs portent `requestId` dans une zone technique repliée avec `Copier la référence`; jamais de stack ni de données d’un autre tenant. Un toast d’erreur reste visible jusqu’à fermeture, mais les erreurs de ligne restent aussi près de leur source.

### 12.3 SSE et modifications concurrentes

Si une entité non modifiée localement change, actualiser la ligne en conservant focus, tri et scroll, puis annoncer `Données actualisées`. Si un drawer contient des changements, afficher une bannière `Une version plus récente existe` avec `Voir la version récente`; ne jamais remplacer les champs. Pour une transition physique déjà réalisée ailleurs, fermer l’action obsolète, recharger la représentation canonique et expliquer le résultat.

## 13. Responsive

### Desktop `≥1280px`

- rail `64px`, sidebar facultative `240px`, contenu fluide ;
- tables comme vue principale ;
- drawer non modal `400px`, redimensionnable `360–520px` ;
- sur préparation/sortie/retour, drawer élargi et table de lignes sticky ;
- aucun panneau ne réduit la table sous `720px` : le drawer passe alors en overlay.

### Tablette `768–1279px`

- rail `56px`, sidebar en overlay ;
- filtres secondaires dans un popover avec compteur ;
- drawer modal latéral `min(520px, 94vw)` ;
- colonnes prioritaires conservées, autres dans le détail de ligne ;
- scan simulé toujours accessible au-dessus du clavier logiciel.

### Mobile `<768px`

- navigation sous `Plus`, listes en cartes/agenda opérationnel sans scroll horizontal obligatoire ;
- filtres dans une feuille plein écran avec résumé en chips ;
- détail, création, préparation, sortie et retour en feuilles plein écran ;
- une carte dossier montre titre, statut, période, progression et action primaire ;
- une carte exemplaire montre article/série, état/condition et emplacement ;
- cibles tactiles `44×44px`, marge `16px`, pied d’action sticky compatible safe-area ;
- lignes de sortie/retour traitées une par une avec `Précédent/Suivant`; récapitulatif obligatoire avant validation ;
- aucune fonctionnalité ne dépend d’un drag, d’un hover ou d’une caméra.

À 200 % de zoom, aucune action ni information de conséquence ne disparaît. À 400 %, les zones passent en une colonne et les barres sticky ne recouvrent pas l’erreur focalisée.

## 14. Accessibilité

- lien `Aller au contenu` en premier ; landmarks `navigation`, `main`, `search` et panneaux nommés ;
- tableaux natifs quand possible, `aria-sort` sur le tri, cases nommées et menu de ligne au clavier ; une alternative liste est fournie si virtualisation complexe ;
- drawers : titre relié, focus initial logique, Échap conditionnel aux changements, retour du focus au déclencheur ;
- dialogues irréversibles avec piège de focus, description de conséquence et bouton explicite ;
- région `aria-live=polite` pour scan, progression, SSE et sauvegarde ; `assertive` pour conflit bloquant ou échec physique ;
- badges toujours avec texte et icône ; progression disponible sous forme `Sorti 3 sur 8`, pas uniquement en barre ;
- messages de champ via `aria-describedby`, résumé d’erreurs avec liens vers lignes ;
- contrastes WCAG 2.2 AA, focus `2px --color-focus` avec offset `2px`, clair/sombre/système ;
- sons de scan facultatifs, désactivables et toujours doublés par texte/annonce ; aucune vibration indispensable ;
- `prefers-reduced-motion` supprime translations de drawer/highlight ;
- dates `fr-FR`, format 24 h, fuseau du site visible s’il diffère du poste ; chiffres tabulaires ;
- textes extensibles de 30 %, noms/numéros longs tronqués visuellement mais complets au focus et dans le nom accessible.

## 15. Raccourcis clavier

| Raccourci | Action |
|---|---|
| `⌘/Ctrl K` | recherche globale / commandes |
| `C` | créer dans la vue active si autorisé |
| `F` | ouvrir les filtres |
| `/` | focaliser la recherche de la liste |
| `S` | ouvrir la saisie de code simulée dans un flow logistique |
| `P` | commencer/reprendre la préparation du dossier sélectionné |
| `O` | ouvrir la sortie du dossier prêt/sortie en cours |
| `U` | ouvrir le retour du dossier sorti/retour en cours |
| `E` | modifier l’entité sélectionnée si permis |
| `[` / `]` | précédent / suivant dans la liste filtrée |
| `Échap` | fermer/annuler le niveau actif |
| `?` | afficher l’aide des raccourcis |

Les raccourcis à une touche sont désactivés dans tout champ, combobox ou éditeur, et ne déclenchent jamais directement une mutation. Chaque commande possède une action visible et un nom accessible.

## 16. Wireframes texte

### 16.1 Parc matériel — desktop

```text
┌ Rail ┬ Matériel & logistique ┬──────────────────────────────────────────────┐
│      │ Parc matériel         │ Parc matériel                [Site Paris ▾] │
│      │ Stock                 │ [Articles] [Exemplaires]       [+ Article]  │
│      │ Maintenance           │ [Rechercher…] [Filtres 2] [Période…]       │
│      │ Locations             ├─────────┬───────┬──────────┬───────────────┤
│      │                       │ Article │ SKU   │ Dispo.   │ Emplacement   │
│      │                       │ Caméra… │ CAM01 │ 3 / 5    │ Réserve A     │
│      │                       │ Câble…  │ CBL10 │ 18 / 24  │ Étagère C2    │
│      │                       └─────────┴───────┴──────────┴───────────────┘
└──────┴───────────────────────┴──────────────────────────────────────────────┘
```

### 16.2 Stock + drawer de solde

```text
┌ Stock — Soldes | Mouvements ─────────────────────┬ Détail du solde ───────┐
│ Site [Paris] Emplacement [Tous] Fenêtre [14–16/8]│ Caméra FX6 · PAR-MAIN  │
├────────┬──────────┬───────┬────────┬───────┬─────┤ Physique          5    │
│ Article│ Emplact. │ Phys. │ Réservé│ Dispo │Sorti│ Réservé           2    │
│ FX6    │ PAR-MAIN │   5   │   2    │   3   │  1 │ Disponible        3    │
│ Câble  │ PAR-C2   │  24   │   6    │  18   │  0 │ Maintenance       1    │
└────────┴──────────┴───────┴────────┴───────┴─────┤ [Exemplaires]          │
                                                   │ [Allocations actives]  │
                                                   │ [Derniers mouvements]  │
                                                   └────────────────────────┘
```

### 16.3 Dossier — préparation

```text
┌ Dossier LOC-024 · En préparation · Préparé 3/5 ────────────────────────────┐
│ Projet Film A · Paris · 14/08 10:00 → 16/08 18:00 [Ouvrir le planning]    │
│ Étapes : Brouillon — [Préparation] — Prêt — Sortie — Retour                │
├──────────────────────┬─────────┬─────────┬──────────┬──────────────────────┤
│ Ligne                │ Demandé │ Préparé│ Dispo.   │ Action               │
│ Caméra FX6 (série)   │    2    │  1/2   │ 3        │ [Affecter] [Saisir]  │
│ Batteries (quantité) │    3    │  2/3   │ 12       │ [−] 2 [+]            │
├──────────────────────┴─────────┴─────────┴──────────┴──────────────────────┤
│ ⚠ 2 lignes à compléter                         [Enregistrer] [Marquer prêt]│
└────────────────────────────────────────────────────────────────────────────┘
```

### 16.4 Sortie partielle

```text
┌ Enregistrer la sortie ─────────────────────────────────────────────────────┐
│ Caméra FX6       préparé 2 · déjà sorti 0 · maintenant [1]                │
│ Batteries        préparé 3 · déjà sorti 0 · maintenant [2]                │
│ [Saisir un code]                                                          │
│                                                                            │
│ (●) Garder la sortie ouverte — aucun retour possible                       │
│ ( ) Clôturer — 2 unités non sorties seront libérées                        │
│                                                                            │
│ Résultat : Sortie en cours · 3 unités en garde                             │
│                                      [Annuler] [Sortir 3 et garder ouverte]│
└────────────────────────────────────────────────────────────────────────────┘
```

### 16.5 Retour endommagé — mobile

```text
┌ Retour · 1 sur 3 ───────────────────┐
│ [‹] Caméra FX6 · SN-2048             │
│ Code             [Saisir un code]    │
│ Condition        [Endommagé       ▾] │
│ Emplacement      [Quarantaine PAR ▾] │
│                                      │
│ ⚠ Cet exemplaire ne sera pas         │
│ disponible. Il passera en quarantaine│
│                                      │
│ [Précédent]              [Suivant]   │
├──────────────────────────────────────┤
│ [Retourner et placer en quarantaine] │
└──────────────────────────────────────┘
```

## 17. Critères UI vérifiables

1. Les quatre destinations autorisées sont atteignables en deux actions maximum depuis le rail/Plus ; aucune destination 07 avancé n’est exposée.
2. Une liste de 2 000 exemplaires ou 10 000 mouvements reste paginée/virtualisée, affiche total et chargement structurel, et devient exploitable en moins de 2 secondes sur le jeu de référence.
3. Site, fenêtre de disponibilité et filtres actifs restent visibles ; URL, retour navigateur, focus et scroll sont restaurés.
4. Chaque table possède tri annoncé, pagination, empty state contextualisé, état erreur partiel, colonnes essentielles sur mobile et alternative accessible si virtualisée.
5. Un lecteur ne voit aucune action de mutation ; une permission retirée en session provoque une erreur propre sans perte silencieuse de saisie.
6. La création article → emplacement → deux exemplaires est réalisable au clavier, avec erreurs SKU/série reliées au champ et focus sur la première erreur.
7. Le flow dossier lié au Planning ne redemande ni site, ni période, ni projet/client ; il montre leur origine et propose un retour contextuel au Planning.
8. `Marquer prêt` reste impossible tant que chaque ligne n’est pas complètement préparée, et la cause est donnée en texte avec accès direct à la ligne.
9. Une sortie partielle affiche le choix ouvert/fermé, la libération du reliquat et l’interdiction du retour avant fermeture ; aucun checkout vide n’est validable.
10. Un retour partiel montre restant en garde, condition et emplacement ; un retour endommagé annonce puis applique la quarantaine, sans disponibilité transitoire.
11. Le scan simulé fonctionne au clavier/coller/Entrée, ne double pas un code, ne contourne aucune permission ou validation serveur et ne suggère ni caméra ni scan matériel livré.
12. Les conflits indiquent article, demandé, disponible, période et cause ; un état physique bloquant ne présente jamais d’override.
13. Un `VERSION_CONFLICT` recharge la version gagnante et permet de consulter/copier la saisie locale ; aucune fusion ou nouvelle tentative automatique n’est silencieuse.
14. Une invalidation SSE actualise la vue ciblée en moins de 3 secondes sans voler le focus ni perdre un formulaire en cours.
15. Les parcours principaux sont réalisables sans pointeur à `1440×900`, `1024×768` et `390×844`, à 200 % de zoom et avec mouvements réduits.
16. Tous les statuts/conditions/progressions disposent d’un libellé et d’une icône ; contrastes, focus, noms accessibles, annonces live et cibles tactiles satisfont WCAG 2.2 AA.
17. Les dialogues de sortie, retour endommagé, maintenance et annulation nomment la conséquence ; aucune transition physique n’est lancée par un simple clic non confirmé.
18. Les données d’un site/société non autorisé ne sont ni affichées dans les recherches, ni révélées dans les erreurs, ni conservées lors d’un changement de périmètre.

## 18. Limites de livraison

Ce document décrit l’expérience cible, pas l’état actuellement livré de la RC1. Les écrans ne doivent être activés qu’avec leur lot backend, permissions, tests et gates complets. Pour 07a/06a, `Saisir un code` est uniquement une simulation de saisie d’identifiant ; kits, transferts, inventaires, ajustements d’inventaire, impression QR, caméra et intégrations de scanners restent hors interface. Les choix visuels finaux demeurent soumis à validation du Product Owner au Gate RELEASE.
