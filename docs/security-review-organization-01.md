# Security review — Organisation 01 / 01b

Date : 2026-08-14  
Candidat : `server.js` SHA-256 `a5807cf8a3a64d1b28959f78dde741cad453fca79b076746a4ec59b9d00e7d7c`, `app.js` SHA-256 `bc7cff11e527652846a162d6fc048cde184b17f3db54f079c1f222f0d58ad1f9`  
Verdict : **APPROVED**

## Constat précédemment bloquant

- **P1 — FERMÉ.** Les réponses de succès des sept routes Organisation sont projetées avec `companyDto`. Le helper `requireVersion(input, item, project)` projette désormais aussi `error.details.current`, et les cinq mutations Company lui passent explicitement `companyDto` (`server.js:684`, `server.js:689`, `server.js:751-757`). Liste, détail, création/rejeu, mutation et conflit ne fournissent donc plus `taxIdentifiers`, `taxCountry`, `vatStatus`, taux/versions ou métadonnées fiscales. La représentation complète reste limitée à `/companies/:id/fiscal-profile`, protégée par `fiscalProfile.read`.

## Contrôles conformes observés

- Authentification/session, adhésion active et permissions effectives recalculées depuis rôles et scopes (`server.js:350-380`).
- Mutations protégées par origine stricte et CSRF (`server.js:382-404`); changement de contexte limité aux adhésions actives, rotation CSRF et fermeture SSE.
- Isolation `companyId`, sites et unités appliquée aux recherches et mutations; les identifiants tenant fournis dans les payloads sont rejetés.
- Mutations fiscales séparées par `fiscalProfile.manage` / `vatRate.manage`, avec contrôle optimiste des versions et références TVA limitées au tenant.
- Audit fiscal sans valeur d'identifiant; SSE réduit à une enveloppe d'invalidation et revalidation session/adhésion/scope avant émission (`server.js:405-417`, `server.js:788-797`).
- Migration `foundation-01b-organization-fiscal-v3` ordonnée, sauvegarde `0600`, digests/comptages et intégrité du marqueur vérifiés; marqueur altéré refusé (`server.js:262-303`).
- Preuve fraîche exécutée sur le même candidat : `npm test`, **82/82**, 0 échec/skip, durée **6 388 ms**. La suite couvre notamment conflit optimiste, projection fiscale liste/détail, RBAC fiscal, isolation, audit/SSE et marqueur de migration; la projection `409` a en outre été vérifiée statiquement sur chacun des cinq appels Company.

## Conclusion

P0 ouvert : **0**. P1 ouvert : **0**. Les chemins auth/session, CSRF/Origin, RBAC/scopes, isolation fiscale, masquage des succès et conflits, audit/SSE et intégrité du marqueur ne présentent plus de défaut bloquant identifié. Gate Sécurité Organisation 01/01b : **APPROVED**.
