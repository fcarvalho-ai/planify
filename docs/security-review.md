# Revue SECURITY indépendante — G6, revalidation terminale

Date : 2026-08-23

Candidat Git : `b25c61d085644525c18ce18a7b25d5b9f81c222c`

Verdict : **REJECTED — 0 P0, 1 P1, 0 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `5025a767d5d05bc08a46aab00d8a2302d86838ce4f3f0d5e8cc817cec91a5a7d` |
| `app.js` | `d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54` |
| `tests/plany.test.js` | `cfd8e782b2a78e00533a3f111337dcb266adcb7dfe91acb67e969e16c79acc58` |
| `tests/quotes.test.js` | `16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a` |
| `docs/api/openapi-v1.yaml` | `0632ef9e0c18adf793e662e883398701146c9a55a7a5fd73801ffe6ecd6a61fb` |
| `docs/specifications/sprint-6-planybot-excel.md` | `39ce221aff88530d0e33e95df82be1aeb9aaafb81897894e9d20305622ddfa23` |

La revue porte sur la permission commerciale `quote.read`, les gardes de scope `schemaVersion: 3`, le rejeu et l'historique fail-closed, la compacité de provenance et les régressions tenant/RBAC/XSS/idempotence du diff `14c1268…b25c61d`.

## Contrôles conformes

- Une réponse qui expose directement un Devis exige toujours `quote.read`. Une recommandation qui utilise une préférence tarifaire client ajoute maintenant aussi explicitement `quote.read`.
- La provenance v3 échoue fermée si elle est absente ou d'une autre version. Le rejeu idempotent et l'historique appellent le même contrôle courant ; aucune reconstruction permissive d'une ancienne provenance n'a été réintroduite.
- Les listes complètes de réservations/ressources ne sont plus persistées pour les agrégats. Les faits directement exposés restent accompagnés de leurs identifiants bornés ; les agrégats portent une empreinte compacte.
- La révocation de `quote.read` et la réduction des scopes d'entités Réservation/Ressource rendent bien le rejeu et l'historique inaccessibles dans les tests automatisés.
- Aucun nouveau bypass tenant, XSS ou idempotence n'a été identifié dans le diff. `companyId` reste dérivé de la session et les filtres d'entités directement exposées restent côté serveur.
- `node --test tests/plany.test.js`, Node `v26.6.0`, exécution locale autorisée : **14/14 PASS**, 0 échec, durée `715,71 ms`. La première tentative sous sandbox a échoué uniquement sur `listen EPERM 127.0.0.1` et n'est pas comptée comme résultat produit.

## P1 bloquant

### SEC-G6-04 — le garde compact ne couvre pas le retrait d'un site source

`planyEntityScopeGuard` empreinte uniquement `organizationScope` ou `entityScopes[reservation|resource]`. Il n'empreinte pas les `siteIds` effectifs. Or un résumé Projet demandé sans `context.siteId` agrège toutes les réservations visibles du Projet, potentiellement sur plusieurs sites, mais sa provenance n'enregistre aucun `siteId` source : elle ne contient que le Projet et les deux gardes d'entités.

Preuve fraîche isolée sur les fonctions exactes du candidat :

1. utilisateur limité aux sites Paris et Boulogne, Projet `project_1` autorisé, scopes d'entités non restreints ;
2. résumé du Projet sans site explicite, avec une réservation Paris et une réservation Boulogne : `reservationCount: 2` ;
3. provenance générée : `siteIds: []`, gardes Réservation/Ressource à `unrestricted` ;
4. retrait de `site_boulogne` tout en conservant Paris et le Projet ;
5. `planyAccessAllowed` retourne encore `true` pour l'ancienne réponse.

Le rejeu et l'historique peuvent donc restituer après révocation un agrégat calculé à partir d'un site désormais interdit. Même si le contenu est synthétique (comptages/jours/ressources), il révèle des informations provenant d'un périmètre retiré et viole l'invariant fail-closed.

Condition de fermeture : inclure dans le garde compact l'empreinte canonique des sites effectifs ayant alimenté l'agrégat, ou enregistrer leurs identifiants bornés ; revalider cette empreinte au rejeu/historique. Ajouter un test négatif multi-site où un Projet demeure autorisé après retrait d'un site source. Le même principe doit couvrir tout autre périmètre indirect dont l'agrégat dépend.

## Fermeture du précédent P1 de volumétrie

Le précédent `SEC-G6-03` est fermé : pour 10 000 réservations, la provenance d'un résumé reste à `270 o` en scope organisation et `374 o` avec un scope explicite de 10 000 réservations. Les copies présentes dans messages/conversation/idempotence restent donc de taille constante vis-à-vis du nombre de réservations. La mesure de performance détaillée figure dans `docs/performance-report.md`.

## Limites

- La preuve du retrait de site appelle directement les fonctions du serveur sur un seed local déterministe ; un test HTTP automatisé de ce cas manque encore.
- Aucun fuzzing externe n'a été exécuté dans cette revalidation d'impact.
- Les parseurs d'import et leurs plafonds sont inchangés depuis leur précédente approbation ; ils n'ont pas été remesurés ici.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur conformément à l'ownership limité demandé.

## Verdict

La permission `quote.read`, la révocation des scopes d'entités et la compacité sont conformes. Le retrait d'un site ayant contribué à un agrégat n'est toutefois pas couvert par le garde v3, et replay/history restent autorisés. **SECURITY REJECTED** pour G6 sur `b25c61d085644525c18ce18a7b25d5b9f81c222c`.
