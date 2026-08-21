# Conventions API V1

Statut : candidat Gate G0 — 2026-08-19  
Contrat : `docs/api/openapi-v1.yaml`

- Préfixe : `/api/v1` ; JSON UTF-8 ; champs `camelCase` ; identifiants opaques.
- La société vient exclusivement de la session. `companyId` et `organizationId` sont refusés dans les commandes qui ne les autorisent pas explicitement.
- Une ressource hors société ou hors scope répond `404`, sans révéler son existence.
- Les listes acceptent `page`, `pageSize` et des filtres bornés ; les nouveaux contrats répondent `{ data, meta }`.
- Une erreur répond `{ error: { code, message, details?, error_id } }`. `requestId` reste temporairement égal à `error_id` pour la RC1.
- Une mutation sensible exige `Idempotency-Key` ou `operation_id`. Même acteur/commande/cible/clé et même payload rejoue le résultat ; un payload différent répond `409 IDEMPOTENCY_CONFLICT`.
- Toute entité concurrente transmet `version`. Une version obsolète répond `409 VERSION_CONFLICT`.
- Les dates-heures d’entrée sont ISO 8601 avec offset ; les intervalles sont semi-ouverts `[début, fin)`.
- CSRF et Origin strict sont requis pour les mutations navigateur.
- Audit et événement de domaine sont écrits dans la même mutation ; le SSE n’est émis qu’après commit.

## Codes stables initiaux

`VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `VERSION_CONFLICT`, `RESOURCE_CONFLICT`, `RESOURCE_UNAVAILABLE`, `CAPACITY_EXCEEDED`, `INVALID_DATE_RANGE`, `MISSING_PRICE`, `QUOTE_LOCKED`, `INVALID_QUOTE_STATUS`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_CONFLICT`, `INTERNAL_ERROR`.

Les routes RC1 non encore enveloppées sont des adaptateurs de compatibilité : leur conversion vers l’enveloppe V1 doit être versionnée et ne doit pas casser `app.js` silencieusement.
