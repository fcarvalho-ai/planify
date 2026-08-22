# Revue PERFORMANCE indépendante — correctif post-release `#team`

Date : 2026-08-22
Verdict : **APPROVED — 0 P0, 0 P1, 1 P2 de preuve**

## Candidat

| Fichier | SHA-256 |
|---|---|
| `server.js` | `8b1e180f94c0101342e4ecda6258e23d5ddafd99c1e9caecdff5cbbd3c51063a` |
| `app.js` | `8a122679a279beedb6c0d6cd8f0bf9197a36124bc60c55bef25d35b93f9823b7` |
| `tests/api.test.js` | `f5c788f3cf74e1fb810b0730a8d18269922179eca7576eeec6ff02bbeb08d2f3` |
| `tests/organization.test.js` | `665257902c792725f0978a5726238eafb5596b2b8059b164dd9169c93741fe16` |

## Analyse d’impact

- La page ajoute trois lectures parallèles paginées à 200 éléments maximum : annuaire minimal, compétences et indisponibilités.
- La projection serveur de l’annuaire parcourt les adhésions du tenant, applique `membershipAllowed`, puis ne sérialise que quatre champs. Elle ne touche ni moteur de conflit, ni écriture de réservation, ni SSE.
- Le rendu construit une seule arborescence HTML. Les recherches de nom sont linéaires pour chaque compétence/absence (`members.find`) : au plafond actuel de 200 membres + 200 compétences + 200 absences, la borne reste faible et déterministe.
- Aucun actif, dépendance réseau, polling ou listener continu supplémentaire. Le chargement utilise `Promise.all`.
- Les mesures G5 de référence restent applicables aux chemins planning inchangés : lecture p95 `116,60 ms`, conflit `166,27 ms`, écriture `206,25 ms`, batch100 `249,66 ms` sur 250 ressources/10 000 réservations.

## Preuves

- Inspection indépendante du diff et des bornes de pagination sur les hashes ci-dessus.
- Preuves DEV transmises : API **41/41**, Organisation **34/34**, suite complète **262/262**, lint/build/diff-check PASS ; contrôle navigateur réel avec 2 membres et formulaires alimentés.

## P2 de preuve

**PERF-TEAM-01 — pas de mesure chronométrée dédiée.** Aucun benchmark long n’a été rejoué, conformément au périmètre ciblé. Le verdict repose sur l’analyse d’impact, les bornes de 200 éléments et le contrôle navigateur. Une mesure RUM/DOM serait utile si ces plafonds augmentent.

## Limites

- Pas de chronométrage navigateur automatisé de `#team` ni de profil mémoire DOM.
- Le benchmark planning antérieur ne mesure pas le nouvel endpoint, mais les chemins planning sont inchangés.

## Verdict

Le correctif est borné et n’affecte pas les seuils G5 du planning : **PERFORMANCE APPROVED** sans P0/P1.
