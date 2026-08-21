# Spécification — Commercial 08 · Budgets et devis Post-production

Statut : `SPEC canon §1–58 incorporée — opérations Planning et devis complémentaire implémentés, relecture indépendante requise`  
Date : 2026-08-18  
Owner : Commercial 08

## 1. Décision produit

Le Projet / Émission est le point central. Le Devis/Budget et le Planning sont deux agrégats indépendants qui peuvent être reliés sans être confondus.

- créer un budget ou un devis depuis un projet ne crée, ne prévisualise et ne réserve aucune ressource ;
- une ligne commerciale référence `0..n` réservations ; ce lien reste facultatif ;
- une réservation ne devient jamais implicitement une ligne commerciale ;
- une ligne sans réservation affiche `Non planifiée`, une ligne avec au moins une réservation active affiche `Liée au planning` ;
- les frais, stockage, livraison, transcodage, archivage, assurance, transport, remises et forfaits peuvent ne jamais être planifiés.

Les trois workflows sont normatifs :

1. Commercial : `Projet → Budget/Devis → Planning` ;
2. Planning : `Projet → Réservations sélectionnées → Devis` ;
3. Mixte : `Projet → Devis partiel → Planning → Complément du devis`.

## 2. Compatibilité RC1 et périmètre

L'incrément conserve Node.js/CommonJS, l'API `/api/v1`, la persistance atomique JSON et le SSE d'invalidation. Il n'active pas la cible TypeScript/React/SQLite et n'ajoute aucune dépendance ou ressource réseau à l'exécution.

Inclus :

- budgets et devis rattachés obligatoirement à un projet du tenant ;
- catalogue de salles, ressources humaines, matériel, prestations techniques/forfaitaires et lignes libres ;
- création directe, import de réservations sélectionnées et complément ultérieur ;
- lien optionnel ligne → réservations, sans double import d'une même réservation dans un même document ;
- snapshot fiscal immuable, totaux HT/TVA/TTC exacts ;
- RBAC, isolation société/site, version optimiste, idempotence des créations, audit et SSE ;
- préparation du Planning depuis une ligne via un DTO sans effet de bord.

Exclus du MVP : expédition électronique et signature, facturation, paiement, avoir, conversion de change, taux mixtes par ligne, suppression physique et création silencieuse de réservations depuis un document non accepté. Le PDF client local et les statuts métier sont inclus ; modifier le profil Organisation ne modifie jamais un snapshot existant.

La conversion contrôlée d'un devis accepté vers le Planning est activée dans le présent incrément. Elle respecte obligatoirement la chaîne `Organisation active → Ressources actives → Client actif → Projet actif → Devis accepté et versionné → prévisualisation Planning → réservation`. Elle n'altère aucun montant, taux, snapshot fiscal ou version commerciale historique.

## 3. Modèle persistant additif

Collection `quotes` :

```text
Quote = {
  id, companyId, projectId, siteId?,
  kind: "budget" | "quote",
  number, title,
  status: "draft" | "inReview" | "validated" | "sent" | "accepted" |
          "refused" | "expired" | "replaced" | "cancelled" | "archived",
  taxDate: YYYY-MM-DD,
  fiscalSnapshot: CompanyFiscalSnapshot,
  currency, currencyExponent,
  lines: QuoteLine[],
  netHt, vatAmount, grossTtc,
  version, createdBy, createdAt, updatedAt, archivedAt?
}

QuoteLine = {
  id,
  category: "room" | "human" | "equipment" | "technical" |
            "flatFee" | "free",
  sourceType: "resource" | "stockItem" | "serviceOffering" | "manual",
  sourceId?, label, description?, unit,
  quantityMilli, unitPriceMinor,
  netHt, vatAmount, grossTtc,
  planning: {
    bookingIds: [],
    status: "unplanned" | "partiallyPlanned" | "fullyPlanned",
    requestedDurationDays?, requestedResourceType?
  }
}
```

`budgets` et `quotes` sont deux collections persistantes distinctes. `budgetVersions` et `quoteVersions` contiennent des snapshots immuables. Une nouvelle version ou un avenant possède un nouvel identifiant, un `parentDocumentId`, un `lineageRootId` et une séquence ; la source envoyée/acceptée devient `replaced` sans réécriture de ses lignes.

