# Sprint 8 V1 — Dashboards, exports & sécurité finale

Date de cadrage : 2026-08-24  
Statut : **SPEC de référence — DEV autorisé par incréments**  
Gate de sortie : **G8 — Pilotage complet**

## 1. Autorité et objectif

Cette spécification traduit l’Ordre de lancement V1 et les douze stories Sprint 8 du Backlog V1 : `US-094` à `US-099`, `US-101` à `US-104`, `US-107` et `US-109` (86 points).

Le Sprint 8 transforme les read-models fiables de G7 en outils de pilotage adaptés aux responsabilités :

```text
Sources Client/Projet/Devis/Planning/Réalisé/Finance
  -> filtres et scopes appliqués côté serveur
  -> KPI versionnés + fraîcheur + provenance
  -> dashboards par rôle
  -> drill-down vers les sources autorisées
  -> exports Excel/PDF et dataset BI réconciliables
```

Le Gate G8 exige que chaque nombre affiché ou exporté soit réconciliable au détail autorisé. Le serveur et les moteurs déterministes restent l’unique autorité. L’interface compose les réponses sans recalculer localement les KPI.

Le runtime reste le monolithe local CommonJS/JSON de `0.4.0-rc1`. Aucun SaaS, CDN, moteur distant, migration implicite vers React/TypeScript/SQLite ou accès réseau requis à l’exécution n’est autorisé.

## 2. Périmètre canonique

| Story | Capacité obligatoire | Critère testable |
|---|---|---|
| US-094 | Dashboard Direction | CA signé et produit, backlog, forecast, marges autorisées, occupation et alertes ; filtres période/société/site et drill-down |
| US-095 | Dashboard Finance | signé, produit, facturable, coûts, marges, écarts et compléments ; export et drill-down Projet |
| US-096 | Dashboard Planning | occupation, saturation, reste à planifier, options et conflits ; vue filtrable et liens vers le Planning |
| US-097 | Dashboard Commercial | pipeline Budget/Devis, conversion, CA signé et remises ; marge uniquement avec `finance.read` |
| US-098 | Dashboard Exploitation | charge des ressources, maintenance, indisponibilités et consommation réelle par Site/catégorie |
| US-099 | Dashboard Chef de projet | Budget/Devis, Planning, réalisé et écarts sur les seuls Projets autorisés ; marge uniquement avec `finance.read` |
| US-101 | Export Planning Excel | période, ressources, réservations, statuts et filtres actifs, sans donnée hors scope |
| US-102 | Export Planning PDF | rendu paysage A4 ou A3 déterminé par la densité, lisible et fidèle à la fenêtre filtrée |
| US-103 | Export KPI Excel | chaque dashboard exporte les KPI et les lignes détaillées réconciliées avec la même définition/fraîcheur |
| US-104 | API Analytics / BI | dataset JSON/CSV documenté, sécurisé, filtrable, paginé et borné |
| US-107 | Visibilité coûts/marges | aucune valeur interne via API, export, BI, audit, SSE ou UI sans `finance.read`; écriture de coûts sous `finance.cost.manage` |
| US-109 | Override de conflit | profils habilités seulement, motif dédié obligatoire, audit visible et aucun contournement par batch/import |

### 2.1 Explicitement exclu

- factures fiscales, avoirs, paiements, encaissements et rapprochement bancaire ;
- valeur `facturé` ou `encaissé` inventée à partir d’un Devis ou d’un réalisé ;
- rapports personnalisés enregistrés (`US-105`, V2) ;
- questions Finance en langage naturel (`US-100`, V2) ;
- publication Internet, connecteur Power BI distant, compte de service ou nouveau mécanisme d’authentification ;
- pièces jointes exportées, graphiques Excel dynamiques, publipostage et planification d’envois ;
- modification des moteurs G7, sauf correction démontrée d’une incohérence de réconciliation.

## 3. État de départ et divergence maîtrisée

G7 fournit déjà les read-models versionnés suivants : marges, backlog, forecast, occupation, rentabilité, dépassements non facturés et analyse tarifs/remises. Le dashboard historique fournit une occupation simple et un CA reconnu. Ces éléments sont des sources partielles, pas les dashboards G8.

Le Backlog du dashboard Finance cite « facturé ». Aucun registre de facture n’existe dans la V1 actuelle et l’Ordre interdit d’inventer un calcul financier. G8 affiche donc `unavailable` avec le libellé explicite **« Facturé indisponible — module de facturation non livré »**. Une valeur numérique, notamment zéro, serait non conforme.

Les rôles sans `finance.read` peuvent consulter les indicateurs commerciaux/opérationnels prévus par leur rôle, mais les clés de coût et de marge sont absentes de la réponse, jamais remplacées par zéro ou une valeur masquée calculable.

