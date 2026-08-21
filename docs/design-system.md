# Design system — Planning Post Prod

Version UX : `0.1`  
Cible : application métier desktop-first, responsive, WCAG 2.2 AA.  
Références de qualité : densité de Linear, précision de Figma, clarté de Stripe, puissance tabulaire d’Airtable — sans reproduction visuelle.

## 1. Principes

1. **Le temps et les conflits sont visibles immédiatement.** Une réservation doit se lire par sa position, sa durée, son statut et son niveau de risque.
2. **Dense, jamais compact au détriment du contrôle.** Le planning privilégie l’espace utile ; les actions secondaires restent accessibles au focus, au survol et via le menu contextuel.
3. **Une action, un retour système.** Toute mutation affiche un état en cours, puis une confirmation ou une erreur récupérable.
4. **Le clavier est un parcours de premier rang.** Toutes les actions sont réalisables sans pointeur.
5. **La couleur renforce l’information, elle ne la porte jamais seule.** Texte, icône ou motif doublent les états critiques.

## 2. Fondations et tokens

Les tokens ci-dessous sont la source unique. Les composants ne doivent pas contenir de valeurs hexadécimales ou d’espacements arbitraires.

### 2.1 Couleurs

| Token | Clair | Sombre | Usage |
|---|---:|---:|---|
| `--color-bg-canvas` | `#F5F7FA` | `#0C1017` | fond application |
| `--color-bg-surface` | `#FFFFFF` | `#141A23` | panneaux, cartes |
| `--color-bg-subtle` | `#EEF2F6` | `#1C2430` | entêtes, survol discret |
| `--color-bg-elevated` | `#FFFFFF` | `#202936` | menus, popovers |
| `--color-text-primary` | `#172033` | `#F4F7FB` | texte principal |
| `--color-text-secondary` | `#59657A` | `#A9B4C4` | métadonnées |
| `--color-text-muted` | `#778399` | `#8793A5` | aides non critiques |
| `--color-border` | `#D9E0E8` | `#303A49` | séparateurs |
| `--color-border-strong` | `#AAB5C4` | `#506074` | focus structurel |
| `--color-accent` | `#5B5BD6` | `#8585F2` | action, sélection |
| `--color-accent-hover` | `#4949BD` | `#9B9BF7` | survol action |
| `--color-accent-soft` | `#EEEEFF` | `#29294C` | sélection légère |
| `--color-success` | `#16835D` | `#47C99A` | confirmé, disponible |
| `--color-warning` | `#B05C00` | `#F0A24A` | option, vigilance |
| `--color-danger` | `#C4323B` | `#FF6B72` | conflit, suppression |
| `--color-info` | `#126BB5` | `#55A8E8` | information |
| `--color-focus` | `#2563EB` | `#8DB7FF` | anneau de focus |

Contrastes minimaux : `4.5:1` pour texte normal, `3:1` pour grand texte, composants graphiques et focus. Le frontend vérifie les couples réels avec axe-core.

Palette métier des réservations (fond doux + bord/texte fort) :

| État | Fond clair | Bord/texte | Renfort non coloriel |
|---|---:|---:|---|
| option | `#FFF4DD` | `#9A5100` | icône horloge + libellé `Option` |
| confirmée | `#DFF7ED` | `#087451` | icône coche + libellé `Confirmée` |
| bloquée/interne | `#E8EDF3` | `#4D5B70` | icône verrou + libellé `Bloquée` |
| conflit | `#FFE8EA` | `#B4232D` | bord gauche 3 px + icône alerte + hachures CSS |
| sélectionnée | `#EEEEFF` | `#4F46C8` | anneau 2 px |

Les projets peuvent recevoir une couleur d’identification parmi 8 teintes testées AA. Cette couleur apparaît uniquement en liseré ou pastille ; le statut conserve sa sémantique propre.

### 2.2 Typographie

Pile : `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`. Données horaires et chiffres : activer `font-variant-numeric: tabular-nums`.

| Style | Taille / ligne | Graisse | Usage |
|---|---|---:|---|
| `display-sm` | `24/32` | 650 | titre de page |
| `heading-md` | `18/24` | 650 | panneau, drawer |
| `heading-sm` | `15/20` | 650 | section, ressource |
| `body-md` | `14/20` | 450 | défaut UI |
| `body-sm` | `13/18` | 450 | tableau, événement |
| `label` | `12/16` | 600 | contrôle, badge |
| `caption` | `11/16` | 500 | axe temporel, métadonnée |

Taille minimale lisible : `12px`; aucun texte fonctionnel sous `11px`.

### 2.3 Espacement, rayons, ombres, mouvement

