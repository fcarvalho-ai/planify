# Revue SECURITY indépendante — Gate G5

Date : 2026-08-21  
Reviewer : gate SECURITY indépendant  
Verdict : **APPROVED — 0 P0, 0 P1, 1 P2**

## Candidat vérifié

| Fichier | SHA-256 |
|---|---|
| `server.js` | `b9b6294f5816ca8ed12d7be1789127e4a9bc1f19d7f2e25a12ef8a3db5c0d200` |
| `app.js` | `04f7a5a9ce015e6d2ae00d1faa092f63023ded430c2c8dff11944f1e394f5054` |
| `tests/api.test.js` | `1e581cec20a6f19e82d91dee9fa953ec3d20858803f11a53e9652229c2ec342b` |
| `tests/sprint5-realtime.test.js` | `d8b17b3ac2f35b70d654552920387f4108f2ad18e0b7763d1e334db9f9320cf9` |

## Preuves

- Relecture indépendante des contrôles auth/session/CSRF, RBAC, société/site/projet/entité, SSE, présence, idempotence, Personnel, migration, sauvegarde et rollback.
- Campagne ciblée exécutée sur le candidat immédiatement antérieur aux deux corrections inter-site : `node --test tests/api.test.js tests/sprint5-realtime.test.js tests/sprint5-migration.test.js` — Node.js `v26.6.0` — **41/41 réussis**, 0 échec.
- Preuve finale communiquée par l’intégrateur sur les hashes ci-dessus : API **40/40**, suite complète **260/260**, lint/build/diff PASS. Le test HTTP final crée un planificateur limité à Paris avec `planning.write`, puis vérifie qu’une indisponibilité Boulogne est absente de la liste, que sa suppression répond `404` et que son état reste `confirmed`.

## Revalidation des trois P1 antérieurs

1. **Personnel inter-site — fermé.** `personnelSnapshotAllowed` impose le site de l’instantané. La liste des indisponibilités et la suppression non rejouée utilisent ce même contrôle ; le rejeu idempotent et le SSE le réutilisent également.
2. **RBAC SSE / fail-closed — fermé.** La route exige une permission de lecture reconnue. Chaque famille d’événements possède un catalogue de permissions et de scopes ; une famille inconnue retourne une liste vide et n’est pas diffusée. Session, société, site et scopes sont revalidés avant chaque émission.
3. **Abus SSE — fermé.** Une seule connexion est admise par session (`429 SSE_SESSION_LIMIT`) et un plafond global de 256 flux renvoie `503 SSE_CAPACITY_REACHED`. Les flux sont fermés à la déconnexion, au logout, au changement de société et à l’expiration/révocation de session.

## Autres contrôles conformes

- Session opaque, cookie défensif, CSRF et origine stricte sur les mutations.
- Présence consultative avec version, TTL 20 s, timer d’expiration et événement de libération ; le logout libère immédiatement la présence avant de fermer le SSE.
- Idempotence : rejeu exact sans double effet, contenu divergent refusé, historique revalidé avec les scopes actuels.
- Données Personnel bornées ; aucune raison libre n’est placée dans l’enveloppe SSE.
- Migrations ordonnées, sauvegarde locale privée obligatoire et rollback Personnel byte-exact vérifié.

## P2 non bloquant

**SEC-G5-04 — quota de présences par session.** Les présences sont bornées par réservation et expirent après 20 secondes, mais un acteur peut en acquérir plusieurs simultanément. Elles restent consultatives et ne contournent pas le contrôle optimiste. Un plafond par session renforcerait la défense en profondeur.

## Limites

- Pas de fuzzing ni de pentest externe.
- Le plafond global de 256 SSE est vérifié par lecture et le doublon par test ; aucune campagne d’épuisement à 257 connexions n’a été exécutée.
- Le résultat final API/suite complète est une preuve transmise par l’intégrateur ; la campagne indépendante fraîche couvre 41 tests sur l’état juste antérieur, dont les correctifs SSE et présence.

## Verdict

Aucun P0/P1 n’est ouvert sur le candidat identifié : **SECURITY G5 est APPROVED**. Toute modification ultérieure des chemins Personnel, auth, scopes ou SSE invalide ce verdict.