## 4. Incréments de développement

### S8-A — Dashboards métier (`US-094` à `US-099`)

- contrat commun des filtres, provenance, fraîcheur et drill-down ;
- six vues adaptées aux rôles, avec cartes, tableaux et états indisponibles explicites ;
- filtres partagés `asOf`, `from`, `to`, `siteId`, `projectId`, `clientId`, `salesOwnerId`, selon la vue ;
- liens vers Planning, Projet, Client, Devis, Réservation, Réalisé ou Finance avec le même périmètre ;
- accessibilité clavier, focus visible, titres, tableaux sémantiques et statuts non fondés sur la couleur.

### S8-B — Exports Planning et KPI (`US-101` à `US-103`)

- export Excel Planning fidèle à la sélection courante ;
- export PDF Planning paysage avec légende, période, filtres, pagination et métadonnées ;
- export Excel de chaque dashboard, avec feuille `Synthèse`, feuille `Détail` et feuille `Définitions` ;
- génération locale en mémoire avec limites strictes et noms de fichier neutralisés.

### S8-C — API Analytics / BI (`US-104`)

- catalogue fermé de datasets ;
- JSON paginé et CSV UTF-8 ;
- schémas et exemples OpenAPI ;
- mêmes définitions, filtres, scopes et projections financières que les dashboards ;
- aucun endpoint public, aucune clé secrète embarquée et aucun accès réseau sortant.

### S8-D — Sécurité finale (`US-107`, `US-109`)

- matrice rôle × dashboard × champ × export ;
- tests négatifs API/UI/export/SSE/audit sur coûts et marges ;
- tests unitaires, batch et imports sur `planning.override_conflict` ;
- motif d’override dédié de trois caractères minimum, conservé dans l’audit canonique ;
- preuve qu’un refus n’écrit ni Réservation, ni audit, ni événement, ni artefact.

## 5. Contrat commun des dashboards

### 5.1 Enveloppe

```text
DashboardResponse
  dashboard: direction|finance|planning|sales|operations|project
  definitionVersion
  generatedAt
  asOf
  period { from?, to?, timezone }
  filters { siteId?, projectId?, clientId?, salesOwnerId? }
  availability { invoiced, collected }
  kpis[]
  alerts[]
  sections[]
  sources { counts, freshness, scopeDigest }
```

Chaque KPI contient : `id`, `label`, `value`, `unit`, `status`, `definition`, `sourceCount` et `drilldown`. `status` appartient à `available`, `unavailable`, `partial`, `warning`. Un KPI monétaire utilise une chaîne d’entier en unité mineure avec `currency` et `currencyExponent`.

### 5.2 Périodes et fraîcheur

- `asOf` est une date ISO et ne peut être future selon le fuseau du filtre principal ;
- `from < to`; les intervalles temporels restent semi-ouverts ;
- les dashboards Planning/Exploitation utilisent le fuseau IANA du Site ;
- les dashboards multi-sites publient le fuseau de restitution et conservent les instants sources ;
- `generatedAt` et les versions des définitions permettent de comparer écran, export et API BI ;
- un export demande le même `asOf` et les mêmes filtres que l’écran afin d’éviter une réconciliation entre deux instants différents.

### 5.3 Drill-down

Le drill-down est une route paginée, pas une liste arbitrairement tronquée dans la carte KPI. Chaque ligne expose seulement les identifiants réellement autorisés et nécessaires : Client, Projet, Devis, version, ligne, Réservation, Réalisé, ressource, coût ou dépense selon le KPI.

Les scopes Société, Site, Projet et entité sont appliqués **avant** agrégation. Une source cachée ne modifie ni total, ni compteur, ni classement, ni choix d’une option visible. Un objet devenu inaccessible entre lecture et drill-down retourne `404` sans révéler son existence.

## 6. Définitions par dashboard

### 6.1 Direction

- CA signé, CA produit sur signé, backlog signé et forecast 30/60/90 ;
- marge planifiée et réelle uniquement avec `finance.read` ;
- occupation planifiée/réelle, saturation et sous-utilisation ;
- alertes : dépassements non facturés, conflits actifs, Projets sans planification et coûts/marges à risque ;
- filtres : période, Site et, pour un acteur Organisation, société courante entière.

### 6.2 Finance

- CA signé, produit sur signé, facturable, coûts planifiés/réels, marges et compléments ;
- facturé et encaissé marqués `unavailable` tant qu’aucune source comptable n’existe ;
- écarts par Projet et listes d’action pour dépassements non couverts ;
- export Excel depuis les mêmes lignes ;
- accès : `dashboard.read` + `finance.read`; les sources commerciales exigent aussi `quote.read`.

### 6.3 Planning