`quantityMilli` est un entier décimal sous forme de chaîne, avec `1000 = 1 unité`; `unitPriceMinor` et tous les montants sont des chaînes décimales `0|[1-9][0-9]{0,18}`. Aucune valeur monétaire persistée n'est un `Number` JavaScript.

Migration/rollback : les collections initiales restent additives. La migration `commercial-08-review-p1-v3` crée en plus, avant toute mutation, une sauvegarde `0600` byte-for-byte nommée avec le digest SHA-256 de la source. Son marqueur conserve digests d'entrée/sortie/intégrité, compteurs, version de politique et références précises des valeurs backfillées. Chaque replay revalide marqueur, sauvegarde et projection de sortie ; toute falsification bloque avec `MIGRATION_MARKER_CONFLICT`. Un snapshot commercial courant ajouté à un document legacy porte `historicalAccuracy="unknown-current-state-backfill"`; aucune identité courante n'est injectée dans une version historique, qui porte seulement l'état explicite `historical-state-not-captured`.

Le rollback dédié `rollbackCommercialReviewMigration()` restaure exactement les octets pré-migration après contrôle de tous les digests. Il doit être exécuté serveur arrêté et conjointement au retour au code antérieur : il abandonne nécessairement les écritures postérieures à cette sauvegarde. La sauvegarde elle-même n'est jamais modifiée ni supprimée.

## 4. Fiscalité et calcul

À la création, Commercial 08 appelle logiquement `CompanyFiscalProfilePort.v1.snapshotForQuote({ companyId, siteId?, taxDate, requestedVatRateId? }, authContext)` et persiste exactement le `CompanyFiscalSnapshot` canonique. `requestedVatRateId` exige `quote.overrideVatRate`; un taux libre est interdit.

Le taux est unique au niveau du document. Pour chaque ligne :

```text
lineNetHt = floor((quantityMilli × unitPriceMinor + 500) / 1000)
lineVatAmount = floor((lineNetHt × rateBps + 5000) / 10000)
lineGrossTtc = lineNetHt + lineVatAmount
```

Puis `netHt = Σ lineNetHt`, `vatAmount = Σ lineVatAmount`, `grossTtc = Σ lineGrossTtc`, avec contrôle `grossTtc = netHt + vatAmount`. Chaque entrée, produit intermédiaire et résultat doit rester dans `0..9223372036854775807`; sinon la mutation entière échoue `AMOUNT_OVERFLOW`.

## 5. API `/api/v1`

```text
GET    /quotes?projectId=&kind=&status=&siteId=
POST   /quotes
GET    /quotes/:id
PATCH  /quotes/:id
POST   /quotes/:id/lines
PATCH  /quotes/:id/lines/:lineId
DELETE /quotes/:id/lines/:lineId
POST   /quotes/:id/import-reservations
POST   /quotes/preview-reservations
POST   /quotes/:id/lines/:lineId/bookings
GET    /quotes/:id/lines/:lineId/planning-intent
POST   /quotes/:id/client-planning/analyze
POST   /quotes/:id/planning-conversion/preview
POST   /quotes/:id/planning-conversion
POST   /quotes/:id/status
POST   /quotes/:id/new-version
POST   /quotes/:id/amendments
GET    /quotes/:id/deviations
POST   /quotes/:id/archive
GET    /reservations/:id/commercial-links
GET    /quote-catalog?siteId=&q=
```

`POST /quotes` exige `Idempotency-Key`, `projectId`, `kind`, `title`, `taxDate`; `siteId` et `requestedVatRateId` sont facultatifs. Il retourne `201`, ou `200` lors d'un replay identique. Il ne crée aucune réservation.

Une ligne accepte une source de catalogue autorisée ou `sourceType="manual"`. Le serveur recopie le libellé de catalogue au moment de l'ajout. `bookingIds` ne sont jamais acceptés sur cette route : le lien passe exclusivement par l'import de réservations existantes.

