# Sprint 2 V1 — Commercial et noyau Planning

Date de cadrage : 2026-08-20  
Gate cible : G2 — viewport virtualisé sur le jeu cible et devis accepté exploitable.

## 1. Sources et priorité

Ce lot applique, dans cet ordre :

1. les décisions explicites du Product Owner ;
2. `Ordre_Lancement_V1_Equipe_Dev_ELIOTE_FAV.docx` ;
3. `Backlog_V1_Lancement_Equipe_Dev_ELIOTE_FAV.xlsx` ;
4. `docs/spec-mvp.md`, `docs/architecture.md` et les ADR adoptés.

La RC1 reste un monolithe Node.js/CommonJS avec persistance JSON atomique. Aucune migration de stack ou dépendance réseau n'est incluse.

## 2. Périmètre Sprint 2

| Story | Résultat attendu | État d'entrée |
|---|---|---|
| US-017 | Éditeur de Budget | revalidé DEV, gates à exécuter |
| US-018 | Budget confirmé → Devis, source conservée, aucune réservation automatique | revalidé DEV, gates à exécuter |
| US-019 | Éditeur de Devis et tarifs automatiques | revalidé DEV, gates à exécuter |
| US-020 | Cycle commercial jusqu'au Devis accepté | revalidé DEV, gates à exécuter |
| US-021 | Devis accepté immuable, évolution par version/avenant | revalidé DEV, gates à exécuter |
| US-022 | Devis accepté dans le CA signé | revalidé DEV, gates à exécuter |
| US-023 | Historique des versions commerciales | revalidé DEV, gates à exécuter |
| US-024 | Viewport Planning ressources × temps, en-têtes fixes et défilement fluide | intégré, gates à exécuter |
| US-033 | Virtualisation des lignes et du temps, DOM borné, cible 250/10 000 | intégré, gates à exécuter |
| US-034 | Thème clair professionnel, dense et accessible | revalidé DEV, gates à exécuter |
| US-065 | CRUD Ressource | revalidé DEV, gates à exécuter |
| US-066 | Capacité de ressource supérieure à 1 | revalidé DEV, gates à exécuter |
| US-067 | Indisponibilité maintenance visible et bloquante | intégré, gates à exécuter |
| US-069 | Cycle de vie audité des réservations | premier incrément DEV |

Sont exclus : vues Planning avancées du Sprint 3, facturation/encaissement, automatisation autonome par PlanyBot et migration TypeScript/React/SQLite.

## 3. Contrat US-069 — statuts des réservations

Les valeurs persistées et API sont :

- `draft` — brouillon, ne consomme pas la capacité ;
- `option` — option active, consomme la capacité ;
- `confirmed` — confirmée, consomme la capacité ;
- `completed` — réalisée, historique non modifiable et non pris en compte pour un nouveau conflit ;
- `cancelled` — annulée logiquement, historique non modifiable et non consommateur ;
- `unavailable` — indisponibilité opérationnelle, consomme la capacité ;
- `maintenance` — indisponibilité de maintenance, consomme la capacité.

Transitions autorisées :

```text
draft       -> option | confirmed | cancelled
option      -> confirmed | cancelled
confirmed   -> completed | cancelled
unavailable -> cancelled
maintenance -> cancelled
completed   -> (terminal)
cancelled   -> (terminal)
```

Une transition refusée répond `409 RESERVATION_STATUS_TRANSITION_INVALID`, sans mutation, audit ni SSE. Une réservation terminale est en lecture seule. Les changements de statut autorisés sont versionnés, audités avec `before`/`after`, puis diffusés en SSE après le commit. Les contrôles société/site/projet/entité, disponibilité, capacité, idempotence et conflit restent obligatoires.

## 4. Critères d'acceptation du premier incrément

1. L'API accepte les sept statuts canoniques et rejette toute autre valeur.
2. Une transition illégale ou une modification d'un état terminal ne modifie pas la persistance.
3. Seuls `option`, `confirmed`, `unavailable` et `maintenance` bloquent la capacité.
4. Le formulaire Planning expose des libellés français et le serveur demeure l'autorité.
5. OpenAPI, frontend, tests API/domaine et documentation utilisent le même enum.
6. Les anciennes valeurs RC1 `option`, `confirmed`, `cancelled` restent compatibles sans réécriture destructive.

## 5. Performance, sécurité et rollback

