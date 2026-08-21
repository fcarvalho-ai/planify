# Performance review indépendante — Commercial 08

Date : 2026-08-16  
Candidat : `server.js` `b948492386cb4eb835bde53877d2346136996893fe58d5bbc4724a8e702559e4`, `app.js` `77696c3bdc2e4e9fc40d71152b6685d7c96bda77f86cd08efb536385e5d07ce2`  
Environnement : Node v26.6.0, Darwin arm64, serveur local loopback, persistance JSON atomique sur stockage local  
Fichier isolé : `/private/tmp/planify-commercial-v2-smoke.json`, 8,0 Mio après mesures

## Verdict

**APPROVED — 0 P0, 0 P1 Performance.**

Tous les p95 mesurés restent sous 100 ms. Les lectures sont très inférieures à la référence de 300 ms et les écritures/conflits à la référence de 250 ms définies par `AGENTS.md`. Aucun accès réseau externe ni dépendance distante n'est requis.

## Protocole reproductible

1. Démarrer le candidat avec `PLANIFY_DATA_FILE=/private/tmp/planify-commercial-v2-smoke.json PORT=8194 npm start` après initialisation d'un seed fiscal de démonstration.
2. Se connecter comme administrateur local, conserver cookie et CSRF, puis appeler uniquement `http://127.0.0.1:8194` avec `Origin` correspondant.
3. Constituer 40 documents de 20 lignes, un document de 200 lignes, puis les documents d'import ; le fichier final comporte environ 55 documents ajoutés, plus de 1 200 lignes commerciales, 26 snapshots successifs du document volumique et 101 bookings compatibles.
4. Mesurer séquentiellement avec `performance.now()` côté client : liste, détail, PATCH avec snapshot, liste des versions, PDF, preview dans les trois modes et import. Aucune requête d'échauffement n'est retirée.
5. Arrêter proprement le serveur. Toutes les données de mesure restent hors dépôt dans `/private/tmp`.

## Résultats

| Chemin | Volume / répétitions | p50 | p95 | max | Verdict |
|---|---:|---:|---:|---:|---|
| Création document | 20 lignes, n=40 | 14,27 ms | 21,45 ms | 22,42 ms | Conforme |
| Liste `/quotes?pageSize=200` | ~51 documents à ce stade, n=50 | 14,61 ms | 16,69 ms | 24,86 ms | Conforme |
| Détail document | 200 lignes, n=50 | 11,34 ms | 12,05 ms | 12,43 ms | Conforme |
| PATCH + snapshot immuable | document 200 lignes, n=25 | 59,76 ms | 82,82 ms | 86,87 ms | Conforme `<250 ms` |
| PDF local multipage | document 200 lignes, n=30 | 31,31 ms | 32,00 ms | 34,95 ms | Conforme |
| Liste de versions | 26 versions, n=30 | 31,61 ms | 40,59 ms | 42,68 ms | Conforme |
| Preview, trois groupements | seed 1 booking, n=60 | 32,11 ms | 34,07 ms | 35,43 ms | Conforme |
| Import | seed 1 booking, n=10 | 82,28 ms | 84,48 ms | 84,48 ms | Conforme `<250 ms` |
| Preview, trois groupements | 100 bookings, n=45 | 34,76 ms | 36,89 ms | 37,23 ms | Conforme `<300 ms` |
| Import par mode | 100 bookings, n=3 | 93,99 ms | 96,30 ms | 96,30 ms | Conforme `<250 ms` |

## Analyse

- La génération PDF est linéaire et paginée ; 200 lignes restent à 32 ms au p95 sans troncature.
- Le coût dominant est l'écriture atomique du JSON complet avec capture de snapshot. Même sur un fichier de 8 Mio et un document de 200 lignes, le p95 reste à 83 ms.
- Preview et import bornent la sélection à 200 bookings. Passer de 1 à 100 bookings n'augmente la preview que d'environ 3 ms au p95 ; l'import 100 bookings reste sous 100 ms.
- Les listes paginent à 200 éléments maximum et la liste de versions ne renvoie pas les snapshots complets ; le détail de version reste à la demande.
- Les calculs `BigInt`, remises et regroupements n'introduisent pas de signal de saturation sur ce volume.

## P2 — Risques de croissance à surveiller

1. **Coût global de `readDb()`.** Chaque requête relit et parse le fichier entier ; chaque mutation réécrit l'ensemble. Les résultats sont excellents à 8 Mio, mais la complexité dépend de toutes les collections du tenant, pas seulement du document demandé.
2. **Collections sans rétention.** Versions, audits et clés d'idempotence croissent sans limite. Définir métriques/seuils d'alerte, politique d'archivage compatible avec les obligations commerciales et test à plusieurs centaines de Mio avant usage prolongé.
3. **Absence de contention mesurée.** Le benchmark est séquentiel. Le `writeChain` sérialise correctement les écritures mais une rafale concurrente peut augmenter la latence de file ; ajouter un scénario 10–20 clients simultanés avant déploiement multi-utilisateur soutenu.

## Preuves complémentaires

- `node --test tests/quotes.test.js` : **32/32**, 0 échec.
- `npm test` : **129/129**, 0 échec.
- `node --check server.js`, `node --check app.js`, `git diff --check` : succès.
- Le serveur temporaire a été arrêté ; aucun processus de benchmark n'est laissé actif.

## Limites

- Pas de mesure navigateur de temps de rendu/interactivité, aucun navigateur n'étant connecté ; ce point appartient au gate E2E.
- Pas de TLS, proxy, disque lent, contention concurrente, soak test, document maximal de 500 lignes ou sélection maximale de 200 bookings. Le document 200 lignes et la sélection 100 bookings couvrent le volume MVP retenu pour ce gate.
- Le verdict Performance est indépendant du verdict Security : il ne ferme pas les P1 SSE/migration documentés dans `docs/security-review-commercial-08.md`.