`POST /quotes/:id/import-reservations` exige `version` et `reservationIds`. Chaque réservation doit appartenir au même projet, tenant et site autorisé. Une réservation déjà liée au même document est refusée `QUOTE_RESERVATION_ALREADY_IMPORTED`. Une réservation liée à un autre document déclenche `COMMERCIAL_DOUBLE_BILLING_CONFIRMATION_REQUIRED` tant que son identifiant n'est pas confirmé explicitement. L'import accepte les modes `detailed`, `grouped` et `commercial`, ainsi que des corrections contrôlées de la prévisualisation ; il n'altère pas le Planning.

`GET .../planning-intent` est sans effet de bord et retourne le projet, le site éventuel, le type de ressource, la quantité et la durée demandée. La création effective de la réservation reste une commande Planning distincte ; le lien est ensuite établi par l'import.

### 5.1 Conversion Devis → Projet → Planning

Ces routes sont publiées dans le présent incrément et consomment le planning cible série/cellule sans créer de raccourci autour du Projet.

Le parcours utilisateur canonique est : **Importer le planning client → Analyser → Comparer et corriger → Vérifier les disponibilités → Confirmer**. Le dépôt et l'analyse préparatoire sont accessibles depuis un Budget brouillon afin de confronter tôt le besoin client au chiffrage, sans réserver aucune ressource. Sur un Budget, les étapes Disponibilités et Confirmation restent verrouillées. `POST /quotes/:id/client-planning/analyze` accepte, pour un Budget brouillon ou un Devis accepté, un fichier Excel `.xlsx`, CSV ou PDF texte de 5 Mo maximum. Le contenu est stocké hors racine statique, sous nom SHA-256 et droits `0600`; l'API ne retourne jamais son chemin serveur. Un PDF scanné sans texte exploitable est refusé avec une indication de saisie manuelle, sans écriture Planning.

PlanyBot accompagne ce parcours dans une fenêtre flottante distincte, ouverte en bas de l’écran uniquement après la sélection du fichier client. La fenêtre de dépôt reste donc seule et lisible avant l’import. PlanyBot annonce ensuite la réception du fichier, explique l’analyse en cours, résume les correspondances `matched|ambiguous|unmatched`, répond aux questions de l’utilisateur, explique les conflits de disponibilité et rappelle la confirmation finale. La fenêtre peut être réduite en un bouton compact puis rouverte sans perdre la conversation. Les réponses sont calculées avec le devis et l’analyse relus côté serveur sous `quote.read` et `planning.read`. Le dialogue est strictement informatif : aucune réservation, correction, sélection ou confirmation n’est exécutée par PlanyBot.

L'analyse est sans effet de bord sur le devis et les réservations. Elle normalise les dates, horaires, postes et salles, rapproche chaque ligne des prestations planifiables du devis et des ressources du site, puis classe les résultats `matched|ambiguous|unmatched`. Les correspondances ambiguës ou inconnues ne sont jamais sélectionnées automatiquement. L'utilisateur peut corriger la ligne du devis, la salle, la date, la durée, les horaires et le statut initial avant la prévisualisation. Le fichier source et son résultat portent un `clientPlanningImportId` lié à la société, au devis, à sa version acceptée, au projet et au site.

La prévisualisation et la conversion exigent un document `kind="quote"`, `status="accepted"`, son `version` courant et son `currentVersionId`. Le devis doit référencer un Client actif et un Projet actif de la même société ; le site de planification appartient aux sites du Projet et au scope de l'acteur. Les Budgets, devis brouillons/envoyés/remplacés et snapshots historiques ne sont jamais convertibles.

La commande porte une liste bornée à 100 besoins :

```text
PlanningConversionItem = {
  quoteLineId,
  startDate,                 // YYYY-MM-DD dans le fuseau du site
  durationDays?,             // période détectée/corrigée, 1..366
  resourceIds[],             // salles choisies, uniques, même société/site
  status: "option" | "confirmed",
  startTime?, endTime?,      // défaut 09:00–18:00
  clientPlanningRowId?       // ligne traçable du fichier analysé
}
```

