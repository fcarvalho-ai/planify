# Revue PERFORMANCE indépendante — G6, revalidation ultime

Date : 2026-08-23

Candidat Git : `1eab12023a44d65bb9d63dc3bfeba6e04399826f`

Verdict : **APPROVED — 0 P0, 0 P1, 1 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `d24ef8b32d18ee6b68a9c995d6cbefe6949b26ae3cd24a431e55c5ad2a4e0c84` |
| `app.js` | `d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54` |
| `tests/plany.test.js` | `c4359eacd062967523a1b0197f8470f40719514bc2239123c3d9c82093c4cc5d` |
| `tests/quotes.test.js` | `16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a` |
| `docs/api/openapi-v1.yaml` | `0632ef9e0c18adf793e662e883398701146c9a55a7a5fd73801ffe6ecd6a61fb` |
| `docs/specifications/sprint-6-planybot-excel.md` | `626f41549f742a203caf2a4d495e5d1f8a8cf457ee5afe51a3ac5a7ad848fa77` |

Le chemin modifié ajoute un hash canonique des sites aux gardes compacts. La mesure fraîche couvre un résumé Projet à 10 000 réservations, avec scopes explicites de même cardinal, puis snapshot, revalidation et fusion.

## Benchmark frais 10 000

Environnement : Node `v26.6.0`, seed déterministe local, **10 000 réservations**, scope explicite de 10 000 réservations, huit itérations mesurées après deux échauffements.

| Chemin mesuré | p50 | p95 | max | Taille provenance |
|---|---:|---:|---:|---:|
| Résumé + snapshot + gardes site/entités + revalidation + fusion | `67,69 ms` | `69,36 ms` | `69,36 ms` | `438 o` |

L'ajout du garde de sites maintient la provenance à taille constante vis-à-vis du nombre de réservations. À titre de contrôle, le scénario multi-site fonctionnel produit une provenance de `334 o`. Les copies dans messages, conversation et idempotence restent donc bornées et ne recréent pas l'amplification supprimée au commit précédent.

## Non-régression ciblée

- `node --test tests/plany.test.js` : **14/14 PASS**, durée `906,11 ms`.
- Les cinq réponses agrégées ajoutent un type de garde de cardinal fixe ; aucune boucle sur les réservations n'est ajoutée par ce commit.
- `app.js`, les parseurs CSV/XLSX/PDF et le moteur planning lecture/conflit/écriture sont inchangés.
- Les dernières mesures des chemins inchangés restent informatives : import XLSX représentatif p95 `28,42 ms`, retard de boucle max `29,57 ms`; planning 250 ressources/10 000 réservations, lecture p95 `125,35 ms`, conflit p95 `180,97 ms`, écriture p95 `230,37 ms`. Elles ne sont pas présentées comme nouvelles mesures du candidat.

## P2 non bloquant conservé

### PERF-G6-02 — double parcours de la première feuille générique

`parseClientPlanningXlsx` tente le format spécialisé puis reparcourt la première feuille lorsqu'il ne le reconnaît pas. Le coût reste strictement borné, mais une feuille générique consomme deux fois certains compteurs et duplique du travail. Ce chemin est inchangé par le candidat. Recommandation : analyser une seule fois vers une représentation intermédiaire, ou séparer budget physique et compteurs fonctionnels.

## Limites

- Le benchmark 10 000 appelle directement les fonctions serveur ; il n'inclut pas HTTP ni l'écriture atomique du fichier. Il mesure précisément le calcul de provenance modifié et la taille sérialisée qui constituaient le risque antérieur.
- Huit itérations caractérisent l'ordre de grandeur local mais ne constituent pas une campagne de charge longue.
- Les mesures import/planning reprises concernent des chemins inchangés et servent uniquement à l'analyse de non-régression.
- Aucun chronométrage navigateur supplémentaire : le frontend est inchangé et aucune donnée supplémentaire n'est rendue.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur conformément à l'ownership limité demandé.

## Verdict

Le garde de sites ferme le défaut de sécurité sans réintroduire de liste volumineuse ni de coût significatif. À 10 000 réservations, le chemin complet mesuré reste sous 70 ms et la provenance sous 500 octets. Aucun P0/P1 de performance n'est ouvert ; seul le double parcours générique historique reste P2. **PERFORMANCE APPROVED** pour G6 sur `1eab12023a44d65bb9d63dc3bfeba6e04399826f`.
