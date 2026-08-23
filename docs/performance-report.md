# Revue PERFORMANCE indépendante — G6 PlanyBot et import Excel

Date : 2026-08-23

Candidat Git : `6381cbeb7020d57ac21e2086a3d5475d9d675325`

Verdict : **APPROVED — 0 P0, 0 P1, 1 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `458a9c08cb26cc45ecb3613f7d743d996a70100bd4ccbf38416c221bcce29062` |
| `app.js` | `d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54` |
| `tests/plany.test.js` | `34cbab3d8ffbc55cf961c801eb48ed6a11babace731939848136b9a4db3a7030` |
| `tests/quotes.test.js` | `16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a` |
| `docs/specifications/sprint-6-planybot-excel.md` | `9c1468a368a299eb5ee5a80a5c11348778d027ea1e00eea4fd7ff96a86a915f1` |

## Fermeture du constat bloquant

### PERF-G6-01 — parsing synchrone et volume non borné : **FERMÉ**

La décompression XLSX/PDF n'utilise plus `inflateRawSync`/`inflateSync` sur le chemin HTTP. Elle passe par les API asynchrones zlib, avec une limite par entrée et un budget décompressé cumulé de 16 MiB. Les nombres d'entrées, feuilles, flux, lignes, colonnes, cellules, chaînes et fusions sont plafonnés avant ou pendant le parcours. CSV applique les mêmes budgets structuraux utiles.

Mesure parser représentative, commande Node locale appelant `parseClientPlanningXlsx` sur une feuille déflatée :

- fixture : 4 001 lignes, 5 colonnes, 20 005 cellules, XML décompressé `1 201 698` octets, XLSX compressé `68 269` octets ;
- 20 itérations : parsing p50 `23,90 ms`, p95 `28,42 ms`, max `35,46 ms` ;
- retard de boucle événementielle mesuré à résolution 1 ms : p50 `1,15 ms`, p95 `23,54 ms`, p99 `27,44 ms`, max `29,57 ms` ;
- état mémoire final : RSS `168 230 912` octets, heap utilisé `13 324 048` octets.

Le traitement XML restant est local et séquentiel, mais son coût est désormais strictement borné. Sur la volumétrie métier mesurée, le retard maximum reste inférieur à 30 ms et ne remet pas en cause l'interactivité du serveur local.

Un test de dépassement cumulé avec 3 feuilles de 6 MiB, soit `18 874 368` octets déclarés décompressés pour `18 772` octets compressés, est refusé en `17,25 ms` avec l'erreur stable attendue. La limite intervient avant toute persistance.

## Non-régression planning 250 / 10 000

Commande : `npm run benchmark:http`

Environnement : Node `v26.6.0`, macOS local, **250 ressources / 10 000 réservations**, fichier `10 847 533` octets.

| Chemin | Mesure fraîche | Seuil | Résultat |
|---|---:|---:|---|
| Lecture réservations | p95 `125,35 ms` | `< 300 ms` | PASS |
| Détection conflit | p95 `180,97 ms` | `< 250 ms` | PASS |
| Écriture unitaire | p95 `230,37 ms` | `< 250 ms` | PASS |
| Batch 100 | p95 `300,95 ms` | aucun seuil G6 explicite | information |
| Rejeu idempotent | `213,45 ms` | — | information |

Durée de la commande : environ `18,4 s`. État mémoire final du processus : RSS `544 768 000` octets, heap utilisé `74 856 208` octets. Les trois seuils contractuels restent respectés.

## P2 non bloquant

### PERF-G6-02 — double parcours de la première feuille générique

`parseClientPlanningXlsx` tente d'abord le format spécialisé post-production, puis reparcourt la première feuille avec le même budget mutable lorsqu'il ne le reconnaît pas. Une feuille générique consomme donc deux fois les compteurs de lignes/cellules : la limite pratique peut être inférieure aux constantes annoncées et du travail XML est répété.

Impact observé : le fichier représentatif de 4 001 lignes reste très rapide, mais un fichier générique proche de 5 000 lignes peut être rejeté avant la limite nominale de 10 000. Recommandation : analyser une fois vers une représentation intermédiaire ou utiliser un budget de sécurité physique distinct des compteurs fonctionnels. Ce point ne crée ni charge non bornée ni dépassement des seuils mesurés ; il ne bloque pas G6.

## Preuves fraîches complémentaires

- `node --test tests/plany.test.js tests/quotes.test.js` : **62/62 PASS**, durée `4825 ms`.
- Benchmark parser 20 itérations et retard de boucle événementielle, résultats détaillés ci-dessus.
- Test du quota décompressé cumulé supérieur à 16 MiB : refus contrôlé en `17,25 ms`.
- `npm run benchmark:http` : lecture, conflit et écriture sous leurs seuils contractuels.

## Limites

- Le smoke HTTP concurrent supplémentaire n'a pas produit de mesure : l'ouverture locale du port a été bloquée par le sandbox, puis la demande d'autorisation a été interrompue. Aucun résultat n'en est revendiqué.
- La réactivité est donc démontrée par le retard direct de boucle événementielle et par le benchmark HTTP planning séparé, pas par une analyse XLSX et une lecture HTTP lancées exactement en parallèle.
- Pas de chronométrage navigateur du panneau PlanyBot dans ce gate ; les corrections évaluées n'ajoutent ni réseau, ni dépendance, ni traitement continu côté interface.
- La mémoire rapportée est un état final, pas un profil complet du pic RSS. Les limites structurelles constituent la protection principale contre les pics.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur conformément à l'ownership demandé.

## Verdict

Le P1 de performance est fermé : décompression asynchrone, volume strictement borné, import représentatif rapide et non-régression planning sous les seuils. Le double parcours générique reste un P2 d'efficacité et de capacité utile, sans caractère bloquant. **PERFORMANCE APPROVED** pour G6 sur `6381cbeb7020d57ac21e2086a3d5475d9d675325`.
