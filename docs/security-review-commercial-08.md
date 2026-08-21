# Security review indépendante — Commercial 08

Date : 2026-08-17  
Candidat : `server.js` `d2b8860e00fbb62759cba7398c2a785c618b7bbcb478f1368a8d58162a2c7753`, `app.js` `77696c3bdc2e4e9fc40d71152b6685d7c96bda77f86cd08efb536385e5d07ce2`, `tests/quotes.test.js` `5ca7f1327216945c0db4ac66de928fedf9a83c4842b9b1c77da7b1eae9c177f6`  
Périmètre de revalidation : autorisation SSE Commercial, maintien des fermetures HTTP, migration `commercial-08-review-p1-v3`, rollback et validation des tableaux JSON  
Indépendance : aucun code, test ou actif applicatif modifié

## Verdict

**APPROVED — 0 P0, 0 P1.**

Les deux P1 de la revue précédente sont fermés sur les empreintes ci-dessus. Aucun nouveau P0/P1 n'a été trouvé. Le candidat satisfait le gate Security Commercial 08 dans le périmètre revalidé.

## Fermeture des constats

### P1-01 — Autorisation SSE Commercial : FERMÉ

- `ssePermissionForEvent()` associe les familles `quote.*`, `budget.*`, `quoteVersion.*`, `budgetVersion.*`, `rate.*`, `rateCard.*` et `commercialLink.*` à `quote.read`.
- Avant chaque écriture, `emit()` appelle `revalidateSseClient()`. Cette revalidation relit la session, l'utilisateur actif, la membership active, ses rôles actifs, ses permissions effectives et ses scopes société/site depuis la base courante.
- L'émission exige ensuite simultanément la permission live, le même `companyId` et `siteAllowed()` pour le `siteId` de l'entité. Une session/membership invalide est fermée ; une révocation de `quote.read` cesse immédiatement les invalidations commerciales sans reconnexion.
- Preuve dynamique : un lecteur Commercial reçoit `quote.created.v1` à Paris avant révocation, ne reçoit rien pour Boulogne hors scope, reçoit l'invalidation non commerciale de changement de membership, puis ne reçoit plus `quote.created.v1` à Paris après révocation. L'administrateur témoin reçoit bien les événements correspondants, ce qui exclut un faux négatif dû à l'absence d'émission.
- Après révocation, les lectures HTTP `/api/v1/rate-cards`, `/api/v1/projects/project_1/dashboard` et `/api/v1/reservations/reservation_1/commercial-links` restent fermées en `403 FORBIDDEN`.

### P1-02 — Migration Commercial Review : FERMÉ

- Avant mutation, la migration calcule le SHA-256 des octets source et crée une sauvegarde déterministe dédiée avec `mode 0600`, écriture exclusive dans un temporaire puis renommage. Une sauvegarde préexistante n'est acceptée que si elle est identique octet pour octet à la source ; sinon la migration échoue en `MIGRATION_BACKUP_CONFLICT`.
- Le marqueur `commercial-08-review-p1-v3` enregistre les digests source/sortie/intégrité, les comptages d'entrée/sortie, les références de preuve et la version de politique. Au replay, `validateCommercialReviewMarker()` vérifie le nom de sauvegarde local, son existence et son digest, l'intégrité canonique du marqueur et le digest de la projection de sortie ; une altération est refusée en `MIGRATION_MARKER_CONFLICT`.
- La reprise après interruption est couverte par une base source accompagnée de sa sauvegarde exacte mais sans marqueur : la migration reprend, conserve la sauvegarde et aboutit. Le rejeu de l'état migré reste byte-stable.
- `rollbackCommercialReviewMigration()` revalide marqueur, projection et sauvegarde, puis restaure exactement les octets source par écriture temporaire `0600` et renommage. Le test compare l'intégralité du fichier restauré à la source, espaces et fin de ligne inclus.
- Aucun faux historique n'est fabriqué : l'état courant enrichi porte `historicalAccuracy: unknown-current-state-backfill`; une ancienne version sans snapshot reçoit seulement `commercialSnapshotBackfill.status: unavailable` et ne reçoit pas de `commercialSnapshot` courant.

### P2 précédent — Tableaux JSON mal typés : FERMÉ

- `reservationIds` est vérifié avec `Array.isArray()` avant toute itération dans preview/import et liaison directe ; les tableaux optionnels `confirmBookingIds`, `confirmDuplicateBookingIds` et `lineAdjustments` sont validés et bornés avant usage.
- Cinq cas dynamiques mal typés couvrent preview, import, liaison directe et transition de statut. Ils répondent tous `422 VALIDATION_ERROR` et la version du devis reste inchangée.

## Contrôles conservés

- Auth/session, Origin/CSRF, RBAC HTTP, isolation société/site et IDOR restent couverts par la suite complète.
- Les confirmations de double rattachement et d'acceptation, l'idempotence, les audits et les émissions post-commit restent exercés.
- Les snapshots/PDF restent protégés par `quote.read`, le tenant et le site ; le PDF n'expose ni coûts ni marges.
- Les calculs monétaires restent en `BigInt`, bornés à int64 et testés sur les dépassements.

## Preuves fraîches

- `node --check server.js` : succès.
- `node --check app.js` : succès.
- `node --test tests/quotes.test.js` : **34 réussis, 0 échec, 0 ignoré**, durée 2 394,90 ms.
- `npm test` : **131 réussis, 0 échec, 0 ignoré**, durée 6 495,59 ms.
- `git diff --check` : succès.
- Inspection statique indépendante des chemins SSE, migration, rollback, validations structurées et routes HTTP sur les empreintes consignées.

## Limites et défense en profondeur

- Les digests du marqueur détectent les divergences entre source, sauvegarde, métadonnées et projection ; ils ne constituent pas une signature contre un attaquant disposant déjà d'un accès en écriture complet au fichier de données et à sa sauvegarde.
- Aucun fuzzing exhaustif, proxy/TLS distant ni audit des permissions système au-delà du mode de fichier testé n'a été réalisé.
- La limitation de débit et la rétention des PDF, imports, versions, idempotences et audits restent une amélioration P2 pour un déploiement exposé ; le runtime local et les bornes de corps/listes réduisent le risque MVP.