Le Sprint 2 doit démontrer sur 250 ressources et 10 000 réservations : lecture Planning p95 < 300 ms, conflit + écriture p95 < 250 ms et interface interactive < 2 s. La virtualisation doit borner le nombre de lignes et colonnes rendues indépendamment du volume total.

Ce premier incrément est additif : aucune migration des réservations historiques n'est requise. Le rollback applicatif consiste à réinstaller le candidat G1 ; les nouvelles valeurs Sprint 2 doivent alors être exportées ou ramenées par une commande compensatoire vers `option`, `confirmed` ou `cancelled` avant rollback. Aucun écrasement silencieux n'est autorisé.

### Viewport virtualisé US-024 / US-033

La matrice conserve la taille logique complète de ses axes mais ne rend qu'une fenêtre surdimensionnée autour du viewport : quatre lignes de sécurité et trois colonnes de sécurité. Les espaces avant/après préservent les dimensions et positions de défilement. Toute modification de la vue, de la date d'ancrage ou des filtres réinitialise proprement la fenêtre ; un simple défilement conserve sa position sur les deux axes.

La preuve DEV sur le jeu cible de 250 ressources et 10 000 réservations a rendu au maximum 18 ressources et 14 dates simultanément. Après défilement vertical, la fenêtre est passée de la ligne 0 à la ligne 3 ; après défilement horizontal, de la colonne 2 à la colonne 9, sans erreur navigateur. La chronologie conserve 250 lignes et 21 dates logiques ainsi que les repères Aujourd'hui/week-end et la colonne Ressources alignée. La mesure interactive finale `< 2 s` reste à confirmer au gate PERFORMANCE G2.

### Indisponibilités et maintenance US-067

Les états `unavailable` et `maintenance` sont visibles par un motif hachuré, un libellé textuel et un intitulé accessible ; la compréhension ne dépend donc pas de la couleur. Ils apparaissent dans le filtre des sept statuts et consomment la capacité. Une réservation concurrente reçoit `409 PLANNING_CONFLICT`. Les états terminaux `completed` et `cancelled` restent affichés mais ne sont ni déplaçables, ni redimensionnables, ni annulables une seconde fois.

### Commercial US-017 à US-023 et entrée G2

La revalidation DEV confirme les deux parcours indépendants : un Budget doit être confirmé par le client avant sa conversion idempotente en Devis, tandis qu'un Devis peut être créé directement sans réservation. La conversion conserve le Budget source et ne crée aucun élément de Planning.

Les tarifs sont résolus dans l'ordre projet, client, catalogue ; une saisie manuelle exige une permission et un motif audité. Le cycle du Devis produit des versions immuables, fige l'instantané fiscal et commercial accepté, puis reconnaît le chiffre d'affaires uniquement au statut `accepted`. Le Devis accepté peut enfin prévisualiser et créer atomiquement ses réservations avec projet, ressources et dates explicites, sans modifier ses lignes ni ses montants HT/TVA/TTC. Le rejeu de conversion retourne le même résultat sans duplication.

Preuve DEV : suite Devis 47/47 et suite complète 216/216 sur le candidat Sprint 2 du 2026-08-20.

### Ressources, capacité et présentation US-034 / US-065 / US-066

Le CRUD Ressource conserve les permissions serveur, le scope société/site/entité, la catégorie active compatible, le contrôle de version, l'idempotence, l'audit et l'archivage logique. La capacité est un entier strictement positif et le moteur cumule les quantités simultanées : plusieurs allocations sont acceptées tant que leur somme reste inférieure ou égale à la capacité, puis refusées avec un conflit stable au dépassement.

Le thème Planning clair a été revalidé sur le jeu cible : colonne Ressources et en-tête temporel fixes, contraste des week-ends sur toute la hauteur, repère Aujourd'hui aligné, focus visible, statuts textuels et hachures pour maintenance/indisponibilité. La densité reste bornée par la virtualisation et n'est pas obtenue en réduisant la lisibilité des dates ou des libellés.

Preuve DEV : Domaine + Fondations + API 66/66 ; contrôle navigateur du viewport cible sans erreur console.

## 6. Gates

Le lot suit `SPEC → DEV → REVIEW → QA → SECURITY/PERFORMANCE → INTEGRATION → E2E`. Le Sprint 2 n'est `APPROVED` qu'après G2 sur un même candidat figé. La validation du premier incrément n'autorise pas à déclarer le viewport virtualisé terminé.
