# Revue PERFORMANCE indépendante — G6 PlanyBot et import Excel

Date : 2026-08-23

Candidat Git : `cdc475c9ff015531e662327dbdc9d7c2e82f6aa8`

Verdict : **REJECTED — 0 P0, 1 P1, 1 P2 de preuve**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `2c8b7d270daee986524a6011dc1aa9551312af0a4c3dcab8dffe031fc116f372` |
| `app.js` | `2bef5de38aa129788b35b6e05a767390635d368984a02609079b0d8fa309c480` |
| `tests/plany.test.js` | `9ea6407fb3b76b756584c2666d9e184a52f6ad9fcfc0380853baab1529f72687` |
| `tests/quotes.test.js` | `20a28dc983e91b8aa0219ed79d8cac3739c0588d9ef19c19126f81accd86e9e2` |
| `docs/specifications/sprint-6-planybot-excel.md` | `f498e70b697950cbf687d0ddcb9abb8c804114112505f9aef8a7e38adc9437a5` |

## Mesure fraîche de non-régression planning

Commande : `npm run benchmark:http`

Environnement : Node `v26.6.0`, macOS local, données générées par le script : **250 ressources / 10 000 réservations**, fichier `10 847 533` octets.

| Chemin | Mesure | Seuil | Résultat |
|---|---:|---:|---|
| Lecture réservations | p95 `127,56 ms` | `< 300 ms` | PASS |
| Détection conflit | p95 `179,97 ms` | `< 250 ms` | PASS |
| Écriture unitaire | p95 `218,22 ms` | `< 250 ms` | PASS |
| Batch 100 | p95 `276,51 ms` | seuil Sprint 6 non explicite | information |
| Rejeu idempotent | `197,16 ms` | — | information |

Durée totale de la commande : `17,91 s`. Mémoire finale du processus : RSS `537 264 128` octets, heap utilisé `74 787 408` octets. Les seuils historiques lecture/conflit/écriture restent respectés ; le batch100 dépasse toutefois 250 ms si ce seuil était étendu aux lots.

## Constat bloquant

### P1 — PERF-G6-01 — analyse de fichier synchrone et volume décompressé non borné globalement

La route d'analyse décode et analyse XLSX/PDF/CSV dans le gestionnaire HTTP avant la mutation. Pour XLSX, jusqu'à 2 000 entrées sont décompressées avec `inflateRawSync`, chacune jusqu'à 20 MiB, puis toutes conservées en mémoire ; aucun plafond agrégé n'existe (`server.js:1961-1966`). Le PDF utilise aussi `inflateSync` par flux sans budget cumulé (`server.js:1999`). Les feuilles XML sont ensuite parcourues par expressions régulières sur le même thread.

Un classeur compressé conforme à la limite d'entrée peut donc bloquer durablement la boucle événementielle et provoquer une très forte consommation mémoire. Le critère Sprint 6 « analyse représentative interactive et non bloquante » n'est pas démontrable avec cette architecture et peut être violé par une entrée autorisée.

Condition de fermeture : plafonds cumulés et structuraux, parsing incrémental ou traitement isolé/interruptible avec budget temps/mémoire, puis mesure concurrente démontrant que les lectures planning/SSE restent réactives pendant l'analyse d'un fichier représentatif à la borne.

## P2 de preuve

### P2 — PERF-G6-02 — absence de benchmark représentatif PlanyBot/import

Les tests fonctionnels PlanyBot et devis passent rapidement, mais le classeur de test n'établit pas une volumétrie métier représentative ni la latence UI `< 2 s`. Aucun profil n'isole recommandation PlanyBot, analyse Excel, mémoire de pic et impact SSE sous concurrence. Après correction du P1, ces mesures doivent être ajoutées à la preuve G6.

## Analyse d'impact PlanyBot

- Les conversations (20/utilisateur), messages (environ 50/conversation), propositions actives (40/utilisateur), résultats et recommandations (listes tronquées) sont bornés.
- Les recherches et recommandations parcourent en mémoire projets, réservations et ressources autorisés ; aucun appel réseau ni dépendance distante.
- La confirmation réutilise le moteur de réservation, le contrôle de conflit, l'écriture atomique et l'émission SSE existants.
- Les tests ciblés frais `node --test tests/plany.test.js tests/quotes.test.js` passent **60/60** en `5020 ms`, sans constituer un benchmark de charge.

## Limites

- Aucun fichier « bombe » n'a été exécuté pour préserver la disponibilité de la machine.
- Pas de chronométrage navigateur ni de mesure du temps interactif UI PlanyBot/import.
- Le benchmark HTTP mesure le planning, pas une analyse Excel concurrente ; sa mémoire finale n'est pas un pic d'import.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

## Verdict

La non-régression du moteur planning est démontrée sur 250/10 000 pour les trois seuils contractuels, mais l'import synchrone à décompression cumulée non bornée est bloquant. **PERFORMANCE REJECTED** jusqu'à correction et preuve représentative.