- occupation, sous-utilisation, saturation, options ouvertes, conflits et reste vendu à planifier ;
- filtres Site, période, Projet, catégorie et ressource ;
- chaque ligne ouvre le Planning sur la même fenêtre ;
- accès : `dashboard.read` + `planning.read` + `resource.read`; aucune donnée interne de coût.

### 6.4 Commercial

- nombre et montant des Budgets/Devis par statut, conversion Budget confirmé → Devis, conversion Devis → accepté ;
- CA signé, analyse tarifs/remises et répartition Client/commercial ;
- marge uniquement si l’acteur possède `finance.read` ;
- filtres commercial, Client, Projet, période et Site ;
- accès : `dashboard.read` + `quote.read` + `client.read` + `project.read` ou permission équivalente canonique.

### 6.5 Exploitation

- charge et disponibilité des ressources, maintenance, indisponibilités, occupation réelle et écarts planifié/réalisé ;
- filtres Site, catégorie, ressource et période ;
- accès : `dashboard.read`, `planning.read`, `resource.read`, `maintenance.read` et `actual.read` pour le réalisé ;
- absence de `actual.read` : section réelle `unavailable`, sans faux zéro.

### 6.6 Chef de projet

- Budget/Devis, complétude Planning, réalisé, écarts et alertes de ses Projets ;
- aucune donnée d’un Projet hors `projectIds` ou des scopes entité ;
- marge uniquement avec `finance.read` ;
- accès minimal : `dashboard.read`, `project.read`, `quote.read`, `planning.read`; la section réalisée exige `actual.read`.

## 7. API

Routes canoniques proposées :

```text
GET /api/v1/dashboards/:kind
GET /api/v1/dashboards/:kind/drilldown
GET /api/v1/analytics/datasets
GET /api/v1/analytics/datasets/:dataset
GET /api/v1/exports/planning.xlsx
GET /api/v1/exports/planning.pdf
GET /api/v1/exports/dashboards/:kind.xlsx
```

Les paramètres communs sont documentés dans OpenAPI. Les listes suivent `items`, `page`, `pageSize`, `total`; `pageSize <= 500`. Les datasets BI exposent au plus 10 000 lignes par requête et exigent une pagination/partition au-delà.

Le catalogue fermé de datasets V1 est :

```text
signed-revenue, backlog, forecast, margins,
occupancy, profitability, unbilled-overages, rate-discounts,
planning-reservations, actuals
```

`format=json` est le défaut. `format=csv` retourne UTF-8, en-têtes stables et neutralisation des cellules commençant par `=`, `+`, `-` ou `@` pour éviter l’injection tableur. Toute autre valeur retourne `422 ANALYTICS_FORMAT_UNSUPPORTED`.

## 8. Exports

### 8.1 Excel Planning

Le classeur contient :

- `Planning` : une ligne par allocation/jour visible, dates typées, statut, Projet, Client, prestation et ressource ;
- `Filtres` : période, Site, vue et exclusions ;
- `Définitions` : version, date de génération et convention temporelle.

Maximum : 10 000 lignes, 250 ressources et 366 jours. Au-delà : `422 EXPORT_TOO_LARGE` avec les dimensions à réduire. Les formules tableur issues des données utilisateur sont neutralisées.

### 8.2 PDF Planning

- A4 paysage jusqu’à 14 colonnes temporelles, A3 paysage au-delà ;
- maximum 62 jours par export ;
- en-tête répété, fuseau, filtres, légende textuelle et numéro de page ;
- aucun contenu masqué uniquement par la couleur ;
- génération locale sans fichier persistant public ni chemin fourni par l’utilisateur.

### 8.3 Excel KPI

- `Synthèse` reprend exactement les KPI visibles et leurs états ;
- `Détail` reprend le drill-down paginé complet dans la limite ;
- `Définitions` documente formule, `definitionVersion`, `generatedAt`, `asOf`, filtres, devise et compteurs sources ;
- les champs coût/marge ne sont pas créés sans `finance.read`.

## 9. Permissions, confidentialité et audit

- `dashboard.read` ouvre uniquement le shell des dashboards ; chaque section exige ses permissions sources ;
- `finance.read` autorise les coûts/marges en lecture et export ; `finance.cost.manage` reste requis pour leur mutation ;
- un export réapplique toutes les permissions et scopes, sans réutiliser un cache calculé sous un autre acteur ;
- les réponses, erreurs et compteurs ne révèlent aucun objet hors scope ;
- les téléchargements envoient `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` et un `Content-Disposition` neutralisé ;
- aucun export n’est écrit sous la racine statique, dans `data/` ou dans le dépôt ;
- les lectures et téléchargements ne mutent pas le métier. Les logs techniques enregistrent route, acteur pseudonymisé, durée, statut, format et volume, sans contenu exporté ;
- l’override conflit reste une mutation : permission, motif dédié, version, idempotence, audit `before/after`, `operationId`, origine et SSE après commit seulement.