La durée est dérivée de `planning.requestedDurationDays`, sinon de la quantité pour les unités `jour`, `semaine` et `mois`. Une ligne forfaitaire, libre, PAD, licence ou stockage sans ressource planifiable peut rester non planifiée ; elle n'est jamais transformée artificiellement en réservation. La prévisualisation retourne pour chaque ligne la période inclusive, les salles candidates par métier (montage, étalonnage et mixage), les choix effectués et les conflits de capacité, sans écriture.

`POST /quotes/:id/planning-conversion` exige `Idempotency-Key`, `version`, `quoteVersionId`, le `clientPlanningImportId` lorsqu'un fichier a été analysé, et les mêmes items prévisualisés. Toute indisponibilité répond `409 PLANNING_CONFLICT`; aucun override implicite n'est permis. La mutation est atomique : soit toutes les réservations et tous les liens commerciaux sont créés, soit aucune écriture n'est conservée. Un replay identique retourne le même résultat sans nouvelle réservation ; un payload différent avec la même clé répond `409 IDEMPOTENCY_CONFLICT`.

Chaque réservation créée conserve `projectId`, `sourceQuoteId`, `sourceQuoteVersionId`, `sourceQuoteLineId` et, le cas échéant, `sourceClientPlanningImportId`/`sourceClientPlanningRowId`. La ligne de devis reçoit les `bookingIds` et son état `partiallyPlanned|fullyPlanned`, sans recalcul de HT/TVA/TTC. Les audits `quote.clientPlanningAnalyzed`, `reservation.createdFromQuote` et `quote.convertedToPlanning` ne contiennent ni fichier ni montant fiscal ; les invalidations SSE sont émises après commit.

## 6. Autorisations, concurrence et événements

- `quote.read` : lire catalogue et documents autorisés ;
- `quote.manage` : créer/modifier/archiver et importer des réservations ;
- `quote.overrideVatRate` : choisir un taux configuré/applicable différent du défaut.
- `planning.read` : prévisualiser les salles et conflits ;
- `planning.write` : convertir un devis accepté et créer les réservations.

Le serveur injecte `companyId` depuis la session et refuse `companyId`/`organizationId` dans les commandes. Un `siteId` doit appartenir au périmètre effectif. Toute mutation d'un document existant exige sa `version`, écrit un audit avant commit et émet après succès `quote.created.v1`, `quote.updated.v1` ou `quote.archived.v1`. Les événements ne contiennent aucun montant ni texte libre.

Les invalidations SSE des familles `quote`, `budget`, `quoteVersion`, `budgetVersion`, `rate`, `rateCard` et `commercialLink` exigent `quote.read`. La membership, les rôles et les sites sont recalculés depuis la persistance avant chaque émission : une révocation prend effet sur le flux déjà ouvert, sans reconnexion, et un événement lié à un site hors périmètre n'est pas transmis.

## 7. Critères d'acceptation

- [x] Un devis direct avec lignes libres et catalogue est créé sans nouvelle réservation.
- [x] Une ligne seule a `bookingIds=[]` et le statut `unplanned`.
- [ ] Un devis accepté et versionné, rattaché à un Client/Projet actifs, prévisualise puis crée atomiquement des réservations traçables sans modifier son snapshot fiscal ni ses totaux.
- [ ] Un conflit, un site hors scope, une ligne non planifiable, un devis non accepté ou une clé idempotente divergente ne produit aucune réservation.
- [x] Une ligne peut rester définitivement non planifiée.
- [x] L'intention Planning est préremplie et ne produit aucune écriture.
- [x] Des réservations sélectionnées du même projet créent/complètent un devis sans double comptage.
- [x] Une réservation étrangère au tenant, au site ou au projet est inaccessible/refusée sans fuite.
- [x] Le snapshot fiscal reste identique après modification du profil Organisation.
- [x] Les totaux utilisent chaînes + `BigInt`, arrondi half-up par ligne et refusent tout overflow.
- [x] Un viewer sans `quote.manage` ne peut muter aucun devis.
- [x] Une version obsolète est refusée sans écriture ; un replay idempotent ne crée aucun doublon.
- [x] Les actions Projet sont distinctes : Nouveau budget, Nouveau devis, Ouvrir le planning, Créer un devis depuis le planning.
- [x] Les huit onglets Projet sont interactifs et exposent Planning, documents, ressources, équipe et rentabilité.
- [x] La sélection Planning fonctionne par booking, ressource ou jour, avec clic droit et alternative clavier `Maj+F10`.
- [x] Une sélection homogène crée un nouveau devis ou complète un brouillon après prévisualisation détaillée/regroupée/commerciale corrigible.
- [x] Le double rattachement commercial exige une confirmation explicite, conservée dans la trace d'import.
- [x] Un devis envoyé/accepté est figé ; Nouvelle version et Avenant créent des brouillons distincts avec filiation.
- [x] La navigation est bidirectionnelle et les écarts proposent uniquement les actions compatibles avec le statut.

