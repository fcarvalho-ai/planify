# Rapport E2E G8 — Dashboards, exports et surfaces authentifiées

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
