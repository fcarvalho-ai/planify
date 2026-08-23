# Revue PERFORMANCE indépendante — S7-A Réalisé fiable

Date : 2026-08-23

Candidat Git : `5c613d3f683b73fd14830ad76e165dfa641f5749`

Verdict : **NOT APPROVED — 0 P0, 1 P1, 1 P2**

## Périmètre et seuils

Le gate couvre file, liste, détail, confirmation, correction, persistance atomique, UI et SSE. Référence : 100 ressources/10 000 réservations, lecture API p95 `< 300 ms`, conflit + écriture p95 `< 250 ms`, UI exploitable `< 2 s` et interactive.

Les empreintes sont celles de la revue SECURITY S7-A; commit exact `5c613d3f683b73fd14830ad76e165dfa641f5749`.

## Constat bloquant

### PERF-S7A-01 — P1 — validation et projection quadratiques du registre

Deux chemins communs croissent quadratiquement :

1. `sprint7ActualsStateValid()` parcourt tous les records puis filtre toutes les révisions pour chacun. `readDb()` rejoue ce validateur sur chaque requête.
2. `GET /api/v1/actuals` projette tous les records visibles avant `list()`; chaque `actualRecordDto()` refiltre toutes les révisions. `pageSize=200` ne borne donc pas le calcul.

Avec 5 000 records et 5 000 révisions, chaque boucle approche 25 millions de comparaisons; à 10 000, environ 100 millions. Les mutations ajoutent la sérialisation/écriture atomique du fichier complet. Cette complexité invalide la garantie des seuils représentatifs.

Correction requise : indexer une fois `revisionsByActualRecordId`/`currentRevisionById`, valider en O(A+R), paginer les records autorisés avant projection, puis mesurer HTTP sur 100 ressources/10 000 réservations avec un volume représentatif de réalisations. Inclure validation, audit, événement et persistance dans les mesures d'écriture.

## Constat important

### PERF-S7A-02 — P2 — double agrégat complet à chaque invalidation

`loadActuals()` appelle en parallèle `/actuals/pending` et `/actuals`. Chaque événement SSE Actual relance les deux après 250 ms. Il n'existe ni annulation de requête précédente, ni chargement différentiel. Plusieurs confirmations répètent donc scans et reconstruction UI.

Recommandation : invalidation avec curseur/version, requêtes annulables ou rafraîchissement ciblé, en préservant focus et position.

## Mesures fraîches disponibles

Le petit seed fonctionnel donne seulement un contrôle informatif :

| Chemin observé | Durée serveur |
|---|---:|
| File pending | `4–5 ms` |
| Confirmation | `9 ms` (rejeu `8 ms`) |
| Correction | `7 ms` |
| Détail Actual | `5 ms` |

Commande : `node --test tests/sprint7-actuals.test.js tests/migration-sprint7.test.js`, Node `v26.6.0`, **11/11 PASS**, durée totale `572,36 ms`; migration `258,24 ms`.

Ces valeurs concernent quelques réservations et une à deux révisions. Elles ne démontrent pas le dataset contractuel; l'analyse de complexité interdit une extrapolation linéaire.

## Parcours sans nouveau blocage constaté

- Le traitement propre de `pendingActualItems()` est O(R+A) avec index et `Set`, hors coût global de `readDb()`.
- `actualIndexes()` utilise des `Map` pour Réservations/Ressources/Devis.
- Réponses bornées à 200 éléments et invalidations SSE compactes.
- Le coût serveur avant pagination reste toutefois bloquant.

## Limites

- La campagne représentative a été interrompue avant un résultat reproductible; aucun p95 10 000 n'est revendiqué.
- Aucun profil CPU/heap navigateur; le seuil UI `< 2 s` n'est pas démontré.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur.

## Verdict

Le petit seed est rapide, mais les boucles quadratiques et la pagination tardive empêchent toute garantie G7. **PERFORMANCE NOT APPROVED** sur `5c613d3f683b73fd14830ad76e165dfa641f5749`.