La protection contre le double rattachement s'applique aussi à la liaison directe `POST /quotes/:id/lines/:lineId/bookings`; le serveur exige les mêmes identifiants confirmés et journalise la décision. Une déliaison commerciale ne supprime ni ne modifie la réservation Planning. L'acceptation d'un devis lié exige une confirmation explicite de la liste des bookings concernés.

Les remises sont exprimées en points de base, au niveau ligne et document. Les montants de ligne sont arrondis half-up avant totalisation ; la remise document et sa TVA sont mémorisées séparément. Les versions ont un `versionNumber` strictement croissant et restent consultables par leur route de détail. Le PDF paginé ne consulte que les snapshots fiscal et commercial du document et ne tronque aucune ligne.

Preuves DEV fraîches du 2026-08-17 : `node --test tests/quotes.test.js` (34/34), `npm test` (131/131), `node --check server.js` et `node --check app.js` verts. Les tests dédiés couvrent la révocation SSE sans reconnexion, l'isolation site, la sauvegarde byte-for-byte, le replay falsifié, la reprise sur sauvegarde existante, le rollback et les tableaux mal typés. Le smoke navigateur de cette tranche reste à rejouer faute de navigateur connecté ; aucun verdict UI automatisé n'est revendiqué.

Le lot reste `DEV` tant qu'une REVIEW et une QA indépendantes n'ont pas porté sur le même état candidat.

## 8. Canon Projet / Budget / Devis / Planning du 2026-08-16

Le prompt maître §1–58 fourni par le PO remplace toute règle antérieure contradictoire. Les invariants suivants sont désormais normatifs :

- `Project` est l'agrégat central et porte identité métier enrichie, période, client/production, responsables, centre de coût, notes, couleur et l'un des onze statuts métier ; sa fiche comporte Vue générale, Planning, Budgets, Devis, Ressources, Équipe, Documents et Rentabilité ;
- `Budget` est un document interne de simulation et `Quote` une proposition client : ils ont des identités, collections, cycles et versions distincts ; une conversion crée un nouveau `Quote` sans détruire le `Budget` ;
- `BudgetVersion` et `QuoteVersion` sont immuables. Une version envoyée ou acceptée n'est jamais modifiée en place ; tout changement produit une nouvelle version ou un avenant ;
- les lignes référencent les ressources existantes et conservent un snapshot commercial dans leur version, sans dupliquer l'objet métier ;
- `RateCard`/`Rate` appliquent la priorité projet, puis client, puis catalogue. Un prix saisi explicitement reste manuel et n'est jamais resynchronisé silencieusement ;
- chaque ligne stocke quantité/durée/unité, coût, vente, remise, marge et section. L'objectif de marge produit une alerte informative, jamais un blocage ; coûts et marges sont strictement exclus du PDF client ;
- l'état Planning est `unplanned`, `partiallyPlanned` ou `fullyPlanned`, calculé à partir de la quantité commerciale et des bookings liés ; `QuoteLine` et `BudgetLine` conservent toujours la cardinalité `0..n Booking` ;
- le Planning expose un projet actif facultatif, une sélection multiple et un menu contextuel. Une sélection homogène peut créer un nouveau document ou compléter un document brouillon selon les modes détaillé, regroupé ou commercial ;
- un Booking déjà lié déclenche une alerte nommant le document. Un nouvel import exige une confirmation explicite et tracée ; aucun double comptage silencieux n'est permis ;
- le lien est navigable dans les deux sens et les écarts quantité/durée sont calculés sans modifier automatiquement le commercial ni le planning ;
- le PDF est produit localement à partir du snapshot immuable, avec identité légale, client, projet, sections, quantités, prix, sous-totaux, HT/TVA/TTC, conditions et signature ; aucun SaaS/CDN n'est requis ;
- Order, Invoice, CreditNote, comptabilité, paie et fonctions ERP du §56 restent hors MVP.