- Unité : `4px`. Échelle : `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Rayons : `4px` petit, `8px` contrôle/carte, `12px` panneau, `999px` badge.
- Ombres : `sm 0 1px 2px rgba(16,24,40,.08)`, `md 0 8px 24px rgba(16,24,40,.12)`, `lg 0 20px 48px rgba(16,24,40,.18)`.
- Durées : `120ms` micro-retour, `180ms` menu/popover, `240ms` drawer. Courbe : `cubic-bezier(.2,.8,.2,1)`.
- `prefers-reduced-motion: reduce` : supprimer translations, zooms et défilements animés ; conserver les changements d’opacité instantanés.

### 2.4 Élévation

| Niveau | Usage | z-index |
|---|---|---:|
| base | contenu | `0` |
| sticky | entêtes planning/sidebar | `10` |
| dropdown | menus, tooltips | `30` |
| drawer | inspecteur latéral | `40` |
| modal | confirmation | `50` |
| toast | notification | `60` |

## 3. Grille et responsive

### Desktop `≥1280px`

- App shell : rail navigation `64px`, sidebar contextuelle `240px` facultative, contenu `minmax(0, 1fr)`.
- Barre supérieure : `56px`. Barre d’outils planning : `48px`.
- Inspecteur : drawer non modal `400px`, redimensionnable de `360–520px` ; le planning conserve au moins `720px`.
- Hauteur ligne ressource : confortable `56px`, dense `44px` (préférence persistée).

### Tablette `768–1279px`

- Rail `56px`; sidebar contextuelle en overlay.
- Inspecteur modal latéral `min(440px, 90vw)`.
- Les filtres secondaires passent dans un popover ; vue planning par défaut `Jour` ou `3 jours`.

### Mobile `<768px`

- Navigation basse `56px`, 4 destinations maximum : Aujourd’hui, Planning, Projets, Plus.
- Vue par défaut : agenda par jour, regroupé par ressource ; pas de grille mensuelle interactive.
- Création/édition dans une feuille plein écran. Drag-and-drop remplacé par `Déplacer` puis sélection du créneau.
- Cibles tactiles minimales `44×44px`, marges latérales `16px`.

Breakpoints CSS de référence : `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.

## 4. App shell et navigation

Ordre du rail : logo/espace société, Aujourd’hui, Planning, Projets, Clients, Ressources, Dashboard, puis Administration en bas selon permission. Chaque item expose icône + tooltip et `aria-current="page"`.

Barre supérieure : breadcrumb/context switcher à gauche ; recherche globale (`⌘/Ctrl K`), aide, notifications et profil à droite. Le sélecteur société/site est toujours visible si l’utilisateur a plusieurs périmètres.

Règles :

- L’URL encode vue, date, filtres partageables et ressource sélectionnée.
- Retour navigateur restaure précisément état et scroll.
- Les destinations non autorisées ne sont ni affichées ni accessibles par URL.
- Le changement de société/site demande confirmation uniquement si un formulaire contient des modifications non enregistrées.

## 5. Composants

### Boutons

Hauteur `32px` dense, `36px` standard, `44px` tactile. Variants : `primary`, `secondary`, `ghost`, `danger`. Un seul bouton primaire par zone. État loading : spinner + libellé conservé, largeur stable, `aria-busy=true`.

### Champs

Label visible au-dessus, aide puis erreur sous le contrôle. Hauteur standard `36px`. Focus : anneau `2px --color-focus` avec offset `2px`. Erreur : texte explicite et `aria-describedby`; ne jamais utiliser seulement une bordure rouge. Dates affichées selon locale, stockées en ISO 8601 ; timezone visible dès qu’elle diffère de celle du site.

### Select / Combobox

Recherche à partir de 8 options. Navigation flèches, sélection Entrée, fermeture Échap. Les listes longues sont virtualisées et annoncent le nombre de résultats. Multi-select rendu en résumé (`3 ressources`) au-delà de deux chips.

### Badges

Hauteur `20px`, padding horizontal `6px`, texte `11/16 semibold`. Toujours associer icône/texte à l’état. Maximum 2 badges visibles dans une carte planning ; le reste est dans le détail.

### Tables

Entête sticky `40px`, ligne `40px` dense ou `48px` standard. Tri annoncé via `aria-sort`; sélection multiple avec checkbox nommée. Menu de ligne accessible au clavier. Colonnes épinglables et redimensionnables ; préférences persistées par utilisateur. Prévoir skeleton de structure, empty state contextualisé et pagination/virtualisation.

### Drawer d’inspection

Ouverture sans quitter le contexte. Entête sticky : titre, statut, précédent/suivant, fermer. Pied sticky : action primaire et actions secondaires. Échap ferme seulement si aucun changement ; sinon dialogue `Ignorer les modifications ?`. Après fermeture, le focus revient à l’élément déclencheur.

### Dialogues

Réservés aux décisions irréversibles ou aux choix bloquants. Piège de focus, titre relié par `aria-labelledby`, description par `aria-describedby`. Le bouton destructif nomme la conséquence (`Supprimer la réservation`).

### Toasts

Confirmation 4 s, erreur persistante jusqu’à fermeture, maximum 3. Les erreurs proposent une action (`Réessayer`, `Voir le conflit`). Utiliser `role=status` pour succès, `role=alert` pour erreur. Une action réversible affiche `Annuler` durant 8 s.

### États de chargement et vides

