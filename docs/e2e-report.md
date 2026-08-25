# Rapport E2E post-RC5 — Scroll vertical et repérage Client

Date : 2026-08-25
Environnement : macOS arm64, Node.js v26.6.0, navigateur intégré
Candidat applicatif exact : `e39b9b0e2eecf7a0c9abeb0f20ec27650778b09f`

## Verdict

**APPROVED — 0 P0 / 0 P1.**

| Scénario | Résultat observé |
|---|---|
| Connexion administrateur | Authentification locale réussie sur une copie isolée de la démonstration. |
| Couleur Client | Netflix France modifié en `#E64A7A`; confirmation UI « Compte client mis à jour ». |
| Planning accessible | La carte affiche le liseré choisi et un libellé commençant par « Netflix France » ; nom et statut restent les signaux principaux. |
| Scroll vertical réel | Six gestes vers le bas atteignent `scrollTop=6456` dans la grille et la colonne Ressources, avec fenêtre virtuelle `48..75`; six gestes inverses ramènent les deux à `0`, fenêtre `0..38`. |
| Redémarrage/persistance | Après arrêt et redémarrage du serveur, reconnexion et rechargement, `#E64A7A` est toujours présent sur la réservation Netflix. |
| Rôle lecteur | La page Clients reste consultable mais ne contient ni « Nouveau client » ni « Modifier le compte ». |

Limite non bloquante : la transition responsive du `ResizeObserver` est couverte par le contrat et les tests, tandis que cette campagne navigateur a exercé le scroll aux dimensions disponibles sans redimensionnement automatisé du viewport.

Le serveur, l’onglet et le fichier temporaire ont été nettoyés. Le candidat franchit E2E et peut passer au gate RELEASE local.

---

# Rapport E2E RC5 — Planning long et Pilotage

Date : 2026-08-24
Environnement : macOS arm64, Node.js v26.6.0, navigateur intégré
Candidat applicatif exact : `4e094d589ae215f31152110d30f1163929ca1338`

## Verdict

**APPROVED — 0 P0 / 0 P1.**

La campagne différentielle RC5 a rejoué dans l’interface les chemins modifiés depuis RC4, après redémarrage du serveur sur le hash exact. Elle complète le parcours E2E global G8 déjà approuvé ; les chemins de mutation Réservation, conflit/override, annulation, SSE et lecteur sont byte-identiques ou couverts par la suite complète fraîche.

| Scénario | Résultat observé |
|---|---|
| Connexion administrateur | Authentification locale réussie ; Planning reconstruit 75 salles et cinq réservations de démonstration. |
| Vues Planning | Quatre vues seulement : Jour, Semaine, Mois, 3 mois ; aucune commande 6 semaines. |
| Scroll Mois | 92 dates, 3 956 cellules, piste stable ; extrémités `0` et `8 835` atteintes, première date 01/07 et dernière 30/09. |
| Scroll 3 mois | Même période civile et DOM stable ; extrémités `0` et `6 386` atteintes. |
| Projet → Planning | Le Grand Format filtre `project_3`; Mix final et Export masters restent séparés, deux cartes de 58 px sans couverture. |
| Forecast Direction | Trois cartes Horizon 30/60/90, dates françaises, euros, ventilation planifié/à planifier ; aucune clé `scheduledMinor`, `unscheduledMinor`, `totalMinor` ou `through`. |
| Détail Occupation planifiée | Dialogue nommé, 48 sources, pourcentages et états « Sous-utilisé » ; focus initial sur Fermer. |
| Détail Occupation réelle vide | 0 source, état vide explicite, aucune ligne artificielle `— bps`. |
| Fermeture et focus | Bouton Fermer retire le dialogue et restitue le focus au déclencheur « Voir le détail ». |
| Rechargement / reconnexion | Le navigateur redemande la connexion ; après reconnexion, mêmes vues et réservations, console propre. |

Les cas chiffrés `occupancyGap` impossibles à produire sans modifier le seed sont vérifiés sur le même candidat par les négatifs pérennes : une seule période réalisée donne carte/détail `0 bps`; deux lignes `[0,-833]` donnent une moyenne et une carte identiques à `-416 bps`.

Preuves : ciblés QA jusqu’à 135/135, Dashboards 14/14, Planning 46/46, suite complète 345/345, lint/build/diff-check PASS. Aucun accès réseau externe, téléchargement ou donnée réelle n’a été utilisé.

Limite P2 : la fermeture Échap n’a pas été observable via la couche d’automatisation, bien que le gestionnaire natif `cancel` reste présent et testé statiquement. La fermeture accessible principale, le focus et les autres gestes sont prouvés.

Le candidat peut passer au gate RELEASE RC5.

---

# Rapport E2E G8 — Dashboards, exports et surfaces authentifiées

## Addendum vue Projet Planning `0.5.0-rc4` — 2026-08-24