### Matrice de départ des 21 priorités §55

| # | Priorité | État avant cette tranche |
|---:|---|---|
| 1 | Création Projet | Partiel : nom, code, client, couleur uniquement |
| 2 | Page Projet | Partiel : cartes sans fiche à onglets/dashboard complet |
| 3 | Budget sans planning | Partiel : possible mais agrégat partagé avec Quote |
| 4 | Devis sans planning | Conforme |
| 5 | Catalogue prestations | Partiel : catalogue local sans recherche/favoris/récents dans l'éditeur |
| 6 | Lignes manuelles | Conforme |
| 7 | Coût / vente / marge | Absent |
| 8 | Rate cards simples | Absent |
| 9 | Booking → Project | Conforme |
| 10 | Projet actif Planning | Partiel : filtre projet sans barre explicite |
| 11 | Sélection multiple Planning | Absent |
| 12 | Clic droit | Absent |
| 13 | Planning → nouveau devis | Partiel : import formulaire, pas depuis la sélection de grille |
| 14 | Planning → devis existant | Partiel |
| 15 | Regroupement Bookings | Absent |
| 16 | QuoteLine → 0..n Booking | Conforme |
| 17 | États non/partiel/total | Partiel : non/lié seulement |
| 18 | HT / TVA / TTC | Conforme, calcul entier exact |
| 19 | PDF | Absent |
| 20 | Versions | Absent |
| 21 | Écarts Planning / devis | Absent |

Ordre DEV : fondations Project enrichi et documents/versions/tarifs/marges ; éditeur commercial ; intégration Planning ; PDF local ; écarts. Chaque tranche conserve les comportements déjà conformes et repasse les gates impactés.

### État vérifié après la tranche MVP suivante

Implémentés : Projet enrichi, fiche Projet et huit onglets interactifs ; Budget/Quote séparés ; snapshots immuables ; RateCard/Rate locales ; coût/vente/marge ; éditeur trois zones ; états non/partiel/total ; projet actif Planning ; sélection multiple booking/ressource/jour et menu contextuel accessible ; Planning vers nouveau/existant avec trois regroupements et prévisualisation corrigible ; confirmation du double rattachement ; statuts envoyé/accepté figés ; Nouvelle version/Avenant ; navigation bidirectionnelle ; écarts simples et PDF local sans coûts/marges.

Reliquats de finition hors critères demandés de cette tranche : favoris/récents catalogue et mémorisation persistante d'une décision « ignorer l'écart ». L'action Ignorer actuelle ne vaut que pour la revue affichée et ne modifie aucune donnée.

Preuves DEV fraîches du 2026-08-17 : contrôles syntaxiques backend/frontend verts ; `node --test tests/quotes.test.js` 34/34 ; `npm test` 131/131. Le smoke navigateur a été préparé mais aucun navigateur n'est connecté ; les étapes reproductibles sont transmises à l'intégrateur. Une nouvelle REVIEW et une revalidation SECURITY indépendantes sont requises après les corrections P1.

## 9. Synoptique normatif « du projet au devis validé » — 2026-08-18

Le parcours commercial commence exclusivement avec un `Client` actif puis un `Project` actif rattaché à ce client. Le Projet est le point de bifurcation entre deux chemins explicites ; aucune réservation Planning n'est une précondition.

### 9.1 Chemin Budget