## 10. Interface

- une entrée `Pilotage` présente seulement les dashboards réellement accessibles ;
- le dashboard par défaut dépend des permissions, jamais d’un rôle affiché non autoritaire ;
- les filtres sont partageables dans le hash local, bornés et échappés ;
- chaque carte indique libellé, valeur, unité, définition courte et dernière actualisation ;
- les états vide, indisponible, partiel, chargement et erreur sont distincts ;
- le drill-down conserve la position/filtres au retour ;
- les boutons d’export annoncent format et périmètre, affichent la progression et rendent les erreurs actionnables ;
- navigation clavier complète, focus restauré, tableaux avec en-têtes, dialogues nommés et annonces `aria-live` sobres.

## 11. Données, migration et rollback

Les dashboards et exports sont des read-models ; ils ne créent pas de copie analytique mutable. Une migration additive est requise uniquement pour :

- installer les permissions/matrices manquantes de façon rejouable ;
- enregistrer `definitionVersion` et le catalogue fermé si le runtime l’exige ;
- conserver un marqueur d’intégrité structurelle qui ne bloque pas les données métier légitimement mutables.

Avant migration : sauvegarde privée `0600` et digest. Le rollback exige un export de reprise privé, restaure byte-exactement la source et supprime uniquement les marqueurs/permissions ajoutés par Sprint 8. Les exports téléchargés ne font pas partie du rollback et ne sont jamais conservés par le serveur.

## 12. Tests obligatoires

### Domaine et contrat

- chaque KPI réconcilie exactement ses lignes de drill-down, y compris centimes, compléments et `asOf` ;
- sources hors Site/Projet/entité exclues avant total, compteur et classement ;
- `unavailable` pour facturé/encaissé et sections sans permission, jamais zéro ;
- même `definitionVersion`, `asOf`, filtres et totaux entre dashboard, Excel et BI ;
- options décidées/perdues, réalisé futur, coûts futurs, compléments et périodes DST sans double comptage ;
- pagination stable, bornes et erreurs documentées.

### Sécurité

- matrice des sept rôles standards sur six dashboards et trois exports ;
- absence de coûts/marges dans JSON, CSV, Excel, PDF, audit et SSE sans `finance.read` ;
- neutralisation CSV/Excel, noms de fichiers et texte PDF malveillants ;
- isolation Société/Site/Projet/entité et révocation entre écran et export ;
- override refusé sans permission/motif/version et sans effet secondaire ; replay exact autorisé, divergence `409`.

### Performance

Dataset contractuel : 250 ressources, 10 000 réservations, 2 000 documents commerciaux, 2 000 réalisés et 2 000 coûts.

- lecture de chaque dashboard p95 `< 300 ms` ;
- drill-down paginé p95 `< 300 ms` ;
- export Excel 10 000 lignes et PDF 62 jours terminé `< 2 s` ou refus borné avant travail coûteux ;
- écran exploitable `< 2 s`, sans reconstruction DOM non bornée ;
- génération asynchrone par tranches lorsque le travail CPU risquerait de bloquer la boucle événementielle.

### E2E G8

1. Admin ouvre Direction, filtre Site/période et atteint une source par drill-down.
2. Finance exporte le dashboard et réconcilie le total avec l’écran et l’API BI.
3. Planificateur ouvre Planning, voit saturation/options/conflits et rejoint la même fenêtre Planning.
4. Commercial voit pipeline/remises mais aucun coût/marge sans `finance.read`.
5. Chef de projet ne voit que ses Projets ; une URL devinée hors scope répond `404`.
6. Export Planning Excel/PDF reflète les filtres et reste lisible après rechargement.
7. Override de conflit : refus sans droit, succès motivé avec droit, audit vérifié.
8. Redémarrage local : résultats identiques sur le même `asOf`; aucun fichier temporaire orphelin.

## 13. Critères de sortie G8

G8 est `APPROVED` seulement si, sur un même candidat :

- les douze stories Sprint 8 sont couvertes sans P0/P1 ;
- chaque KPI est drillable et réconciliable jusqu’aux sources autorisées ;
- les six dashboards respectent la matrice de permissions et les scopes ;
- Excel, PDF et BI sont cohérents avec l’écran et bornés ;
- aucune fuite de coût/marge et aucun override non motivé n’est possible ;
- OpenAPI, migration et rollback sont validés ;
- tests ciblés, suite complète, lint/build/diff-check, SECURITY/PERFORMANCE, INTEGRATION et E2E sont verts.

Tant que ces critères ne sont pas réunis, le statut G8 reste **BLOQUÉ** et le Sprint 9 ne démarre pas.