**APPROVED — 0 P0 / 0 P1** sur le candidat applicatif `2fd37e212d19ecc507cfe12f077474f716ec0edd`. La recette navigateur a ouvert « Le Grand Format » depuis Projets puis contrôlé les deux réservations de la salle/date : cartes compactes de `58 px`, ligne de `132 px`, aucune couverture de la ligne suivante et libellés accessibles complets. Les vues heure/demi-journée confinent les piles et conservent la largeur d’une réservation isolée. À forte densité, le DOM est plafonné à 50 cartes avec compteur accessible ; un index `ressource × créneau` maintient le rendu 10k distribué à `40,63 ms` p95 et le scénario 92 jours à `1 064,73 ms`. Scroll profond, axes, restauration et virtualisation utilisent la hauteur publiée et restent alignés. Preuves : ciblés QA 151/151, REVIEW 44/44, SECURITY/PERFORMANCE 61/61, suite complète 341/341, lint/build/diff-check PASS ; quatre gates à 0 P0/P1.

## Addendum scroll Planning `0.5.0-rc3` — 2026-08-24

**APPROVED — 0 P0 / 0 P1** sur le candidat Planning `56b9f456734de9389c1f4ab6623a378448fe2b67`. La recette navigateur a reproduit le défaut à `scrollTop=70` : une réservation temporisée traversait la ligne sticky car les deux couches valaient `4`. La hiérarchie finale est désormais événement `4`, carte focalisée `9`, dates `10`, colonne Ressources `11`, angle fixe `12`. Le contrôle réel confirme que les cellules passent sous les dates ; les axes vertical et horizontal, la synchronisation et la virtualisation restent opérationnels, et la console ne contient aucune erreur. Preuves automatisées : Foundations + Planning 60/60, ciblés QA 150/150, suite complète 340/340, lint/build/diff-check PASS ; REVIEW, QA, SECURITY et PERFORMANCE à 0 P0/P1.

## Addendum visuel `0.5.0-rc2` — 2026-08-24

**APPROVED — 0 P0 / 0 P1** sur le candidat visuel `34a9d7883dcf22cad517bf45393848eaa60d48d8`. La recette navigateur a reproduit l’onglet actif blanc sur fond clair de RC1, puis confirmé sa correction sur les six onglets Pilotage : fond primaire `#6c5ce7`, texte blanc, contraste `4,86:1`. La navigation clavier affiche un contour primaire opaque de 3 px avec un contraste minimal `4,16:1`. Les bordures Réalisations et Finance sont restaurées ; Planning demeure inchangé et la console ne contient aucune erreur ni avertissement. Preuves automatisées : Foundations 17/17, suite complète 340/340, lint/build/diff-check PASS ; REVIEW, QA, SECURITY et PERFORMANCE à 0 P0/P1.

Date : 2026-08-24
Environnement : macOS arm64, Node.js v26.6.0, navigateur intégré
Candidat applicatif : `68489b1fc0575706ecbf13c191ab033dc1981d63`

## Verdict

**APPROVED — 0 P0 / 0 P1.**

| Scénario | Résultat observé |
|---|---|
| Démarrage hors session | Écran de connexion seul ; shell et overlays privés masqués et `inert`. |
| Connexion administrateur | Shell visible ; page Pilotage opérationnelle ; aucune erreur console. |
| Six dashboards | Direction 9 KPI, Finance 15, Planning 6, Commercial 8, Exploitation 7, Chef de projet 10. |
| Filtre et partage | Projet `Horizons — Saison 2` conservé dans `pilotage.projectId=project_1`. |
| Drill-down | Détail réconcilié contenant `reservation_1`. |
| Export | Téléchargement Excel déclenché depuis l’interface. |
| Déconnexion / expiration | Shell caché et `inert`, trois overlays fermés et `inert`, contenu principal purgé, focus e-mail restauré. |
| Reconnexion | Shell réactivé et contenu spécialisé reconstruit sans réouvrir les overlays. |
| Rôle lecteur | Uniquement Planning et Exploitation ; aucun coût, aucune marge ni contrôle financier. |

La QA indépendante a également exercé 24 routes composées et le cycle HTTP `200 → 200 → 204 → 401 → 200 → 200`. Les preuves terminales sont : ciblés jusqu’à 106/106, suite complète 339/339, lint/build/diff-check PASS, quatre gates indépendants à 0 P0/P1. Les limites P2 restantes concernent uniquement une preuve navigateur de profilage plus fine et la rémanence locale de contenu interne d’overlays cachés, sans réexposition ni autorité serveur.

Le serveur et les onglets de test ont été arrêtés proprement. G8 est validé E2E et peut passer au gate RELEASE local.

---

# Rapport E2E S7-C — Backlog signé & Forecast

Date : 2026-08-23
Environnement : macOS arm64, Node.js v26.6.0, navigateur intégré
Candidat applicatif : `05f65c54851701e2ada724d22fed7987edfeef08`
Commit de consolidation des gates : `492e71e`

## Verdict

**APPROVED — 0 P0 / 0 P1, 1 limite P2.**

