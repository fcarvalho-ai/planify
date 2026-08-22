# Revue SECURITY indépendante — correctif post-release `#team`

Date : 2026-08-22
Verdict : **APPROVED — 0 P0, 0 P1, 0 P2**

## Candidat

| Fichier | SHA-256 |
|---|---|
| `server.js` | `8b1e180f94c0101342e4ecda6258e23d5ddafd99c1e9caecdff5cbbd3c51063a` |
| `app.js` | `8a122679a279beedb6c0d6cd8f0bf9197a36124bc60c55bef25d35b93f9823b7` |
| `index.html` | `edada446944aa48c1782028dc52e8b35cf00589156a3016ab0a2cd1bf97504ae` |
| `planning.css` | `4016e6d89ac521cfc22eb42aad17ef16d54db5720e6e8df0bebf6c4739cc57d1` |
| `tests/api.test.js` | `f5c788f3cf74e1fb810b0730a8d18269922179eca7576eeec6ff02bbeb08d2f3` |
| `tests/organization.test.js` | `665257902c792725f0978a5726238eafb5596b2b8059b164dd9169c93741fe16` |
| `docs/api/openapi-v1.yaml` | `75a83115cbeb5712f237884cc9144726e8cfa5b9e0a455d98ab386c1048e2c1e` |

## Contrôles

- `GET /api/v1/personnel-directory` exige `planning.read` côté serveur. Il ne renvoie que `id`, `displayName`, `jobTitle` et un `defaultSiteId` autorisé ; aucun e-mail, `userId`, rôle, scope ou donnée RH libre.
- Société imposée par la session et filtrage `membershipAllowed` ; un site par défaut hors scope est supprimé de la projection. Le test couvre un planificateur restreint à Paris.
- La gouvernance complète `/memberships` reste protégée par `membership.read`. Le lien « Gérer les accès » est masqué sans cette permission.
- Les formulaires et actions ne sont rendus qu’avec `planning.write`; l’API conserve l’autorité et refuse les mutations sans cette permission.
- Les données dynamiques de l’annuaire, des compétences et indisponibilités passent par `esc`; les identifiants d’URL passent par `encodeURIComponent`. Aucun nouveau sink HTML non échappé n’a été introduit.
- Les protections G5 précédentes restent inchangées : CSRF/origine sur mutations, isolation Personnel site/tenant, SSE fail-closed et quotas.

## Preuves

- Inspection indépendante du diff frontend/backend, du contrat OpenAPI et des tests sur les hashes ci-dessus.
- Preuves DEV transmises : API **41/41**, Organisation **34/34**, suite complète **262/262**, lint/build/diff-check PASS ; contrôle navigateur planificateur : 2 membres visibles et sélecteurs alimentés.

## Limites

- Aucun pentest/fuzzing externe.
- Les campagnes automatisées finales ont été exécutées par DEV/intégration ; ce gate réalise une inspection indépendante ciblée du changement.

## Verdict

Le correctif n’ouvre aucune exposition tenant/site, aucun contournement RBAC et aucun risque XSS bloquant : **SECURITY APPROVED**.
