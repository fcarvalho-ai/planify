# Revue SECURITY indépendante — G6, revalidation ultime

Date : 2026-08-23

Candidat Git : `1eab12023a44d65bb9d63dc3bfeba6e04399826f`

Verdict : **APPROVED — 0 P0, 0 P1, 0 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `d24ef8b32d18ee6b68a9c995d6cbefe6949b26ae3cd24a431e55c5ad2a4e0c84` |
| `app.js` | `d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54` |
| `tests/plany.test.js` | `c4359eacd062967523a1b0197f8470f40719514bc2239123c3d9c82093c4cc5d` |
| `tests/quotes.test.js` | `16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a` |
| `docs/api/openapi-v1.yaml` | `0632ef9e0c18adf793e662e883398701146c9a55a7a5fd73801ffe6ecd6a61fb` |
| `docs/specifications/sprint-6-planybot-excel.md` | `626f41549f742a203caf2a4d495e5d1f8a8cf457ee5afe51a3ac5a7ad848fa77` |

La revue couvre la fermeture de `SEC-G6-04`, le rejeu et l'historique après révocation multi-site, les autres réponses agrégées, les permissions commerciales, la provenance compacte, l'isolation et les contrôles fail-closed.

## Fermeture de SEC-G6-04

Le garde v3 sait désormais empreinter le périmètre effectif de sites. Les réponses agrégées qui dépendent de la visibilité Planning déclarent `site` dans `sourceAccess.scopeTypes` : disponibilité du personnel, conflits, résumé Projet, préparation de réservation et disponibilité des ressources. Les gardes Réservation/Ressource restent associés aux agrégats concernés.

Reproduction fraîche sur le scénario exact demandé :

1. utilisateur limité à Paris et Boulogne, Projet autorisé, scopes d'entités non restreints ;
2. résumé du Projet sans site explicite, alimenté par une réservation Paris et une réservation Boulogne : `reservationCount: 2` ;
3. provenance : garde de site SHA-256 présent, taille totale `334 o` ;
4. retrait de Boulogne tout en conservant Paris et le Projet ;
5. revalidation de l'instantané : `false`.

Le test HTTP de non-régression exécute le même parcours et obtient `404` sur le rejeu idempotent ainsi que sur l'historique après retrait de Boulogne. L'ancienne réponse ne peut donc plus être restituée.

## Autres contrôles satisfaisants

- `schemaVersion: 3` est obligatoire. Une provenance absente, ancienne ou dont une permission/garde diffère échoue fermée.
- `quote.read` est requis pour un Devis directement exposé et pour une recommandation utilisant une préférence tarifaire client. Sa révocation bloque replay et historique.
- Les réductions des scopes Projet, Réservation et Ressource sont revalidées et masquent les conversations concernées.
- Les faits directement exposés restent liés à leurs identifiants bornés. Les agrégats volumineux utilisent des gardes compacts ; aucun retour à la persistance de toutes les réservations/ressources n'a été constaté.
- `companyId` reste issu de la session ; les contrôles société, site, Projet et entité sont exécutés côté serveur. Aucun nouveau bypass tenant/RBAC, XSS ou idempotence n'a été identifié dans le diff.
- Les flux client-planning et contrôle de devis restent protégés par les permissions et l'accès au Devis courant ; le contrôle de site d'un Devis est assuré par `quoteAllowed` lors de la revalidation de `quoteIds`.

## Preuves fraîches

- `node --test tests/plany.test.js`, Node `v26.6.0`, exécution locale autorisée : **14/14 PASS**, 0 échec, durée `906,11 ms`.
- Reproduction directe déterministe du scénario Paris/Boulogne : garde présent et `allowedAfterRemoval: false`.
- Inspection indépendante du diff `b25c61d…1eab120` et des cinq réponses agrégées Planning.
- Benchmark 10 000 réservations : provenance constante à `438 o` avec scopes explicites, sans liste source volumineuse.

## Limites

- La reproduction directe complète le test HTTP mais n'est pas elle-même conservée comme test automatisé distinct.
- Aucun fuzzing externe n'a été exécuté dans cette revalidation d'impact.
- Les parseurs d'import et leurs plafonds sont inchangés depuis leur précédente approbation ; ils n'ont pas été remesurés ici.
- Le garde de sites invalide aussi un ancien message lors d'un élargissement de périmètre. Ce comportement conservateur est fail-closed et ne crée aucune fuite.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur conformément à l'ownership limité demandé.

## Verdict

Le correctif couvre le retrait multi-site qui bloquait G6, y compris pour replay et historique, et étend le garde aux autres agrégats Planning. Aucun P0/P1 n'est ouvert. **SECURITY APPROVED** pour G6 sur `1eab12023a44d65bb9d63dc3bfeba6e04399826f`.