- `≤300ms` : aucun skeleton pour éviter le scintillement.
- `>300ms` : skeleton fidèle à la structure, jamais de spinner plein écran.
- Actualisation : conserver les données visibles avec indicateur discret.
- État vide : cause + prochaine action. Exemple : `Aucune réservation cette semaine` + `Créer une réservation`.
- Erreur partielle : isoler le panneau fautif, conserver le reste utilisable.

## 6. Planning — composant central

### Anatomie

1. Barre d’outils : Aujourd’hui, précédent/suivant, plage de dates, vue Jour/Semaine/Mois, zoom, filtres, densité, créer.
2. Colonne ressources sticky : groupe, nom, type, capacité/état ; largeur `220px`, redimensionnable `180–320px`.
3. Axe temps sticky : marqueurs majeurs et mineurs ; ligne `maintenant` actualisée chaque minute.
4. Grille : jours ouvrés normaux, hors horaires légèrement ombrés, indisponibilités hachurées.
5. Mini résumé de filtres sous la toolbar lorsqu’au moins un filtre est actif.

### Échelle et dimensions

- Jour : pas de grille `15 min`, labels horaires toutes les heures.
- Semaine : pas `30 min`, séparation de jour forte.
- Mois : vue capacité/occupation agrégée, pas de drag pour modifier une durée.
- Largeur minimale d’un bloc : `24px`; en dessous, afficher seulement le statut et le tooltip/détail au focus.
- Un chevauchement utilise des lanes côte à côte jusqu’à 3 ; au-delà, compteur `+N` ouvrant une liste accessible.

### Carte réservation

Contenu par priorité : titre projet, plage horaire, client, phase/épisode, opérateur. En mode dense : titre + horaire. `aria-label` complet : `Montage épisode 4, Studio A, 10 h à 12 h, option, conflit avec…`.

Interactions :

- Clic : sélectionner et ouvrir l’inspecteur.
- Double-clic ou Entrée : éditer.
- Drag horizontal : déplacer ; poignées gauche/droite : redimensionner.
- Drag vertical : changer de ressource si autorisé.
- Pendant drag : aperçu fantôme, créneau cible, heure exacte et impact de conflit.
- Snap par défaut `15 min`, modification avec touche `Alt/Option` à `5 min`.
- `Échap` annule ; annonce live du résultat ; mutation optimiste seulement si rollback sûr.

Alternative clavier : focus carte → `M` déplacer → flèches (15 min), `Shift+flèche` (1 h), `Alt/Option+flèche` (5 min), `Ctrl/Cmd+flèche haut/bas` change de ressource, Entrée confirme, Échap annule. `R` active le redimensionnement de fin. Un menu `…` expose les mêmes commandes.

### Conflits

Trois niveaux : `bloquant` (double réservation/indisponibilité), `avertissement` (hors horaires/capacité recommandée), `information` (préférence). Avant validation, afficher dans un popover ancré : cause, réservation affectée, ressource, plage, solutions possibles. Un conflit bloquant interdit `Confirmer` sauf permission explicite `override_conflict`, avec justification obligatoire et audit.

## 7. Dashboard

- Rangée 1 : KPI Occupation, Heures réservées, Ressources sous-utilisées, Conflits ouverts. Chaque KPI affiche valeur, période et comparaison libellée.
- Rangée 2 : courbe d’occupation et répartition par type de ressource.
- Rangée 3 : prochaines réservations et alertes.
- Tous les graphiques ont un résumé textuel et une table de données accessible.
- Un clic sur une donnée ouvre le planning avec les filtres correspondants ; la période active reste visible.

## 8. Accessibilité et internationalisation

- Ordre de focus calqué sur la lecture ; lien `Aller au contenu` en premier.
- Aucun piège clavier hors modal. Focus visible en permanence pour les entrées clavier.
- La grille expose un nom, des lignes ressources, colonnes temporelles et instructions clavier courtes. Pour les très grandes grilles virtualisées, fournir en parallèle une vue liste accessible avec les mêmes actions.
- Les mises à jour de drag, conflits et sauvegarde sont annoncées via une région `aria-live=polite`; erreurs critiques via `assertive`.
- Zoom navigateur 200 % sans perte d’action ; reflow à 400 % sur écrans étroits.
- Support clair/sombre/système ; ne pas déduire le thème de la société.
- Locale initiale `fr-FR`, format 24 h, semaine commençant lundi. Prévoir traduction sans concaténation de fragments et +30 % de longueur de libellé.

## 9. Performance perçue

- Interaction pointeur/clavier : retour visuel `<100ms`.
- Navigation interne : contenu utile `<1s` sur connexion nominale.
- Drag : cible `60 fps`; aucun fetch pendant chaque mouvement, uniquement à la fin ou par préchargement.
- Virtualiser ressources et événements hors viewport, tout en conservant focus et sélection.
- Précharger plage adjacente au repos. Conserver position et sélection lors d’une actualisation.

## 10. Contrat de livraison frontend

Chaque composant doit livrer : variantes, états default/hover/focus/active/disabled/loading/error, navigation clavier, nom accessible, tests axe, RTL-ready même si non activé, et story de grande densité. Les tests visuels couvrent clair/sombre, desktop `1440×900`, tablette `1024×768`, mobile `390×844`, zoom 200 % et réduction des mouvements.

