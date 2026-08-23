# Revue SECURITY indépendante — G6 PlanyBot et import Excel

Date : 2026-08-23

Candidat Git : `6381cbeb7020d57ac21e2086a3d5475d9d675325`

Verdict : **APPROVED — 0 P0, 0 P1, 0 P2**

## Périmètre et empreintes

| Fichier | SHA-256 |
|---|---|
| `server.js` | `458a9c08cb26cc45ecb3613f7d743d996a70100bd4ccbf38416c221bcce29062` |
| `app.js` | `d3bf84b126371213f59b18d1aac5612bfd2770f1aab205a66246894ee45e9d54` |
| `tests/plany.test.js` | `34cbab3d8ffbc55cf961c801eb48ed6a11babace731939848136b9a4db3a7030` |
| `tests/quotes.test.js` | `16e138f0a4bb50d72bed8a82e59e28c6aa1ebfa616a41ec6af0537fc4f02050a` |
| `docs/api/openapi-v1.yaml` | `ea5a084ce6ce88fdf252108dac3d865c73506cecd331984fb9dbd5df46c4b83a` |
| `docs/specifications/sprint-6-planybot-excel.md` | `9c1468a368a299eb5ee5a80a5c11348778d027ea1e00eea4fd7ff96a86a915f1` |

La revue couvre les corrections des deux P1 précédents ainsi que les chemins G6 d'authentification, CSRF/origine, RBAC, isolation société/site/projet/entité, rejeu, historique, import, clarification, idempotence, XSS, audit et stockage privé.

## Fermeture des constats précédents

### SEC-G6-01 — provenance et revalidation des replays : **FERMÉ**

- Chaque réponse construit un instantané minimal des projets, sites, devis, imports, ressources, réservations et membres effectivement exposés.
- Cette provenance est persistée sur les messages, la conversation et le marqueur d'idempotence, y compris lorsque le Projet est inféré depuis le texte plutôt que fourni dans le contexte.
- Le rejeu et la lecture d'historique revalident société, sites, projets et scopes d'entités courants. Une provenance absente échoue fermée ; les données héritées ne sont acceptées que si une provenance reconstituable est encore autorisée.
- Le test négatif réduit le scope du lecteur après une réponse sur `project_1` : le rejeu exact et l'historique retournent ensuite tous deux `404 NOT_FOUND`.

Conclusion : aucune restitution historique n'a été trouvée après révocation du Projet testé.

### SEC-G6-02 — décompression cumulée et déni de service : **FERMÉ**

- XLSX : plafonds sur 256 entrées ZIP, 40 entrées utiles, 32 feuilles, 8 MiB par entrée, 16 MiB cumulés, 10 000 lignes, 256 colonnes, 100 000 cellules, 20 000 chaînes partagées et 5 000 fusions.
- PDF : 64 flux, 8 MiB par flux, 16 MiB cumulés et 10 000 blocs texte.
- CSV : lignes, colonnes et cellules sont également plafonnées.
- La décompression utilise les API asynchrones `zlib.inflateRaw` / `zlib.inflate` avec `maxOutputLength`; le volume réel est revérifié après décompression, ce qui empêche de contourner les tailles déclarées du ZIP.
- Un XLSX synthétique de 3 feuilles déclarant 18 874 368 octets décompressés pour 18 772 octets compressés est refusé en `17,25 ms` avec `422 CLIENT_PLANNING_LIMIT_EXCEEDED`.
- Le test HTTP de non-régression vérifie aussi qu'un dépassement structurel ne persiste aucune analyse.

Conclusion : le volume de travail et la mémoire allouable par une analyse sont désormais bornés et l'échec intervient avant toute mutation métier.

## Autres contrôles satisfaisants

- Les mutations exigent session, CSRF/origine et permissions serveur. L'analyse exige `quote.manage` et `planning.read`; la confirmation Planning reste sous `planning.write`.
- `companyId` provient de la session. Les recherches de Projet, Devis, import, ressource, réservation et membre combinent société et scopes courants, sans révéler l'existence hors périmètre.
- L'import direct Excel vers un Devis brouillon refuse les lignes ambiguës/non reconnues avant clarification humaine versionnée. Toute dérive entre la dernière révision confirmée et `apply-lines` retourne un conflit stable.
- Les retries d'application et de confirmation sont idempotents ; un corps divergent avec la même clé est refusé et aucun doublon de ligne ou réservation n'est créé.
- Les formules Excel ne sont pas exécutées. Les entrées ZIP et noms fournis ne deviennent ni chemins locaux ni URL. Les fichiers sont renommés par digest, privés (`0600`) et hors liste statique.
- Les textes PlanyBot et champs de prévisualisation sont échappés par `esc()` avant injection DOM. Aucun rendu HTML issu du message utilisateur n'a été identifié.
- Les coûts internes restent absents des réponses sans `finance.read`; les préférences tarifaires requièrent `quote.read`.
- Audit et SSE suivent le succès des mutations ; l'analyse seule et la clarification ne créent aucune réservation.

## Preuves fraîches

- `node --test tests/plany.test.js tests/quotes.test.js` — Node `v26.6.0`, 2026-08-23 : **62/62 PASS**, 0 échec, durée `4825 ms`.
- Test local borné d'un XLSX à volume décompressé cumulé supérieur à 16 MiB : **PASS**, `422 CLIENT_PLANNING_LIMIT_EXCEEDED`, durée `17,25 ms`.
- Inspection indépendante du diff `cdc475c9…6381cbeb`, des routes G6, des filtres de scope, des sorties DOM, des limites de parse et des tests négatifs.

## Limites

- Aucun fuzzing externe ni fichier malveillant non synthétique n'a été exécuté.
- La mesure utilise un ZIP synthétique sûr ; elle démontre l'application du quota cumulé, pas la résistance à toutes les variantes historiques du format Office.
- L'application reste un monolithe local mono-processus avec persistance JSON, conformément au périmètre RC2 ; cette architecture n'est pas évaluée comme service Internet multi-tenant de production.
- `docs/project-status.md` reste à mettre à jour par l'intégrateur conformément à l'ownership demandé.

## Verdict

Les deux P1 précédents sont fermés et aucun contournement critique ou élevé n'a été identifié sur le candidat exact. **SECURITY APPROVED** pour G6 sur `6381cbeb7020d57ac21e2086a3d5475d9d675325`.
