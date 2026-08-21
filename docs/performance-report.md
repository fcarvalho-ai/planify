# Revue PERFORMANCE indépendante — Gate G5

Date : 2026-08-21  
Reviewer : gate PERFORMANCE indépendant  
Verdict : **APPROVED — 0 P0, 0 P1, 2 P2 de preuve**

## Candidat vérifié

| Fichier | SHA-256 |
|---|---|
| `server.js` | `b9b6294f5816ca8ed12d7be1789127e4a9bc1f19d7f2e25a12ef8a3db5c0d200` |
| `app.js` | `04f7a5a9ce015e6d2ae00d1faa092f63023ded430c2c8dff11944f1e394f5054` |
| `tests/api.test.js` | `1e581cec20a6f19e82d91dee9fa953ec3d20858803f11a53e9652229c2ec342b` |
| `tests/sprint5-realtime.test.js` | `d8b17b3ac2f35b70d654552920387f4108f2ad18e0b7763d1e334db9f9320cf9` |

## Mesure fraîche représentative

- Node.js `v26.6.0`, mono-processus local.
- Jeu déterministe : **250 ressources / 10 000 réservations**, fichier JSON `10 846 935` octets.
- Commande : `npm run benchmark:http`.
- Itérations : 30 lectures, 30 conflits, 20 écritures, 10 batchs de 100.

| Chemin | p50 | p95 | max | Seuil | Résultat |
|---|---:|---:|---:|---:|---|
| Lecture planning | 114,18 ms | **116,60 ms** | 116,98 ms | `< 300 ms` | PASS |
| Détection conflit | 164,51 ms | **166,27 ms** | 168,37 ms | `< 250 ms` | PASS |
| Écriture | 203,00 ms | **206,25 ms** | 206,49 ms | `< 250 ms` | PASS |
| Batch 100 actions | 225,58 ms | **249,66 ms** | 249,66 ms | cible 250 ms | PASS, marge faible |
| Rejeu idempotent | — | 187,22 ms (1 mesure) | — | information | PASS |

Mémoire en fin de campagne : RSS `527 630 336` octets ; heap utilisée `74 684 464` octets. Aucun seuil mémoire produit n’est défini.

## Impact du correctif final

La mesure ci-dessus porte sur le serveur `dd5d410a…`. Le candidat final `b9b6294f…` ajoute uniquement l’application de `personnelSnapshotAllowed` aux chemins liste/suppression d’indisponibilités et leurs tests HTTP. Ces filtres concernent la collection Personnel et n’altèrent ni lecture planning, ni moteur de conflit, ni écriture/batch de réservations. L’analyse d’impact ne justifie donc pas de rejouer le benchmark long.

Le scénario temps réel ciblé démontre trois sessions, deux flux SSE simultanés, diffusion d’événements, conflit optimiste, libération de présence au logout, reconnexion et redémarrage. Le doublon d’une même session est rejeté en `429`. Le plafond global évite une croissance sans borne.

## P2 de preuve

### PERF-G5-01 — batch 100 proche de la cible

Le p95 `249,66 ms` respecte la cible, avec moins de 0,4 ms de marge. Une machine plus lente peut la dépasser. Optimiser la persistance batch ou formaliser son seuil avant RELEASE reste recommandé.

### PERF-G5-02 — UI et forte charge SSE non mesurées

La campagne ne mesure pas le Planning authentifié `< 2 s` dans un navigateur avec 250/10 000, ni un p95 à 20 flux SSE. Une tentative de mesure SSE supplémentaire a été interrompue et n’est pas utilisée comme preuve. Le test fonctionnel à deux flux confirme le comportement, pas sa capacité sous forte charge.

## Limites

- Mesure locale mono-processus et persistance JSON, sans stockage réseau.
- Dix observations seulement pour le batch 100.
- Pas de campagne longue durée/GC ni seuil mémoire.
- Pas de mesure UI authentifiée, scroll ou vues Planning sur ce hash.
- Les deux contrôles inter-site finaux sont couverts par analyse d’impact performance, pas par un nouveau benchmark complet.

## Verdict

Les seuils API contractuels sont respectés et aucun P0/P1 performance n’est ouvert : **PERFORMANCE G5 est APPROVED**. Les limites UI/SSE et la faible marge batch restent visibles pour les gates aval.