1. Un Budget est créé avec l'éditeur commercial, sans réservation automatique.
2. Chaque ligne applique la résolution `tarif projet > tarif client importé > tarif générique`; l'origine et le tarif appliqués sont figés dans la version.
3. Le Budget reste modifiable tant qu'il est `draft`. La confirmation client produit l'état fermé `clientConfirmed`, un horodatage, l'acteur et une version immuable.
4. Seul un Budget `clientConfirmed` peut être converti manuellement en Devis. La conversion est idempotente, crée un nouvel agrégat `Quote`, conserve le Budget source et le marque `converted` avec `convertedQuoteId`.
5. Le Devis issu du Budget reprend les lignes, remises, snapshots fiscal/commercial, origine des tarifs et analyses PlanyBot sans créer de réservation.

La confirmation du Budget ne contribue jamais au chiffre d'affaires. Seule l'acceptation finale du Devis produit une reconnaissance de CA.

### 9.2 Chemin Devis direct

Un Devis direct porte une origine obligatoire et auditée :

- `manual` : éditeur de devis sans Planning ;
- `planning` : réservations Planify sélectionnées puis prévisualisées avant import commercial ;
- `clientPlanningImport` : fichier client Excel/CSV/PDF analysé par PlanyBot, corrigé et confirmé par un humain avant création des lignes ;
- `budgetConversion` : origine réservée à la conversion du chemin Budget.

PlanyBot explique l'analyse et conserve la trace des échanges, mais ne valide aucun tarif, aucune prestation et ne crée aucune réservation. La création commerciale et la conversion en Planning sont deux commandes distinctes.

### 9.3 Validation finale et chiffre d'affaires

Le cycle du Devis reste `draft → validated → sent → accepted`. `accepted` signifie validation finale par le client. À cette transition, le serveur fige une reconnaissance de chiffre d'affaires contenant `quoteId`, `quoteVersionId`, `projectId`, `clientId`, devise, HT, TVA, TTC, date et acteur. Les montants proviennent du snapshot accepté et ne sont jamais recalculés depuis le profil fiscal courant.

Une nouvelle version remplaçant un devis accepté rend l'ancienne reconnaissance `superseded`; la nouvelle version ne contribue au CA qu'après sa propre acceptation. Les Budgets, devis brouillons, validés en interne, envoyés, refusés, expirés ou annulés sont exclus du CA.

### 9.4 Droits, audit et API

- `quote.manage` : créer/modifier les Budgets et Devis, confirmer un Budget et lancer sa conversion ;
- `quote.accept` : enregistrer l'acceptation finale d'un Devis ;
- `planning.read` : sélectionner/importer un Planning existant ou analyser un planning client ;
- `dashboard.read` : consulter les agrégats de CA du périmètre société/site autorisé.

Dans la RC locale, `quote.accept` est exercé par l'Administrateur ou l'Assistante planning/commerciale qui enregistre la décision du client et sa preuve hors ligne. Un futur accès Client ne pourra confirmer que ses propres documents et ne recevra jamais les droits d'édition, de tarification, de Planning ou de CA. Cette extension de portail est hors du présent incrément et ne doit pas être simulée par un rôle interne trop permissif.

Routes normatives :

```text
POST /api/v1/quotes/:budgetId/status              # clientConfirmed
POST /api/v1/quotes/:budgetId/convert-to-quote    # budgetConversion
POST /api/v1/quotes                               # manual | planning | clientPlanningImport
POST /api/v1/quotes/:quoteId/client-planning/analyze
POST /api/v1/quotes/:quoteId/client-planning/apply-lines
POST /api/v1/quotes/:quoteId/status               # accepted + reconnaissance CA
GET  /api/v1/dashboard/revenue                    # CA accepté uniquement
```

Audits minimaux : `budget.clientConfirmed`, `budget.convertedToQuote`, `quote.created`, `quote.clientPlanningAnalyzed`, `quote.statusChanged`, `quote.revenueRecognized`, `quote.revenueSuperseded`. Toute commande sensible conserve société, projet, document/version, acteur, date, requestId et clé idempotente lorsque requise, sans contenu du fichier client ni données fiscales sensibles.

## 10. Devis accepté vers planning opérationnel — 2026-08-18

