# Rapport d’intégration G8 — Dashboards, exports et sécurité finale

Date : 2026-08-24
Environnement : macOS arm64, Node.js v26.6.0, navigateur intégré
Candidat applicatif : `68489b1fc0575706ecbf13c191ab033dc1981d63`

## Verdict

**APPROVED — 0 P0 / 0 P1.**

Le frontend, l’API, la persistance locale et les permissions ont été rejoués ensemble sur une base temporaire isolée. Le démarrage hors session présente uniquement la connexion. Après authentification administrateur, les six dashboards Direction, Finance, Planning, Commercial, Exploitation et Chef de projet sont accessibles, leurs filtres restent dans l’URL, le drill-down réconcilié restitue la Réservation attendue et l’export Excel est déclenché. Le profil lecteur ne voit que Planning et Exploitation et ne reçoit aucun coût ni marge.

Le correctif final de composition synchronise le shell et les trois overlays avant toute route spécialisée. Le cycle startup → login → logout → `401` → reconnexion masque et rend `inert` les surfaces privées, purge le contenu métier, restitue le focus au champ e-mail, puis reconstruit l’interface après reconnexion. Les 24 routes composées contrôlées réactivent correctement le shell. La console est restée sans erreur ni avertissement.

Preuves fraîches du candidat : Foundations 16/16, ciblés QA 106/106, suite complète 339/339, lint/build/diff-check PASS. REVIEW, QA, SECURITY et PERFORMANCE approuvent le même contenu à 0 P0/P1. Le serveur et les onglets temporaires ont été arrêtés proprement ; aucune donnée utilisateur ni ressource réseau externe n’a été utilisée.

G8 franchit le gate INTEGRATION et peut passer au gate E2E final.

---

# Rapport d’intégration S7-C — Backlog signé & Forecast

Date : 2026-08-23
Environnement : macOS arm64, Node.js v26.6.0
Candidat applicatif : `05f65c54851701e2ada724d22fed7987edfeef08`
Baseline gates : `492e71e`

## Verdict

**APPROVED — 0 P0 / 0 P1.**

Le serveur, les deux routes Finance, le shell navigateur et les permissions ont été rejoués avec une persistance temporaire isolée sur `localhost:8215`. L’administrateur atteint la page « Finance & marges » ; les cartes `FINANCE_BACKLOG@1` et `FINANCE_FORECAST@1`, les fenêtres 30/60/90, l’état sans date et le tableau de détail sont rendus dans une région nommée. Le seed propre ne contient aucun Devis accepté : le zéro et l’état vide sont cohérents et restent identiques après rechargement puis reconnexion. Le lecteur reçoit explicitement « Accès refusé — finance.read est requise ». Aucun avertissement ni erreur navigateur n’a été observé.

Les scénarios non nuls et les contrats aller/retour sont couverts sur le même candidat par les tests indépendants : `asOf`, conservation des centimes, Devis/version/ligne, complément accepté et filtres temporels de la chaîne CA. La suite complète est verte à 303/303 et le benchmark Finance représentatif reste sous 300 ms. Aucun format persistant n’a été ajouté ; le redémarrage ne déclenche donc aucune migration S7-C.

Limite P2 : le smoke navigateur isolé vérifie l’état vide et le refus de permission, tandis que le drill-down non nul est démontré par les tests de contrat plutôt que par une saisie commerciale manuelle dans cette campagne.

Le serveur 8215 a été arrêté proprement. S7-C peut passer au gate E2E, sans valider S7-D ni G7.

---

# Rapport d’intégration G6 — PlanyBot & import planning client

Date : 2026-08-23  
Environnement : macOS arm64, Node.js v26.6.0  
Candidat applicatif : `1eab12023a44d65bb9d63dc3bfeba6e04399826f`  
Baseline documentaire des gates indépendants : `6e0b31f`

## Verdict

**APPROVED — 0 P0 / 0 P1.**

Le frontend, l’API, la persistance JSON, l’audit et l’actualisation SSE fonctionnent ensemble sur le parcours G6. Ce verdict couvre le gate INTEGRATION ; le gate E2E complet et la RELEASE restent à exécuter sur le même candidat.

## Parcours intégré vérifié

Le serveur a été démarré sur `http://127.0.0.1:8212` avec un fichier de données temporaire isolé. Depuis le Planning, après authentification locale administrateur :

1. ouverture de PlanyBot et sélection du projet `Horizons — Saison 2` ;
2. demande d’une salle de montage du 10 au 11 septembre 2026 ;
3. proposition de `Salle de montage AVID 103`, sans réservation créée avant confirmation ;
4. confirmation explicite par l’opérateur ;
5. création d’une unique réservation en statut `option`, visible sur deux cellules journalières ;
6. actualisation temps réel déclenchant la relecture API du Planning ;
7. redémarrage du serveur avec le même fichier, nouvelle authentification et constat de la même réservation persistée.

Identifiants de preuve :

- proposition : `planyProposal_0ac88187-02bf-4156-adfd-d29db114a612` ;
- réservation : `reservation_0264793d-87c9-459c-b581-4913693e1146` ;
- projet : `project_1` ;
- site : `site_paris`.

Avant confirmation, le fichier contenait 5 réservations et 1 proposition non exécutée. Après confirmation, il contenait 6 réservations et la proposition portait le statut `executed`. Les audits `plany.proposalPrepared`, `reservation.created` et `plany.proposalExecuted` étaient présents. Aucune erreur navigateur n’a été relevée.

## Preuves fraîches

Commandes exécutées sur le candidat :

```bash
PLANIFY_DATA_FILE=/private/tmp/planify-g6-integration.json PORT=8212 npm start
npm test
npm run lint
npm run build
git diff --check
```

Résultats :

- suite complète : **270/270 PASS** ;
- lint : **PASS** ;
- build : **PASS**, 5 actifs runtime ;
- contrôle de diff : **PASS** ;
- démarrage, arrêt et redémarrage locaux : **PASS** ;
- persistance après redémarrage : **PASS** ;
- exécution autonome locale sans SaaS, CDN ni ressource réseau : **PASS**.

Le serveur et l’onglet de test ont été arrêtés proprement. Le fichier temporaire et ses sauvegardes de migration ont été supprimés ; aucune donnée utilisateur n’a été modifiée.

## Suite

Exécuter le gate E2E complet sur ce candidat, notamment les permissions lecteur, les conflits/override, l’import avec clarification, le rejeu après réduction de scopes et la persistance après redémarrage. La RELEASE reste bloquée jusqu’à son approbation.