| Scénario | Résultat observé |
|---|---|
| Connexion administrateur, route `#finance` | Page autonome chargée ; titre, définition, fraîcheur et cinq KPI visibles. |
| Backlog et Forecast sur seed propre | `0,00 €` cohérent sur backlog, 30/60/90 et sans date ; état vide explicite dans le tableau. |
| Accessibilité de lecture | Région « CA signé restant et prévision 30/60/90 jours » et région « Détail du backlog signé » nommées ; tableau avec en-têtes Projet, Devis/prestation, CA signé, produit, backlog et planification. |
| Rechargement / reconnexion | La session locale redemande une authentification ; après reconnexion, les mêmes définitions et montants sont restaurés, sans erreur console. |
| Rôle lecteur | La route Finance affiche « Accès refusé » et exige `finance.read`; aucun montant ni formulaire financier n’est rendu. |
| Contrats chiffrés non nuls | Tests indépendants verts : date `asOf`, arrondis exacts, version du Devis, complément accepté et périodes de la chaîne CA. |

Preuves automatisées du candidat : ciblés jusqu’à 83/83, suite complète 303/303, lint/build/diff-check et OpenAPI sémantique PASS. Performance représentative : p95 Backlog `76,13 ms`, Forecast `71,48 ms`, sous le seuil `<300 ms`.

Limite P2 : cette passe navigateur part d’un seed sans Devis accepté ; elle valide donc l’état vide réel, les permissions et la reconnexion. Le rendu d’un drill-down non nul reste couvert par les tests fonctionnels et devra être repris dans la recette globale G7 avec S7-D.

Le serveur temporaire a été arrêté ; aucune donnée utilisateur n’a été utilisée ni modifiée.

---

# Rapport E2E G6 — PlanyBot & import planning client

Date : 2026-08-23  
Environnement : macOS arm64, Node.js v26.6.0  
Candidat applicatif : `1eab12023a44d65bb9d63dc3bfeba6e04399826f`  
Commit d’intégration : `a9a75c9`

## Verdict

**APPROVED — 0 P0 / 0 P1.**

La recette navigateur et les négatifs contractuels démontrent le parcours G6 complet sans exécution autonome : PlanyBot propose, l’humain confirme ou refuse, puis le moteur métier exécute et persiste.

## Scénarios navigateur

La campagne a utilisé le serveur local `http://127.0.0.1:8212` et une base temporaire isolée.

| Scénario | Résultat observé |
|---|---|
| Connexion administrateur et ouverture du Planning | Planning chargé avec 75 salles et PlanyBot accessible. |
| Proposition PlanyBot | Projet `Horizons — Saison 2`, salle recommandée, période, horaires, statut et motifs affichés avant action. |
| Absence de mutation silencieuse | 5 réservations avant préparation ; toujours 5 avec une proposition `prepared`. |
| Refus au clavier puis action explicite | Statut visible « Proposition refusée. Aucune réservation créée. » et total inchangé. |
| Confirmation explicite | Une seconde proposition confirmée crée une seule réservation `option`; message visible « Réservation créée après votre confirmation. » |
| Actualisation temps réel | La mutation déclenche l’actualisation du Planning et sa relecture API. |
| Permissions lecteur | Aucun bouton « Réserver une salle » ni « Confirmer et créer » ; une conversation administrateur n’est pas exposée et répond « Conversation introuvable ». |
| Persistance | Après arrêt/redémarrage et nouvelle authentification, la réservation du 16 au 17 septembre 2026 réapparaît sur ses deux cellules avec le même Projet, les horaires 09:00–18:00 et le statut Option. |

La recette a aussi confirmé les états textuels et les contrôles natifs du panneau : dialogue nommé, champ de question, prévisualisation structurée, boutons Confirmer/Refuser et information explicite de revalidation.

## Négatifs et non-régression

Les tests E2E contractuels associés ont vérifié :

- conflit de capacité `409`, réservation adjacente acceptée et override motivé audité ;
- idempotence de préparation/confirmation et divergence refusée sans doublon ;
- import Excel/CSV/PDF sans réservation automatique ;
- ligne ambiguë bloquée jusqu’à une clarification humaine versionnée ;
- dérive entre révision et application refusée ;
- rôle lecteur incapable de confirmer ou de muter ;
- revalidation `quote.read`, Projet, sites et scopes Réservation/Ressource au rejeu et dans l’historique ;
- audit, SSE, fichiers sensibles non servis et persistance locale.

## Preuves fraîches

```bash
node --test tests/plany.test.js tests/quotes.test.js tests/api.test.js
npm test
npm run lint
npm run build
git diff --check
```

Résultats :

- ciblés PlanyBot + Devis + API : **104/104 PASS** ;
- suite complète : **270/270 PASS**, 0 échec/skip/todo ;
- lint : **PASS** ;
- build : **PASS**, 5 actifs runtime ;
- diff-check : **PASS**.

Le serveur, l’onglet et les données temporaires ont été arrêtés et supprimés. Aucune donnée utilisateur n’a été modifiée et aucun accès réseau externe n’a été requis.

## Suite

Le candidat peut passer au gate RELEASE. Le P2 déjà suivi sur le double parcours de lecture XLSX générique reste non bloquant et doit rester visible dans les notes de version.