Le bouton `Planifier le devis` est visible uniquement sur un Devis `accepted`. Il ouvre le Planning du Projet et le panneau de contrôle PlanyBot ; il ne crée aucune réservation. L'opérateur choisit chaque date, salle ou ressource et rattache la cellule créée à une ligne planifiable du Devis. Le nombre de jours vendu ne détermine jamais automatiquement le nombre de salles.

Chaque réservation issue de ce parcours conserve `projectId`, `sourceQuoteId`, `sourceQuoteVersionId`, `sourceQuoteLineId`, `planningUnit` et la quantité calculée depuis ses cellules. Une modification ou annulation recalcule le contrôle sans modifier les lignes, remises, montants HT/TVA/TTC ni snapshots fiscal et commercial du Devis accepté.

PlanyBot expose par ligne les états `unplanned`, `partiallyPlanned`, `compliant`, `overPlanned` et `nonApplicable`, les quantités vendues, planifiées, restantes ou excédentaires, ainsi qu'une estimation d'excédent. Les prestations non planifiables restent visibles mais ne bloquent pas la validation. Tout dépassement alimente automatiquement un unique Devis complémentaire `draft` relié au Devis accepté. Ce brouillon est resynchronisé à la hausse comme à la baisse après chaque mutation Planning. Son tarif est résolu selon l'ordre `projet > client > catalogue`; à défaut de tarif courant, le prix appliqué au document accepté reste la référence. Lorsque le dépassement disparaît, le brouillon vide est annulé. Un complément déjà envoyé ou accepté reste figé et un dépassement ultérieur crée le complément numéroté suivant. Le Devis accepté et son snapshot fiscal ne sont jamais réécrits.

Les opérations Planning suivantes sont contractuelles et soumises à `planning.write`, au contrôle de version, à l'isolation société/site, aux conflits et à l'audit avant/après :

- sélection visuelle strictement limitée aux cellules choisies : sélectionner une journée d'une réservation multi-jours ne surligne jamais les autres journées de la série ;
- copie et collage d'une ou plusieurs cellules avec conservation de `projectId`, `sourceQuoteId`, `sourceQuoteVersionId` et `sourceQuoteLineId` ; chaque copie devient une journée indépendante sur la date et la salle cibles, sans modifier la source ni les autres cellules de sa série ;
- duplication idempotente vers une cellule cible ;
- déplacement normal d'une seule cellule entre salles, sans déplacer la série ;
- déplacement de la réservation entière avec conservation de sa durée par `Maj + glisser` ;
- redimensionnement depuis les bords gauche et droit de la cellule : les zones de prise sont invisibles au repos, affichent le curseur horizontal et un repère fin au survol/focus, sans bouton ni flèche persistante ;
- annulation/rétablissement des dernières duplications, redimensionnements et déplacements depuis l'interface ;
- choix explicite `includeWeekends`: si faux, samedi et dimanche ne sont ni rendus, ni comptés, ni bloquants dans la disponibilité ; si vrai, ils participent au volume et aux conflits.

La planification peut être validée lorsque toutes les lignes planifiables sont `compliant` ou `overPlanned`. La commande exige `planning.validate`, une clé idempotente et la version acceptée courante ; elle enregistre le digest exact du contrôle puis place le Projet à l'état `planned`. Toute mutation ultérieure d'une réservation liée invalide ce contrôle jusqu'à une nouvelle validation humaine.

Routes normatives :

```text
GET  /api/v1/quotes/:quoteId/planning-control
POST /api/v1/quotes/:quoteId/planning-control/validate
POST /api/v1/quotes/:quoteId/planning-control/amendment
POST /api/v1/reservations                         # lien sourceQuote* obligatoire dans ce parcours
POST /api/v1/reservations/:reservationId/duplicate
PATCH /api/v1/reservations/:reservationId         # période, ressource, includeWeekends
```

Audits minimaux : `reservation.created`, `reservation.updated`, `reservation.duplicated`, `reservation.cancelled`, `quote.planningValidated`, `quote.planningComplementCreated`, `quote.planningComplementUpdated`, `quote.planningComplementCancelled`. Les événements SSE sont émis uniquement après persistance et restent filtrés par société, site, session et permissions.
