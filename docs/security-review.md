# Revue SECURITY indépendante — G6, revalidation de provenance

Date : 2026-08-23

Candidat Git : `14c1268cfcdcbefdcee8bf7a6be10419ef307f14`

Verdict : **REJECTED — 0 P0, 1 P1, 0 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `3903abe5d6bf1503dd0102e0fa798f27c8da1a9bae67609ff74eaa85828c1f0c` |
| `app.js` | `d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54` |
| `tests/plany.test.js` | `f3f292017f74163b6e30bb1653604d02c51d44860a87f84bf60b55e80b5a3294` |
| `tests/quotes.test.js` | `16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a` |
| `docs/api/openapi-v1.yaml` | `5c5da7dfd2ea2911a49432112adaad301eeab5ae63b9d6a9c175cce67a2aba84` |
| `docs/specifications/sprint-6-planybot-excel.md` | `94d4bd35683782043c63a6d52ffc1b13e74c6b2d1cf0cbcb5e35c8c322f93ae1` |

La revalidation porte sur le diff `6381cbeb…14c1268` : provenance PlanyBot, permissions requises, relecture/rejeu fail-closed et complétude des paramètres OpenAPI. Les protections d'import déjà mesurées sont reprises uniquement après analyse du diff : aucun changement ne touche les parseurs CSV/XLSX/PDF ni leurs plafonds.

## Contrôles conformes

- Les nouveaux instantanés portent `schemaVersion: 2`. `planyAccessAllowed` refuse explicitement toute provenance absente ou de version différente ; replay et historique ne reconstruisent plus une autorisation à partir de l'état courant.
- `requiredPermissions` est persisté avec la provenance. `planning.read` reste exigé par les routes ; `quote.read` est ajouté quand un devis est exposé et `finance.read` quand une raison tarifaire révèle des coûts.
- Les sources projet propagent désormais les identifiants de réservations et de ressources réellement utilisés. Les tests négatifs couvrent la révocation de permission et la réduction des scopes projet, réservation et ressource.
- L'isolation société/site/projet reste contrôlée côté serveur à la création et à la restitution. Aucun bypass RBAC, tenant, XSS ou idempotence distinct du constat ci-dessous n'a été trouvé.
- Le contrôle sémantique des chemins OpenAPI confirme qu'aucun paramètre de template n'est omis : les quatre opérations devis concernées déclarent bien `quoteId` comme paramètre de chemin requis.
- `node --test tests/plany.test.js` sur Node `v26.6.0` : **14/14 PASS**, 0 échec, durée `648,21 ms`.

## P1 bloquant

### SEC-G6-03 — amplification de ressources par provenance non bornée

`sourceAccess.reservationIds` et `resourceIds` incorporent toutes les réservations et ressources d'un projet sans plafond. Les quotas portent sur le nombre de conversations/messages, mais pas sur la taille de ces listes. Un utilisateur authentifié disposant de `planning.read` peut donc demander à répétition un résumé d'un projet volumineux et provoquer une amplification CPU, mémoire et disque dans le processus local.

L'effet est aggravé par trois propriétés :

1. la déduplication et la validation utilisent `Array.includes` / `Array.some`, soit un coût quadratique sur des listes croissantes ;
2. la même provenance est recopiée dans les messages, la conversation et les enregistrements/résultats d'idempotence ;
3. chaque mutation relit puis réécrit atomiquement l'intégralité du JSON persistant, y compris lors de certains replays.

Mesure fraîche isolant les algorithmes exacts de snapshot, validation et fusion :

| Identifiants | Temps total | Taille JSON d'une seule copie |
|---:|---:|---:|
| 100 | `0,27 ms` | `610 o` |
| 1 000 | `7,64 ms` | `6 910 o` |
| 5 000 | `161,80 ms` | `38 910 o` |
| 10 000 | `399,89 ms` | `78 910 o` |

Ces temps excluent la recherche métier, la lecture/écriture du fichier et les copies persistées. La croissance superlinéaire est reproductible et aucune limite serveur n'arrête l'accumulation avant les quotas de messages. Ce chemin offre donc à un compte autorisé un moyen réaliste de dégrader durablement le service local et de gonfler son stockage ; il contrevient à l'exigence de bornage des entrées/abus.

Condition de fermeture : définir un plafond serveur explicite et testé pour toute provenance, échouer sans mutation au-delà, remplacer les recherches quadratiques par des `Set`/index, et ne persister qu'une représentation canonique ou une référence/digest non dupliqué. Ajouter un test d'abus au plafond et un test répété jusqu'aux quotas de conversation.

## Réutilisation justifiée des preuves d'import

Le diff exact ne modifie aucun parseur, aucune limite ZIP/XML/PDF/CSV et aucun appel zlib. Les preuves du candidat `6381cbeb` restent donc pertinentes pour ces chemins non affectés : XLSX limité à 16 MiB décompressés cumulés, limites structurelles, décompression asynchrone avec `maxOutputLength`, et rejet synthétique en `422 CLIENT_PLANNING_LIMIT_EXCEEDED` avant persistance. Elles ne compensent pas le nouveau P1, qui concerne la provenance générée depuis les données déjà persistées.

## Limites

- Aucun fuzzing externe ni fichier client réel malveillant n'a été exécuté.
- La mesure de provenance est un microbenchmark local des algorithmes, pas un profil de bout en bout avec écriture disque ; elle sous-estime donc le coût réel.
- L'application reste un monolithe local mono-processus à persistance JSON. Le risque évalué est un épuisement local par utilisateur autorisé, pas une exposition Internet anonyme.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur, conformément à l'ownership limité demandé.

## Verdict

La fermeture fail-closed de la provenance et la complétude OpenAPI sont correctes. La provenance non bornée introduit toutefois une amplification CPU/disque exploitable par un utilisateur autorisé et constitue un P1 de disponibilité. **SECURITY REJECTED** pour G6 sur `14c1268cfcdcbefdcee8bf7a6be10419ef307f14`.
