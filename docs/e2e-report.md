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
