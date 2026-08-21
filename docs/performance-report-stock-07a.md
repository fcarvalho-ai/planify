# Rapport performance indépendant — Stock 07a

Date : 2026-08-14  
Périmètre : lectures Stock, disponibilité, allocation, persistance JSON et invalidation SSE du lot 07a  
Références : `AGENTS.md`, `docs/spec-rental-stock.md`, `docs/qa-plan-0.2.md`  
Reviewer : Agent 10 indépendant (aucune modification du code ni des tests)

## Verdict

**APPROVED**

Les chemins Stock affectés respectent les seuils applicables sur le jeu volumétrique contractuel. Le p95 le plus élevé est `100,947 ms` pour le contrôle HTTP de disponibilité à 50 lignes, sous `300 ms`. L'allocation HTTP atteint `95,619 ms`, sous `250 ms`. Les réponses paginées restent très inférieures à 1 Mio et l'invalidation vers 20 clients SSE est observée en `78,873 ms`, sous 3 s.

## Environnement et protocole

- macOS 26.5.2 (Build 25F84), Apple M1 Max, 64 Gio ; Node.js v26.6.0, `darwin arm64`.
- Fichier JSON temporaire chaud, port loopback, aucune dépendance externe ni accès réseau.
- Graine : `20260814` ; SHA-256 de la fonction de génération : `17ea96c2db9cd812c716a86301bd9d4ac39a212947637a99117f128216af4046`.
- Jeu de référence : 500 articles, 2 000 exemplaires, 10 000 mouvements, 1 000 réservations sources, demande de 50 lignes ; fichier initial `7 015 286` octets.
- Pour chaque p95 : 5 échauffements exclus, puis 30 mesures séquentielles, base chaude ; médiane/p95/max calculés par rang supérieur. Les erreurs sont nulles.
- Les écritures HTTP traversent réellement auth, lecture/parse JSON, validation du ledger, écriture temporaire + renommage et réponse. Les fichiers temporaires du benchmark sont supprimés après mesure.

Commandes exécutées : `node --check server.js`, `node --check app.js`, `npm test`, puis deux scripts Node injectés sur stdin pour générer les jeux temporaires, mesurer helpers/API et connecter 20 clients SSE. La suite fraîche donne **47/47 tests réussis** en 2,908 s.

## Résultats seed

Jeu : 8 articles, 12 assets, 20 mouvements, 5 réservations, fichier `33 072` octets, requête de disponibilité répétée sur 50 lignes.

| Chemin | Médiane | p95 | Max | Erreurs |
|---|---:|---:|---:|---:|
| Helper disponibilité 50 lignes | 0,141 ms | 0,235 ms | 0,240 ms | 0 |
| Helper reconstruction soldes | 0,006 ms | 0,010 ms | 0,010 ms | 0 |
| API soldes paginés par site | 0,861 ms | 1,433 ms | 1,551 ms | 0 |
| API mouvements paginés par site | 0,755 ms | 1,089 ms | 1,424 ms | 0 |
| API disponibilité 50 lignes | 1,113 ms | 1,579 ms | 2,070 ms | 0 |

## Résultats jeu de référence

| Chemin | Médiane | p95 | Max | Seuil | Verdict |
|---|---:|---:|---:|---:|---|
| Helper reconstruction soldes par site | 2,108 ms | 2,302 ms | 2,345 ms | information | Conforme |
| Helper disponibilité, 50 lignes | 41,108 ms | 42,376 ms | 42,444 ms | `< 300 ms` indicatif | Conforme |
| API soldes paginés par site | 34,443 ms | 35,443 ms | 35,443 ms | `< 300 ms` | Conforme |
| API mouvements paginés par site | 35,566 ms | 37,872 ms | 39,486 ms | `< 300 ms` | Conforme |
| API disponibilité, 50 lignes | 95,134 ms | 100,947 ms | 102,824 ms | `< 300 ms` | Conforme |
| Helper allocation + validation ledger | 4,561 ms | 7,131 ms | 7,655 ms | information | Conforme |
| API allocation + commit JSON | 87,671 ms | 95,619 ms | 95,932 ms | `< 250 ms` | Conforme |

Tailles des réponses de référence : soldes `19 587` octets, mouvements page 100 `35 402` octets, disponibilité `4 338` octets. Toutes sont sous 1 Mio et les pages sont bornées à 100 dans le protocole testé (le serveur impose un plafond absolu de 200).

## SSE, intégrité et robustesse

- 20 connexions SSE authentifiées ouvertes simultanément, mutation Stock commitée, réception par les 20 lecteurs : `78,873 ms`, zéro client manquant, seuil `< 3 s` respecté.
- Après 35 allocations HTTP sur le jeu de référence : `validateStockLedger` retourne `{ valid: true, movementCount: 10035 }`.
- La chaîne d'écriture globale sérialise les commits et l'émission SSE intervient après résolution de `mutate`, donc après renommage atomique réussi.
- Aucun fichier `.tmp` abandonné n'a été observé ; le seul fichier listé avant nettoyage était le fichier de données principal temporaire attendu.

## Analyse de complexité et risques

- `checkStockAvailability` rescane les mouvements pour chaque ligne : complexité approximative `O(lignes × mouvements)`. À 50 × 10 000, la marge reste d'environ 3× sous le seuil HTTP, mais elle diminuera linéairement avec l'historique ; index/projection jetable à envisager avant une croissance significative au-delà du jeu contractuel.
- Chaque requête authentifiée relit et parse le JSON, et chaque mutation réécrit le fichier complet. À environ 7 Mio, l'allocation reste sous 100 ms p95 sur la machine mesurée ; ce résultat ne préjuge pas des disques plus lents ni de plusieurs dizaines de milliers de mouvements supplémentaires.
- `scryptSync`, `readFileSync`, `writeFileSync` et `JSON.stringify` bloquent la boucle Node pendant leur exécution. Le runtime local mono-instance reste conforme à l'incrément, mais ce modèle n'est pas une preuve de scalabilité multi-instance.
- Aucune baseline Stock 07a précédemment validée n'existe ; le critère de régression relative de 15 % n'est donc pas calculable. Ce rapport constitue la baseline candidate.

## Limites explicites

- Le délai SSE 20 clients a été mesuré une fois sur le jeu volumétrique ; les chemins API/helpers, seuls objets du p95, ont 30 mesures chacun.
- Le temps « écran exploitable < 2 s » et le filtrage DOM n'ont pas été instrumentés par navigateur dans ce gate backend ; ils restent à confirmer au gate E2E/UI sur le même état candidat.
- Le scénario de 20 allocations concurrentes sur la dernière unité n'a pas été rebenché ici ; l'intégrité concurrente reste couverte par la sérialisation `writeChain`, les invariants du ledger et doit rester une preuve E2E/QA avant release.
- Les performances de migration v1 → v2 ne sont pas un chemin interactif et n'ont pas de seuil contractuel ; la migration/backup a été couverte fonctionnellement par `npm test`.
