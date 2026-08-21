# Spécification fonctionnelle et domaine — Organisation 01

Statut : proposition SPEC à soumettre à revue indépendante  
Version cible : `0.3.0-alpha.1`  
Date : 2026-08-14  
Owner de contrat : Product / Domain Organisation 01 (`companyId`, identité, sites, unités, onboarding)  
Chaîne de fondation : ORG-01 historique → ORG-01b fiscal → RES-02 → PROJ-04 → PLAN-03 ; frontend Organisation consommateur hors migration

## 1. Décision produit et rôle du module

Le module **Organisation 01** est le socle obligatoire de la plateforme. Il permet de créer et administrer plusieurs organisations juridiquement et opérationnellement distinctes, par exemple **Eliote Props Prod**, **Eliote Location** et **FAV Location**, sans fixer de limite métier au nombre d'organisations futures.

Une organisation est un **tenant isolé**. Elle possède son identité, ses sites, ses services, ses membres, ses ressources, ses clients, ses projets, ses réservations, son stock et son audit. Aucune entité métier ne peut exister hors d'une organisation.

**Décision canonique RC :** le terme métier et le libellé d'interface sont « organisation », mais la collection persistée reste `companies`, l'identifiant d'autorité reste `companyId` et les contrats JSON/API RC utilisent exclusivement `companyId`. Une requête contenant `organizationId`, seul ou avec `companyId`, est rejetée en `400 VALIDATION_ERROR` avec `details: { "field": "organizationId", "reason": "FIELD_NOT_ALLOWED" }`; aucun alias n'est normalisé. Cette décision reste compatible avec le canon de `docs/target-architecture-v1.md`.

L'ordre fonctionnel est impératif :

```text
Organisation validée
  -> au moins un Site et un Service validés
  -> Ressources matérielles et humaines configurées
  -> Client puis Projet/Émission validé
  -> Réservation et Planning
```

Le frontend guide cet ordre et bloque les étapes non disponibles. L'API applique les mêmes préconditions ; masquer un bouton ne constitue jamais un contrôle métier.

### 1.1 Divergences explicites avec le MVP 0.1

Le présent document applique la décision la plus récente du Product Owner et remplace, pour les futurs développements, deux règles du MVP :

- `docs/spec-mvp.md` autorise une réservation sans projet ; Organisation 01 exige désormais un `projectId` actif et validé pour toute nouvelle réservation ;
- le parcours MVP pouvait créer les référentiels dans un ordre souple ; le nouveau parcours est séquentiel et chaque gate doit être validé avant le suivant.

`docs/ux-flows.md` ne présente pas encore les champs fiscaux dans l'onboarding. Il doit être corrigé par son owner UX avant DEV frontend : O1 affiche et valide `taxCountry`, `currency`, `vatStatus`, `taxIdentifiers` structurés, `defaultVatRateId`, la policy appliquée et les erreurs `missingFields` définies ici. Jusqu'à cette mise à jour, la présente SPEC est normative ; l'UI ne peut ni masquer ces champs ni déclarer O1 complet sans réponse serveur.

La reprise des réservations historiques suit le canon du Lead Architect publié dans `docs/target-architecture-v1.md` et `docs/architecture-roadmap.md` : les writers PROJ-04 puis PLAN-03 appliquent les entités et rattachements normatifs avant activation du writer Planning. Aucune réservation n'arrive au handoff Planning sans `projectId`. Organisation 01 ne définit aucun champ, état ou route de ces entités ; leur contrat appartient exclusivement à la spec owner 04 et aux références architecturales citées.

### 1.2 Architecture conservée

Le lot reste une évolution incrémentale du monolithe Node.js/CommonJS et de la persistance JSON atomique RC1. Il n'autorise ni migration implicite vers TypeScript/React/SQLite, ni SaaS, ni microservice. La cible de `docs/architecture.md` reste valable ; la migration de stack relève d'un lot séparé.

## 2. Périmètre

### Inclus

- création de plusieurs organisations et sélection d'un contexte actif ;
- identité juridique, identité commerciale et profil opérationnel détaillés ;
- adresses et contacts structurés ;
- activités multiples : post-production, location, laboratoire et services ;
- fuseau, devise, langue et paramètres de base ;
- sites, départements/services et arborescence opérationnelle ;
- onboarding séquentiel avec calcul de complétude serveur et validation explicite des gates ;
- membres, rôles, permissions et périmètres de sites/services ;
- préconditions contractuelles pour Ressources, Projets et Planning ;
- isolation stricte entre organisations, audit, contrôle optimiste et SSE ;
- migration additive des données RC1 et seed déterministe multi-organisations.

### Exclus de ce lot

- SSO, MFA, facturation d'abonnement et administration SaaS ;
- registre automatique SIRENE/VIES, géocodage ou validation d'adresse par service externe ;
- comptabilité, TVA calculée, contrats, paie et facturation ;
- ressources, projets et planning eux-mêmes, hors définition de leurs préconditions ;
- import massif, fusion ou suppression physique d'une organisation ;
- partage d'une ressource, d'un projet ou d'une réservation entre organisations ;
- migration de stack ou de persistance.

## 3. Vocabulaire et frontières

- **Organisation** : tenant juridique et opérationnel isolé, anciennement `company` dans la RC1.
- **Site** : implantation physique ou unité d'exploitation possédant une adresse et un fuseau. Un site appartient à une seule organisation.
- **Unité organisationnelle** : département, service, laboratoire ou équipe. Elle peut être globale à l'organisation ou rattachée à un site.
- **Activité** : domaine exercé par l'organisation (`postProduction`, `rental`, `laboratory`, `services`, `other`). Elle pilote les options proposées, jamais l'autorisation à elle seule.
- **Service proposé** : prestation commerciale ou technique, par exemple montage, étalonnage, mixage, PAD, laboratoire ou location. Il ne doit pas être confondu avec une unité organisationnelle interne.
- **Membre** : utilisateur disposant d'une affectation à une organisation, éventuellement bornée à des sites et services.
- **Ressource salle** : salle de montage, étalonnage, mixage, PAD ou laboratoire. Son équipement sera sélectionné dans le parc matériel canonique, jamais ressaisi comme copie libre.

## 4. Modèle de données canonique

Toutes les entités portent `id`, `companyId` sauf la société/organisation elle-même, `createdAt`, `updatedAt`, `version` si modifiables et un statut logique. Les identifiants sont opaques. Les dates sont en UTC ISO 8601 ; les fuseaux sont des identifiants IANA. `companyId` vient exclusivement de la session active et ne peut jamais être changé sur une entité existante.

### 4.1 `companies` — organisation dans l'interface

| Champ | Règle |
|---|---|
| `id` | opaque, immuable |
| `legalName` | raison sociale officielle, requise, 2–160 caractères |
| `tradeName` | nom commercial, facultatif, 1–160 caractères |
| `code` | code interne normalisé, requis, 2–32 caractères, unique globalement dans l'instance |
| `slug` | dérivé à la création, unique, stable ; non utilisé comme autorité |
| `legalForm` | forme juridique, requise : valeur de catalogue extensible (`SAS`, `SASU`, `SARL`, `EURL`, `SA`, `SCI`, `association`, `soleTrader`, `other`) |
| `registrationCountry` | code pays ISO 3166-1 alpha-2 requis |
| `taxCountry` | territoire fiscal principal ISO 3166-1 alpha-2 requis ; distinct du pays d'immatriculation si nécessaire |
| `taxIdentifiers` | liste structurée, bornée et validée selon la policy pays ; jamais une chaîne libre agrégée |
| `vatStatus` | `registered`, `exempt` ou `notApplicable`, requis |
| `shareCapital` | facultatif, montant entier en unité mineure, >= 0 ; informatif seulement |
| `activities` | ensemble non vide de valeurs du catalogue fermé |
| `primaryActivity` | une valeur requise, membre de `activities` ; activité mise en avant et utilisée pour les valeurs proposées par défaut |
| `activityRequirements` | décisions structurées par activité/catégorie : `enabled` ou `nonApplicable`; voir règle O2 |
| `activityDescription` | précision libre bornée à 500 caractères, texte simple |
| `defaultTimezone` | fuseau IANA requis |
| `currency` | code ISO 4217 requis, `EUR` par défaut dans le seed |
| `defaultVatRateId` | identifiant requis d'un `vatRate` actif et applicable à la date courante sous le même `companyId` |
| `fiscalProfileVersion` | entier positif incrémenté uniquement lors d'une mutation du profil fiscal/monétaire ; utilisé par les snapshots aval |
| `locale` | locale BCP 47 requise, `fr-FR` par défaut |
| `defaultCountry` | ISO 3166-1 alpha-2 requis |
| `website` | URL `https` facultative, 300 caractères maximum |
| `logoAssetId` | facultatif ; référence à un actif local contrôlé, jamais URL distante ni chemin fourni par l'utilisateur |
| `status` | `draft`, `active`, `suspended`, `archived` |
| `onboardingStage` | projection serveur : `identity`, `sitesServices`, `members`, `ready` |
| `legalValidationPolicy` | objet serveur `{ country, policyVersion }`, figé à chaque validation juridique |
| `taxValidationPolicy` | objet serveur `{ country: taxCountry, policyVersion }`, figé à chaque validation fiscale |
| `fiscalValidatedAt`, `fiscalValidatedBy` | renseignés par la validation explicite O1 ; absents après migration tant que le profil proposé n'est pas confirmé |
| `validatedAt`, `validatedBy` | renseignés lors de l'activation initiale |
| `version` | entier positif, contrôle optimiste obligatoire |

`legalName` et chaque identifiant `businessRegistration` sont contrôlés après normalisation conformément à la policy et aux règles d'unicité de l'instance. Un doublon ne doit jamais révéler une organisation inaccessible : hors périmètre autorisé, l'API répond par une erreur générique.

La validation des identifiants légaux repose sur un catalogue local versionné par pays, par exemple `FR@1` pour les formats SIREN/SIRET/TVA. La politique appliquée est persistée dans `legalValidationPolicy`; une évolution de politique ne rend pas silencieusement invalides les organisations déjà validées. Leur revalidation est une commande explicite, auditée et testée. Pour un pays sans politique spécialisée, `GENERIC@1` exige un numéro non vide borné sans prétendre certifier son existence.

#### 4.1.1 Profil fiscal, identifiants et taux de TVA

Chaque entrée de `taxIdentifiers` contient exactement : `type`, `country`, `value`, `label?`, `policyVersion`. `type` appartient au catalogue fermé `businessRegistration`, `establishment`, `vat`, `taxNumber`, `other`; `country` est ISO 3166-1 alpha-2 ; `value` contient 2 à 64 caractères après trim ; `label` est limité à 80 caractères ; la liste est limitée à 20 entrées et le triplet normalisé `(type, country, value)` est unique sous un même `companyId`. Le serveur conserve la valeur canonique sans espaces décoratifs et ne prétend jamais vérifier l'existence administrative d'un identifiant sans source officielle autorisée.

La policy locale est versionnée. Pour `FR@1`, `businessRegistration` accepte le SIREN à 9 chiffres, `establishment` le SIRET à 14 chiffres dont les 9 premiers correspondent au SIREN, et `vat` le format TVA intracommunautaire français. O1 exige SIREN et SIRET du siège ; l'identifiant TVA est requis lorsque `vatStatus="registered"`. Avec `exempt` ou `notApplicable`, aucun faux numéro TVA n'est créé et le taux par défaut peut être `0` via un taux configuré explicite. Les autres territoires utilisent leur policy versionnée ; `GENERIC@1` applique seulement les bornes structurelles et exige une validation humaine explicite.

`vatRates` est la collection canonique des taux configurables : `id`, `companyId`, `code`, `label`, `rateBps`, `active`, `validFrom`, `validTo?`, `version`, `createdAt`, `updatedAt`. `code` est normalisé et contient 2–32 caractères ; `(companyId, code, validFrom)` est unique ; `label` contient 2–80 caractères ; `rateBps` est un entier de `0` à `10000`; `validFrom` et `validTo` sont des dates civiles ISO avec intervalle semi-ouvert `[validFrom, validTo)`. Un même code ne possède pas deux périodes actives qui se chevauchent. Une ligne déjà référencée par un document fiscal devient immuable pour `rateBps` et ses bornes : une évolution crée une nouvelle ligne/version métier.

La représentation monétaire canonique exclut les nombres flottants : `rateBps=2000` signifie `20,00 %` et `rateBps=550` signifie `5,50 %`. `defaultVatRateId` est la source d'autorité ; l'API peut exposer la projection en lecture `defaultVatRate: { id, code, rateBps }`, mais n'accepte jamais un décimal flottant comme seconde source. Pour `taxCountry="FR"`, l'interface propose un taux normal initial de `2000` points de base. Cette valeur est un défaut modifiable, jamais une constante légale figée : un administrateur peut sélectionner un autre taux actif ou configurer un taux futur. Pour tout autre territoire, le serveur ne déduit aucun taux légal ; O1 exige une configuration explicite conforme à la policy locale.

Un changement de `taxCountry` revalide atomiquement tous les identifiants, `vatStatus` et le taux par défaut avec la nouvelle policy ; il est refusé si la commande ne fournit pas un profil complet compatible. Aucun identifiant ou taux de l'ancien territoire n'est conservé silencieusement comme valeur valide. `currency` accepte exclusivement un code ISO 4217 du catalogue local versionné.

Chaque entrée `activityRequirements` contient `activity`, `category`, `decision`, `reason?`, `decidedBy?`, `decidedAt?`. `decision: "nonApplicable"` exige un motif de 10 à 500 caractères, un acteur autorisé et un audit ; il ne crée pas de `serviceOffering` fictif. Repasser à `enabled` invalide O2 jusqu'à création d'une prestation active correspondante.

### 4.2 Adresses et contacts

`organizationAddresses` contient : `type` (`registeredOffice`, `billing`, `operational`, `other`), `label`, `line1`, `line2?`, `postalCode`, `city`, `region?`, `country`, `isPrimary`, `version`. Une organisation active possède exactement une adresse principale `registeredOffice`.

`organizationContacts` contient : `type` (`administrative`, `billing`, `operations`, `technical`, `legal`, `other`), `name`, `jobTitle?`, `email?`, `phone?`, `isPrimary`, `active`, `version`. Au moins un email ou un téléphone est requis. Une organisation active possède au moins un contact principal administratif ou opérationnel.

Les coordonnées restent des données sensibles au sens applicatif : lecture limitée par permission, jamais dans les événements SSE ni les logs.

### 4.3 `sites`

Champs : `companyId`, `code`, `name`, `siteType` (`headOffice`, `postProduction`, `rental`, `laboratory`, `mixed`, `other`), `address`, `timezone`, `phone?`, `email?`, `activities`, `replacementSiteId?`, `active`, `version`.

Contraintes :

- `code` unique par `companyId` ; `name` unique par `companyId` après normalisation ;
- adresse complète requise avant activation ;
- `activities` est un sous-ensemble des activités de l'organisation ;
- fuseau IANA requis ; par défaut celui de l'organisation, mais stocké explicitement ;
- un site référencé ne se supprime pas : il est désactivé ; si des ressources actives y sont rattachées, la commande exige un `replacementSiteId` actif du même `companyId`, distinct du site désactivé, et une stratégie explicite de réaffectation ; les réservations actives futures continuent de bloquer la désactivation. Le remplacement n'est jamais déduit automatiquement.

### 4.4 `organizationUnits`

Champs : `companyId`, `siteId?`, `parentUnitId?`, `code`, `name`, `kind` (`department`, `service`, `laboratory`, `team`), `activities`, `managerMembershipId?`, `active`, `version`.

Contraintes : même `companyId` pour le parent, le site et le responsable ; profondeur maximale 4 ; aucune boucle ; `code` unique par `companyId` ; un service global (`siteId: null`) peut être utilisé sur plusieurs sites. Exemples seedés : Montage, Étalonnage, Mixage, PAD, Laboratoire, Location.

### 4.5 `serviceOfferings`

Champs : `companyId`, `organizationUnitId?`, `code`, `name`, `category` (`editing`, `grading`, `mixing`, `pad`, `laboratory`, `rental`, `other`), `description?`, `active`, `version`.

Cette entité décrit ce que l'organisation propose. Les tarifs et la facturation restent hors lot Finance. Une prestation ne porte aucun prix dans Organisation 01.

### 4.6 Membres, rôles et périmètres

`users` porte l'identité de connexion locale. `organizationMemberships` porte : `userId`, `companyId`, `displayName`, `jobTitle?`, `employeeReference?`, `status` (`invited`, `active`, `suspended`), `defaultSiteId?`, `version`.

`membershipRoles` relie une affectation à un rôle. `membershipScopes` contient des `siteIds` et `organizationUnitIds` autorisés. Une liste de sites vide signifie **aucun site**, jamais tous les sites. Le privilège global est explicite par `scope: "organization"`.

Rôles seedés :

| Rôle | Capacités minimales |
|---|---|
| Administrateur plateforme local | créer une organisation et désigner son premier administrateur ; pas d'accès implicite à ses données métier après création |
| Administrateur organisation | gérer identité, sites, services, membres et rôles de son organisation |
| Responsable de site | gérer unités et futures ressources dans ses sites autorisés ; lire l'identité |
| Planificateur | lire organisation/sites/services ; gérer clients, projets et planning dans son périmètre |
| Gestionnaire de parc | lire organisation/sites/services ; gérer parc et affectations dans son périmètre |
| Lecteur | lecture des référentiels et modules explicitement autorisés |

Catalogue minimal de permissions :

- `organization.create`, `organization.read`, `organization.manage`, `organization.activate`, `organization.archive` ;
- `site.read`, `site.manage` ;
- `organizationUnit.read`, `organizationUnit.manage` ;
- `serviceOffering.read`, `serviceOffering.manage` ;
- `fiscalProfile.read`, `fiscalProfile.manage`, `vatRate.read`, `vatRate.manage` ;
- `membership.read`, `membership.manage`, `role.manage`, `audit.read` ;
- permissions existantes des modules aval, attribuées séparément.

Un administrateur ne peut pas retirer ou suspendre le dernier administrateur actif de l'organisation. Le changement de contexte actif exige une affectation active ; il renouvelle la session ou son contexte opaque côté serveur. Le `companyId` demandé sert uniquement à désigner une affectation candidate, puis le serveur établit lui-même le nouveau contexte d'autorité.

Le seed attribue les quatre permissions fiscales à l'Administrateur organisation uniquement. `organization.manage` ne confère pas implicitement `fiscalProfile.manage` ou `vatRate.manage`; chaque route contrôle sa permission dédiée. La permission future `quote.overrideVatRate` est distincte, n'autorise aucune mutation du profil Organisation et ne sera attribuée qu'au lot Devis.

### 4.7 Référence normative Client et Projet/Émission — owner Projets 04

Organisation 01 ne redéfinit ni champs, ni états, ni transitions, ni routes, ni permissions Client/Projet. Leur contrat unique est **`docs/spec-project-planning-sequence.md`, sections 4.1, 4.2, 8, 9 et 10**, sous l'ownership exclusif du module Projets 04. Il s'applique ici intégralement, notamment au modèle multi-site, à `planningReadiness` et à `kind: "emission"`. En cas d'écart futur, la spec owner 04 prévaut sur toute formulation résumée dans Organisation 01, sous réserve de la décision architecturale de reprise RC1 explicitée en 1.1 et 9.

Organisation 01 fournit uniquement `companyId`, sites, scopes et préconditions de tenant à l'owner 04. Elle ne crée, ne migre et ne modifie aucun Client ou Projet. Une réservation ne peut jamais se substituer à un Client ou à un Projet manquant.

### 4.8 Fondation Devis — contrat aval hors périmètre

Organisation 01 ne crée ni route, ni collection, ni interface Devis dans ce lot. Le futur owner et writer des devis/quotes est **Commercial 08**. Finance 09a reste l'autorité de valorisation interne, coûts, revenus et marges ; il n'est ni owner du taux fiscal du devis, ni writer de son snapshot fiscal.

Organisation 01 publie `CompanyFiscalProfilePort.v1`. Commercial 08 appelle `snapshotForQuote({ companyId, siteId?, taxDate, requestedVatRateId? }, authContext)`. `taxDate` est une date civile exacte `YYYY-MM-DD`. `taxTimezone` n'est jamais fourni par le navigateur : le port le résout depuis le fuseau IANA du `siteId` autorisé, ou à défaut depuis `defaultTimezone`. Le taux doit être actif sur l'intervalle civil contenant `taxDate` dans ce fuseau. `requestedVatRateId` est facultatif ; absent, le port utilise `defaultVatRateId`; présent, il exige `quote.overrideVatRate`, le même `companyId` et une période applicable.

Le port retourne exactement le snapshot suivant, sans champ implicite :

```text
CompanyFiscalSnapshot = {
  companyId,
  fiscalProfileVersion,
  legalName,
  tradeName?,
  registeredOfficeAddress: {
    line1, line2?, postalCode, city, region?, country
  },
  taxCountry,
  taxIdentifiers: [{ type, country, value, policyVersion }],
  vatStatus,
  currency,
  currencyExponent,
  currencyPolicyVersion,
  taxDate,
  taxTimezone,
  vatRate: {
    id, code, label, rateBps, validFrom, validTo?, version
  },
  capturedAt
}
```

L'adresse est l'adresse légale `registeredOffice` principale validée. La liste d'identifiants contient uniquement ceux exigés pour le document par `taxValidationPolicy`, dans l'ordre déterministe `businessRegistration`, `establishment`, `vat`, `taxNumber`, `other`; aucun contact, note ou identifiant interne n'est ajouté. Le snapshot est immuable dès la création du devis. Une modification ultérieure du profil, de la devise ou d'un taux ne recalcule aucun devis existant ; une révision crée un nouveau snapshot.

La règle fiscale fermée du premier lot Commercial 08 est **un taux unique au niveau document**. Toutes les lignes d'un devis utilisent le `vatRate` du snapshot ; une ligne ne porte ni `vatRateId`, ni `rateBps`. Les taux mixtes exigeraient une nouvelle SPEC et ne peuvent pas être introduits par un champ libre. La permission `quote.overrideVatRate` autorise uniquement un taux configuré et applicable, jamais un nombre arbitraire.

Le catalogue local ISO 4217 versionné fournit `currencyExponent`, limité dans ce contrat à `0`, `2` ou `3`. Les montants `netHt`, `vatAmount`, `grossTtc` sont des entiers d'unités mineures signés sur 64 bits, bornés ici à `0..9223372036854775807`. Pour éviter toute perte dans JSON/JavaScript, ils sont sérialisés et persistés comme chaînes décimales correspondant exactement à `0|[1-9][0-9]{0,18}`, sans signe `+`, espace ni séparateur, puis calculés en entier exact (`BigInt` ou équivalent). Une devise absente du catalogue ou avec un exposant non supporté est refusée.

Pour chaque ligne non négative : `lineVatAmount = floor((lineNetHt × rateBps + 5000) / 10000)` ; cette formule est l'arrondi **half-up** à l'unité mineure. Les produits intermédiaires sont calculés en précision arbitraire ; chaque entrée, résultat de ligne, somme et conversion finale doit rester dans la borne int64, sinon la commande entière échoue avec `AMOUNT_OVERFLOW`. Les totaux sont calculés dans cet ordre : `netHt = Σ lineNetHt`, `vatAmount = Σ lineVatAmount`, `grossTtc = Σ (lineNetHt + lineVatAmount)` puis contrôle `grossTtc = netHt + vatAmount`. Aucun arrondi global, flottant binaire ou changement d'exposant n'est permis.

Le handoff Organisation 01 → Commercial 08 contient la version du port, les DTO requête/snapshot ci-dessus, policies fiscales/ISO 4217, erreurs stables (`FISCAL_PROFILE_INCOMPLETE`, `VAT_RATE_NOT_APPLICABLE`, `CURRENCY_NOT_SUPPORTED`, `AMOUNT_OVERFLOW`), fixtures et tests de contrat. Les permissions futures `quote.read`, `quote.manage`, `quote.overrideVatRate`, états, numérotation, remises, révisions, exports et facturation restent hors scope Organisation 01.

## 5. Onboarding séquentiel et complétude

La complétude est calculée par le serveur à partir des données persistées. Le client ne fournit jamais un pourcentage ni un statut de gate faisant autorité. Chaque validation relit les préconditions dans une mutation atomique et écrit un audit.

### Gate O1 — Identité de l'organisation

Obligatoire : `legalName`, `code`, `legalForm`, pays d'immatriculation, `taxCountry`, `vatStatus`, identifiants légaux/fiscaux exigés par les policies versionnées, adresse principale du siège, contact principal, au moins une `activity`, une `primaryActivity` appartenant à cet ensemble, fuseau, `currency`, locale et un `defaultVatRateId` actif/applicable. Pour `FR@1`, SIREN et SIRET du siège sont requis ; la TVA intracommunautaire l'est seulement avec `vatStatus="registered"`. `tradeName`, logo, site web et capital restent facultatifs et ne diminuent jamais la complétude.

Le sous-parcours UX O1 est fermé : `Identité légale` → `Territoire et statut fiscal` → `Identifiants structurés` → `Devise et taux par défaut` → `Validation`. Changer `taxCountry` recharge la policy, revalide les identifiants et invalide toute sélection incompatible ; changer `vatStatus` affiche ou retire l'exigence TVA sans inventer de valeur. Le taux est choisi par `defaultVatRateId` dans les taux applicables, jamais saisi en décimal libre. `Suivant` appelle la complétude serveur et place le focus sur le premier chemin `missingFields` fiscal.

Résultat : l'organisation passe de `draft/identity` à `draft/sitesServices`. Les modules Sites et Services deviennent modifiables ; Ressources, Clients, Projets et Planning restent bloqués.

### Gate O2 — Structure opérationnelle

Obligatoire : au moins un site actif et complet ; au moins une unité active compatible avec les activités ; au moins une `serviceOffering` active pour chaque exigence `enabled`. Pour `postProduction`, Montage, Étalonnage, Mixage et PAD possèdent chacune une entrée `activityRequirements` explicitement `enabled` ou `nonApplicable`; `nonApplicable` exige motif et audit selon 4.1. Pour `laboratory`, au moins une prestation de laboratoire est requise sauf décision `nonApplicable` explicite. Une unité interne et une prestation ne sont jamais interchangeables.

Résultat : passage à `draft/members`. La gouvernance devient configurable ; Ressources reste bloqué jusqu'à l'activation après O3. Le produit devra ensuite permettre la création en série d'au moins 120 salles sans dégradation fonctionnelle, mais la performance et l'ergonomie de cet écran relèvent du lot Ressources.

### Gate O3 — Gouvernance

Obligatoire : au moins un administrateur organisation actif ; ses droits couvrent l'organisation ; chaque site actif possède au moins un responsable explicite ou hérite d'un administrateur global.

Résultat : l'organisation peut être activée. `POST /activate` passe à `active/ready` après relecture de O1–O3.

### Gate R1 — Ressources, contrat aval

Pour accéder à Projets puis Planning :

- au moins une ressource active doit exister sur le site concerné ;
- chaque ressource porte `companyId`, `siteId` et `organizationUnitId` compatibles ; `serviceId` n'est pas accepté comme alias ;
- une salle de post-production porte une sous-catégorie (`editingRoom`, `gradingRoom`, `mixingRoom`, `padRoom`, `laboratoryRoom`, `otherRoom`) ;
- les équipements d'une salle sont des affectations vers des exemplaires sérialisés actifs du parc, avec référence article et numéro de série canoniques ; aucune saisie libre ne duplique le matériel ;
- une ressource humaine est une entité distincte liée, si pertinent, à une affectation membre, un service et des compétences ; elle ne confère aucun droit applicatif.

### Gate P1 — Client et Projet/Émission, contrat aval

Le déblocage suit exclusivement le contrat owner 04 référencé en 4.7 : client canonique actif et visible sur le site, puis projet `kind: "emission"`, `status: "active"` et `planningReadiness: "ready"`. Organisation 01 ne recalcule pas ces états ; elle consomme le port publié par Projets 04.

### Gate PL1 — Planning, contrat aval

Une nouvelle réservation est refusée tant que l'organisation, le site, la ressource et le projet ne satisfont pas leurs gates. Elle exige `projectId`, `siteId`, au moins une ressource compatible et une période valide.

L'unité visuelle de base du planning post-production est la **cellule jour × salle**. Une allocation peut couvrir un jour, plusieurs jours, semaines ou mois ; le serveur conserve un intervalle semi-ouvert `[startsAt, endsAt)` et l'UI projette cet intervalle en cellules quotidiennes dans le fuseau du site. Déplacer une cellule ou une sélection de cellules vers une autre salle conserve la période et repasse toutes les validations : même organisation/site, compatibilité, disponibilité, capacité, version et conflit. Les actions en masse restent atomiques.

### Comportement des blocages

- frontend : étape suivante désactivée avec raison précise et lien vers les champs manquants ; aucun écran vide ou action silencieuse ;
- API : `409 PREREQUISITE_NOT_MET` avec `details.stage`, `details.missingFields` et `details.nextAction` ;
- soumission d'un gate incomplet : `422 ONBOARDING_INCOMPLETE` avec erreurs par champ ;
- accès direct par URL à une étape interdite : page explicative, sans redirection en boucle ;
- un utilisateur en lecture seule voit l'état de complétude mais pas les actions de correction.

## 6. Règles métier et transitions

1. Une organisation est créée en `draft`; seule une organisation `active/ready` autorise de nouvelles données métier aval.
2. Les transitions permises sont `draft -> active -> suspended -> active` et `draft|suspended -> archived`. `archived` est terminal dans ce lot.
3. Suspendre bloque les nouvelles mutations métier mais autorise lecture, export futur, audit et opérations de remise en conformité. Annuler une réservation existante reste permis aux rôles autorisés.
4. Archiver exige confirmation, motif, absence de réservation active future et version courante. Aucune suppression physique n'est exposée.
5. Retirer une activité utilisée par un site, un service, une ressource ou une prestation active est refusé avec les références bloquantes.
6. Changer fuseau ou devise après activation est une mutation sensible. La devise est refusée si des objets Finance existent ; le fuseau ne modifie jamais les instants historiques.
7. Une entité enfant ne peut jamais changer d'organisation. Un transfert futur doit être un workflow explicite de copie/rattachement audité.
8. Chaque mutation sensible exige `version`, contrôle RBAC et périmètre, validation, écriture atomique, audit, puis invalidation SSE après succès.
9. Les listes sont paginées et recherchables ; les limites maximales sont imposées par le serveur.
10. Les erreurs ne révèlent ni l'existence ni les identifiants d'une autre organisation.
11. Modifier le taux par défaut ou un taux futur n'altère aucun snapshot fiscal existant. Désactiver le taux par défaut courant est refusé jusqu'à sélection atomique d'un autre taux actif/applicable.
12. `taxCountry`, `currency`, identifiants fiscaux, `defaultVatRateId` et toute revalidation de policy incrémentent `fiscalProfileVersion` ainsi que `version`; une ancienne valeur de l'une ou l'autre provoque `409 VERSION_CONFLICT`.

## 7. Contrats API `/api/v1`

Conventions existantes conservées : JSON UTF-8 `camelCase`, listes `{ items, page, pageSize, total }`, `Idempotency-Key` sur créations, `version` sur modifications et erreurs `{ error: { code, message, details?, requestId } }`.

```text
GET    /companies                             # organisations des affectations visibles
POST   /companies                             # permission plateforme organization.create
GET    /companies/:id
PATCH  /companies/:id                         # version obligatoire
GET    /companies/:id/completeness
POST   /companies/:id/validate-stage          # { stage, version }
POST   /companies/:id/activate                # version obligatoire
POST   /companies/:id/suspend                 # { reason, version }
POST   /companies/:id/archive                 # { reason, confirmation, version }
POST   /session/company-context               # { companyId }, affectation active requise

GET    /companies/:id/fiscal-profile          # fiscalProfile.read
PATCH  /companies/:id/fiscal-profile          # fiscalProfile.manage, versions obligatoires
GET    /vat-rates?active=&validOn=&page=&pageSize=
POST   /vat-rates                             # vatRate.manage + Idempotency-Key
PATCH  /vat-rates/:id                         # vatRate.manage + version

GET    /organization-addresses?type=&page=&pageSize=
POST   /organization-addresses
PATCH  /organization-addresses/:id
GET    /organization-contacts?type=&active=&page=&pageSize=
POST   /organization-contacts
PATCH  /organization-contacts/:id

GET    /sites?active=&activity=&page=&pageSize=
POST   /sites
PATCH  /sites/:id
GET    /organization-units?siteId=&kind=&active=&page=&pageSize=
POST   /organization-units
PATCH  /organization-units/:id
GET    /service-offerings?category=&active=&page=&pageSize=
POST   /service-offerings
PATCH  /service-offerings/:id

GET    /memberships?siteId=&organizationUnitId=&status=&page=&pageSize=
POST   /memberships                           # invitation locale ou rattachement utilisateur
PATCH  /memberships/:id
PUT    /memberships/:id/roles                 # version + roleIds
PUT    /memberships/:id/scopes                # version + scope explicite
GET    /roles
POST   /roles
PATCH  /roles/:id
```

Le corps d'une requête enfant n'accepte aucun champ de tenant. Le `companyId` d'autorité est obtenu du contexte de session actif ; quand la sélection de contexte reçoit un `companyId`, il ne devient autorité qu'après validation de l'affectation. Une route `companies/:id` compare toujours `:id` au périmètre autorisé. Toute relation fournie (`siteId`, `organizationUnitId`, `serviceOfferingId`, `membershipId`, `logoAssetId`) est relue sous ce même `companyId`. `unitId` et `serviceId` ne sont pas des alias de contrat.

Le DTO fiscal en lecture expose : `companyId`, `taxCountry`, `currency`, `vatStatus`, `taxIdentifiers`, `legalValidationPolicy`, `taxValidationPolicy`, `defaultVatRateId`, `defaultVatRate` projeté, `fiscalProfileVersion`, `fiscalValidatedAt`, `version`. `PATCH fiscal-profile` accepte uniquement `taxCountry`, `currency`, `vatStatus`, `taxIdentifiers`, `defaultVatRateId`, `fiscalProfileVersion`, `version`; les policies, la projection et les métadonnées de validation sont calculées par le serveur. Le DTO d'écriture d'un taux accepte uniquement `code`, `label`, `rateBps`, `active`, `validFrom`, `validTo?` et `version` sur PATCH. Tout champ monétaire décimal/flottant, identifiant tenant ou champ inconnu renvoie `400 VALIDATION_ERROR`/`FIELD_NOT_ALLOWED` sans mutation partielle.

Réponse de complétude canonique :

```json
{
  "companyId": "company_opaque",
  "status": "draft",
  "currentStage": "sitesServices",
  "stages": [
    { "code": "identity", "state": "complete", "missingFields": [] },
    { "code": "sitesServices", "state": "incomplete", "missingFields": ["sites", "serviceOfferings.pad"] },
    { "code": "members", "state": "locked", "missingFields": [] }
  ],
  "nextAction": { "route": "/organization/sites", "label": "Créer le premier site" },
  "version": 3
}
```

Pour O1, `missingFields` emploie les chemins stables `fiscalProfile.taxCountry`, `fiscalProfile.currency`, `fiscalProfile.vatStatus`, `fiscalProfile.taxIdentifiers.<type>`, `fiscalProfile.defaultVatRateId` et `fiscalProfile.validation` afin que l'interface ouvre directement la correction attendue.

Les routes existantes des modules aval doivent appeler le service de préconditions partagé et retourner `PREREQUISITE_NOT_MET`; elles ne recopient pas les règles de complétude.

## 8. Isolation, sécurité et audit

- l'identité authentifiée détermine les affectations visibles ; le contexte de session opaque détermine le `companyId` actif ;
- toutes les lectures, recherches, agrégats, doublons, écritures, audits et événements sont filtrés par `companyId` avant tout filtre client ;
- un identifiant deviné hors tenant retourne le même `404 NOT_FOUND` qu'un identifiant inexistant ;
- les périmètres site/service sont vérifiés sur chaque cas d'usage et sur chaque relation indirecte ;
- CSRF et contrôle strict d'origine sont obligatoires sur toute mutation ; sessions `HttpOnly`, `SameSite=Lax`, `Secure` hors localhost ;
- logo : formats image autorisés, taille bornée, nom généré, contenu contrôlé, stockage local non exécutable ; aucun SVG actif ni URL distante dans ce lot ;
- texte libre échappé à l'affichage ; aucune donnée libre dans les logs ou événements ;
- limitation de débit sur création d'organisation, invitation et changement de contexte ;
- le catalogue de permissions est fermé et validé serveur ; aucun rôle ne peut créer une permission arbitraire.

Actions auditées : création, modification, validation juridique/fiscale et version de policy, migration du profil fiscal, changement de devise ou taux par défaut, création/modification/désactivation d'un taux, décision `nonApplicable`, validation de gate, activation, suspension, archivage, changement de contexte sensible, adresse/contact principal, site/unité/prestation, choix d'un `replacementSiteId`, invitation/suspension de membre, rôle et périmètre. Les actions fiscales sont `company.fiscalProfile.migrated`, `company.fiscalProfile.updated`, `company.defaultVatRate.changed`, `vatRate.created`, `vatRate.updated`. Chaque audit conserve `companyId`, acteur, action, type/id, instant, `requestId` ou `migrationId`, versions avant/après, `fiscalProfileVersion` avant/après le cas échéant et delta structuré borné. Les identifiants fiscaux sont masqués dans les deltas ; aucun mot de passe, cookie, jeton, motif libre complet ou fichier n'est journalisé.

Événements d'invalidation après commit : `organization.updated.v1`, `organization.stageValidated.v1`, `company.fiscalProfile.updated.v1`, `company.defaultVatRate.changed.v1`, `vatRate.created.v1`, `vatRate.updated.v1`, `site.updated.v1`, `organizationUnit.updated.v1`, `serviceOffering.updated.v1`, `membership.updated.v1`. L'enveloppe ne contient que `companyId`, entité/id, versions et instant ; elle n'embarque ni identifiant fiscal, ni montant, ni taux faisant autorité. Chaque client SSE est revalidé contre le contexte et les scopes courants puis recharge la représentation autorisée.

## 9. Migrations RC1 coordonnées, compatibilité et rollback

Après le schéma Stock v2, la chaîne canonique est unique et strictement ordonnée :

| Ordre | Identifiant immuable | Version | Owner / writer unique | Handoff obligatoire |
|---:|---|---|---|---|
| 01 | `foundation-01-organization-v2-to-v3` | v2 → v3 | **ORG-01 / Backend Core** | `companyId`, organisations, sites, unités, scopes, digest et comptages validés |
| 01b | `foundation-01b-organization-fiscal-v3` | schéma v3 → v3 | **ORG-01 Fiscal / Backend Core** | marqueur fiscal, profils/taux/policies, port fiscal, digest et comptages validés ; `schemaVersion` reste `3` |
| 02 | `foundation-02-resources-v3-to-v4` | v3 → v4 | **RES-02 / Backend Resources** | ressources et salles canoniques, relations site/unité, digest et comptages validés |
| 03 | `foundation-04-projects-v4-to-v5` | v4 → v5 | **PROJ-04 / Backend Projects** | Clients/Projets owner 04, readiness, reprise RC1 conforme au canon Lead pour chaque `companyId`, digest et comptages validés |
| 04 | `foundation-03-planning-v5-to-v6` | v5 → v6 | **PLAN-03 / Backend Planning** | aucune réservation active sans projet, séries/cellules/allocations, compatibilité et comptages validés |

Une seule étape écrit le fichier à la fois. Chaque writer exige la version et l'identifiant précédents, vérifie le digest et les totaux d'entrée, crée une sauvegarde immuable, écrit atomiquement, inscrit son identifiant une seule fois dans `migrations[]`, puis publie digest, totaux et anomalies de sortie. RES-02 exige à la fois `schemaVersion=3`, `foundation-01-organization-v2-to-v3` et `foundation-01b-organization-fiscal-v3`. Une version inattendue, un marqueur absent/désordonné, un digest incohérent ou une référence orpheline bloque le writer suivant.

`docs/architecture-roadmap.md` ne contient pas encore le marqueur 01b. Cette divergence doit être corrigée par l'owner Architecture avant intégration, sans renommer ni réinterpréter les quatre identifiants `foundation-*` historiques. La présente SPEC n'autorise aucune modification de ce document hors de son ownership.

### 9.1 Transformation ORG-01 v2 → v3

Cette migration est déjà publiée/exécutée et son contenu est immuable. Elle reste exactement le handoff Organisation v3 antérieur à l'extension fiscale : identité, `companyId`, sites, unités, prestations, affectations, scopes, policies légales et onboarding. Elle ne crée ni profil fiscal enrichi, ni `vatRates`, ni port Devis. Aucun writer ne la rejoue, ne change son digest, n'ajoute une étape ou ne réutilise son identifiant pour livrer la fiscalité.

Le mode compatibilité autorise la lecture de l'historique d'une organisation migrée incomplète mais bloque toute nouvelle donnée métier aval jusqu'à régularisation.

### 9.2 Extension fiscale additive `foundation-01b-organization-fiscal-v3`

Préconditions : `schemaVersion=3`; marqueur/digest conforme de `foundation-01-organization-v2-to-v3`; absence de 01b et de tout marqueur RES-02/aval ; writer applicatif arrêté ; fichier v3 validé ; sauvegarde v3 horodatée, immuable et hors racine statique.

La mutation atomique :

1. ajoute les champs fiscaux aux `companies`, la collection `vatRates` et le catalogue local versionné des policies fiscales/ISO 4217 sans modifier les identifiants ni collections existants ;
2. initialise `fiscalProfileVersion=1` et convertit les anciens `registrationNumber`, `establishmentNumber`, `vatNumber` uniquement s'ils passent la policy ; toute valeur rejetée est comptée dans le rapport, jamais copiée comme DTO canonique ;
3. pour le seed français déterministe uniquement, crée idempotemment le taux proposé `STANDARD` à `rateBps=2000`; pour une autre donnée legacy, crée une proposition seulement si une règle pays déterministe existe, sinon consigne `VAT_RATE_REQUIRED` ;
4. laisse `fiscalValidatedAt` absent jusqu'à confirmation humaine et recalcule O1 sans activer silencieusement une organisation incomplète ;
5. valide isolation/références, ajoute pour chaque profil effectivement converti l'audit masqué `company.fiscalProfile.migrated` avec `migrationId="foundation-01b-organization-fiscal-v3"`, puis écrit le marqueur littéral, digest source/sortie, versions de policy et comptages profils/identifiants/taux/rejets ;
6. conserve strictement `schemaVersion=3`, écrit atomiquement puis publie le handoff fiscal et `CompanyFiscalProfilePort.v1`.

Idempotence : marqueur absent + préconditions conformes exécute une fois ; marqueur présent + digest/policies/comptages conformes retourne sans écriture, audit ni événement dupliqué ; marqueur présent avec contenu divergent arrête la migration. Le migrateur hors ligne n'émet pas de SSE ; le redémarrage recharge l'état v3 marqué. Le marqueur 01b est une précondition obligatoire de RES-02, pas une nouvelle version de schéma.

### 9.3 Politique unique de reprise des réservations sans projet

La règle normative est définie par `docs/target-architecture-v1.md` (reprise RC1), `docs/architecture-roadmap.md` et le contrat owner PROJ-04 dans `docs/spec-project-planning-sequence.md`. `foundation-04-projects-v4-to-v5` fournit, selon ces références exactes, le Client technique de code réservé `MIGRATION-RC1` pour chaque `companyId` concerné et le Projet technique de code réservé `MIGRATION-RC1-<siteId>` pour chaque couple `companyId`/`siteId` concerné. Organisation 01 ne redéfinit aucun DTO, état, route ou permission de ces entités.

`foundation-03-planning-v5-to-v6` effectue les rattachements puis refuse son handoff si une réservation reste sans `projectId`. Chaque création/rattachement écrit les audits canoniques `client.recovery.created`, `project.recovery.created`, `reservation.project.backfilled` et publie après commit les événements `client.recovery.created.v1`, `project.recovery.created.v1`, `reservation.project.backfilled.v1`, avec les enveloppes et détails exacts référencés dans l'architecture. Aucun état alternatif de réservation non affectée n'est admis.

### 9.4 Rollback

Chaque étape revient uniquement à son état immédiatement précédent et seulement en l'absence d'écriture utilisateur postérieure. Le rollback complet s'exécute dans l'ordre v6 → v5 → v4 → v3 après RES-02, puis rollback du marqueur 01b en restaurant sa sauvegarde v3, puis v3 → v2 pour la fondation 01 historique. Le rollback 01b exige l'absence de marqueur RES-02/aval et vérifie digest, `fiscalProfileVersion`, références à `vatRates` et absence de document consommateur ; il retire la fiscalité uniquement par restauration du snapshot v3, sans modifier `schemaVersion`. Une écriture post-migration interdit la restauration aveugle ; elle exige une conversion inverse validée ou l'autorisation explicite du Product Owner pour toute perte précisément identifiée.

## 10. Seed déterministe

Le seed de démonstration ne contient aucune donnée réelle et crée au minimum :

- `Eliote Props Prod` : activités post-production et laboratoire, deux sites, services Montage/Étalonnage/Mixage/PAD/Laboratoire, prestations correspondantes ;
- `Eliote Location` : activité location, un site, service Parc & Location ;
- `FAV Location` : activité location et services, un site, services Location et Support technique ;
- pour chacune de ces fixtures françaises : `taxCountry="FR"`, `currency="EUR"`, identifiants SIREN/SIRET/TVA explicitement fictifs mais conformes aux bornes `FR@1`, `vatStatus="registered"`, taux `STANDARD` à `2000` points de base sélectionné par défaut et au moins un taux alternatif actif démontrant que 20 % n'est pas figé ;
- un profil isolé non français sous `GENERIC@1`, avec `taxCountry`, devise, identifiant et taux explicitement configurés, afin de tester qu'aucune valeur FR n'est injectée hors de son territoire ;
- un administrateur multi-organisations avec une affectation distincte et un contexte explicite ;
- un responsable borné à un seul site, un planificateur et un lecteur ;
- un second tenant totalement inaccessible aux comptes utilisés dans les tests négatifs ;
- les identités légales de démonstration utilisent des numéros réservés aux fixtures et clairement marqués non réels.

Le seed est répétable : une seconde exécution ne duplique aucune organisation, affectation, adresse, unité, taux ou rôle. Les identifiants fiscaux de fixture sont marqués non réels et ne sont jamais présentés comme vérifiés auprès d'une administration. Les 120 salles de post-production seront seedées dans le lot Ressources, après validation d'Organisation 01 ; elles ne sont pas artificiellement créées par ce module.

## 11. Critères d'acceptation

### Organisation et onboarding

- [ ] Un administrateur plateforme crée successivement Eliote Props Prod, Eliote Location et FAV Location avec identités et activités distinctes.
- [ ] Une organisation incomplète reste en brouillon ; la réponse de complétude désigne précisément les champs manquants.
- [ ] O1 ne passe qu'avec identité, siège, contact, activités, `primaryActivity` et paramètres requis ; l'absence de `tradeName` ne bloque jamais ; aucune écriture partielle n'est produite en cas d'échec.
- [ ] La policy juridique pays et sa version sont persistées ; une nouvelle version exige une revalidation explicite et ne modifie pas silencieusement le statut existant.
- [ ] O1 exige `taxCountry`, `currency`, `vatStatus`, identifiants requis par la policy, taux par défaut actif/applicable et validation fiscale explicite ; une proposition migrée non confirmée reste incomplète.
- [ ] Sous `FR@1`, SIREN/SIRET et TVA conditionnelle sont validés structurellement ; un profil non-FR suit sa policy sans recevoir automatiquement un taux français.
- [ ] Le taux français proposé à `2000` points de base est sélectionnable puis remplaçable ; `20`, `0.20` ou tout flottant envoyé comme taux est refusé.
- [ ] Le parcours UX suit les cinq sous-étapes O1, affiche les exigences conditionnelles et consomme les chemins fiscaux de `missingFields`; `docs/ux-flows.md` est aligné par son owner avant DEV frontend.
- [ ] O2 ne passe qu'avec site, unité et prestations compatibles ; les exigences post-production/laboratoire sont vérifiées.
- [ ] Chaque `nonApplicable` possède un motif borné et audité ; repasser l'exigence à `enabled` invalide O2 jusqu'à création de la prestation.
- [ ] O3 et l'activation refusent l'absence d'administrateur ou de couverture des sites.
- [ ] Revalider un gate déjà valide est idempotent et ne produit pas de doublon.
- [ ] Suspendre ou archiver respecte les transitions, bloque les nouvelles mutations métier et conserve toutes les données.

### Structure et gouvernance

- [ ] Sites, services et prestations sont filtrés par `companyId` et leurs relations cross-tenant sont refusées.
- [ ] Désactiver un site portant des ressources exige un `replacementSiteId` explicite, actif et du même tenant ; aucun remplacement automatique n'est effectué.
- [ ] Une arborescence de services cyclique ou profonde de plus de quatre niveaux est refusée.
- [ ] Le dernier administrateur actif ne peut pas être suspendu ni privé de son rôle.
- [ ] Un membre borné à un site ne peut ni lire ni modifier les données détaillées d'un autre site.
- [ ] Un utilisateur affecté à plusieurs organisations change de contexte sans mélanger caches, URL, SSE ou résultats.

### Fiscalité et fondation Devis

- [ ] Seul un titulaire de `fiscalProfile.manage` modifie le profil et seul `vatRate.manage` crée/modifie un taux ; `organization.manage` seul est insuffisant.
- [ ] Une ancienne `version` ou `fiscalProfileVersion` est refusée sans écrasement ; chaque succès incrémente les versions, écrit l'audit fiscal exact et invalide après commit.
- [ ] Un taux porte code, libellé, points de base, état et période valides ; chevauchement du même code, taux hors `0..10000`, période vide ou relation hors `companyId` sont refusés atomiquement.
- [ ] Désactiver le taux courant par défaut est refusé sans remplacement atomique ; changer le défaut ne modifie aucun snapshot consommateur existant.
- [ ] Le contrat Devis hors scope impose au futur writer le snapshot fiscal immuable, `netHt`, `vatAmount`, `grossTtc` en unités mineures et `currency`; un taux explicite provient d'un `vatRateId` autorisé et exige `quote.overrideVatRate`.
- [ ] `CompanyFiscalProfilePort.v1` retourne exactement le snapshot défini, avec `taxDate`, fuseau serveur, exposant ISO 4217 et taux document unique ; Commercial 08 en est le consommateur/owner Devis et Finance 09a ne peut pas remplacer ce snapshot par une valorisation interne.
- [ ] Les tests de contrat couvrent exposants 0/2/3, demi-unité, sommes multi-lignes, valeur int64 maximale et chaque overflow ; JSON ne transporte aucun montant fiscal comme `Number`.

### Chaîne métier obligatoire

- [ ] Une organisation non active ne peut pas créer de ressource, client, projet ou réservation par l'API, même via un appel manuel.
- [ ] Sans site/service validé, la création de ressource est bloquée avec la prochaine action exploitable.
- [ ] Une salle sélectionne ses équipements parmi les exemplaires sérialisés du parc du même tenant/site ; une référence étrangère ou libre est refusée.
- [ ] Sans client et projet/émission validé, une réservation est impossible.
- [ ] Le contrat Client/Projet est consommé sans duplication depuis `docs/spec-project-planning-sequence.md`; ses champs, états, routes, permissions et règles de sites sont identiques dans tous les consommateurs.
- [ ] Toute nouvelle réservation exige un projet actif du même `companyId` et du même périmètre ; une émission utilise exclusivement `kind: "emission"`.
- [ ] Une réservation multi-jours/semaines/mois est projetée en cellules jour × salle et se déplace atomiquement vers une salle compatible.

### Sécurité, données et qualité

- [ ] Les identifiants devinés d'une autre organisation donnent une réponse non révélatrice sur toutes les routes directes et indirectes.
- [ ] Les permissions sont contrôlées serveur, la CSRF est exigée et une modification avec ancienne `version` renvoie `409 VERSION_CONFLICT`.
- [ ] Audit et SSE ne sont produits qu'après persistance atomique ; aucun contact ni identifiant légal sensible n'est exposé.
- [ ] La chaîne `foundation-01-organization-v2-to-v3` → `foundation-01b-organization-fiscal-v3` → `foundation-02-resources-v3-to-v4` → `foundation-04-projects-v4-to-v5` → `foundation-03-planning-v5-to-v6` conserve identifiants/totaux, crée une sauvegarde à chaque étape et est idempotente ; 01b laisse `schemaVersion=3`.
- [ ] Le digest de `foundation-01-organization-v2-to-v3` reste inchangé ; RES-02 refuse de démarrer sans marqueur 01b ; rejeu 01b ne duplique ni taux ni audit et son rollback restaure le snapshot v3 en l'absence de consommateur aval.
- [ ] PROJ-04 fournit `MIGRATION-RC1` et `MIGRATION-RC1-<siteId>` selon les DTO normatifs référencés ; PLAN-03 rattache toutes les réservations et la chaîne produit exactement les audits `client.recovery.created`, `project.recovery.created`, `reservation.project.backfilled` puis les événements après commit `client.recovery.created.v1`, `project.recovery.created.v1`, `reservation.project.backfilled.v1`.
- [ ] Le seed peut être rejoué sans duplication et les tests couvrent au moins deux tenants, deux sites et un membre à portée réduite.

## 12. Scénarios E2E obligatoires

1. **Création Eliote Props Prod** : saisir identité juridique, siège, contact, activités post-production/laboratoire, fuseau, profil fiscal FR, devise EUR et taux par défaut ; valider O1 ; recharger et vérifier la persistance.
2. **Structure post-production** : créer un site et les services Montage, Étalonnage, Mixage, PAD, Laboratoire ; créer les prestations ; valider O2 et vérifier les motifs précis d'un essai incomplet.
3. **Gouvernance et activation** : affecter un administrateur et un responsable de site, valider O3, activer puis vérifier l'accès au module Ressources.
4. **Multi-organisations** : créer Eliote Location et FAV Location, changer de contexte, vérifier que navigation, recherches, listes et SSE n'affichent que le tenant actif.
5. **Isolation hostile** : avec un compte Eliote Location, appeler directement les identifiants d'Eliote Props Prod pour organisation, site, service, membre et relations ; obtenir des refus non révélateurs et aucun audit dans le mauvais tenant.
6. **Ordre métier** : tenter ressource, projet puis réservation avant leurs gates ; vérifier les blocages UI/API ; compléter chaque prérequis et constater le déblocage dans l'ordre.
7. **Contrat salle/parc** : dans une organisation active, créer une salle de montage puis affecter un équipement sérialisé canonique du même site ; refuser un numéro saisi librement et un équipement d'un autre site/tenant.
8. **Projet obligatoire et planning long** : créer client puis projet Émission avec référence, réserver une salle sur plusieurs semaines, déplacer l'allocation vers une salle compatible et vérifier persistance/rechargement.
9. **Concurrence** : modifier l'identité dans deux sessions ; la seconde écriture avec version périmée échoue sans perte, puis se recharge correctement.
10. **Migration** : démarrer sur une copie Stock v2 déterministe, exécuter strictement `foundation-01-organization-v2-to-v3` → `foundation-01b-organization-fiscal-v3` sans changer `schemaVersion=3` → `foundation-02-resources-v3-to-v4` → `foundation-04-projects-v4-to-v5` → `foundation-03-planning-v5-to-v6`, vérifier fiscalité, Client `MIGRATION-RC1`, Projets `MIGRATION-RC1-<siteId>`, audits/événements et rattachements, puis redémarrer et contrôler digests/comptages.
11. **Profil fiscal et concurrence** : créer un taux alternatif futur en points de base, le sélectionner par défaut avec versions courantes, provoquer une mise à jour concurrente, vérifier le refus de la version obsolète puis contrôler audit, SSE et persistance après redémarrage.
12. **Territoire et isolation fiscale** : configurer un profil non-FR avec sa devise/policy/taux explicites, vérifier l'absence de défaut FR, puis tenter de lire ou sélectionner un taux d'un autre `companyId` et obtenir une réponse non révélatrice sans mutation.

Chaque scénario est exécuté par l'interface lorsque le comportement est visible, complété par des contrôles API négatifs, et vérifié après rechargement/redémarrage pour les mutations persistées.

## 13. Exigences de tests et performance

- domaine : normalisation, policies/identifiants fiscaux multi-territoires, points de base, périodes de taux, arrondi monétaire du contrat Devis, transitions, complétude, arborescence, activités et préconditions ;
- API : validation bornée, pagination, idempotence, version, erreurs stables, RBAC et scopes ;
- isolation : matrice tenant × site × service sur listes, lectures directes, relations, recherche, audit et SSE ;
- migration : Stock v2 vierge et peuplé, fondation 01 historique inchangée, marqueur 01b sur schéma v3, profil fiscal legacy complet/incomplet, proposition FR et territoire générique, rejeu sans taux/audit dupliqué, refus RES-02 sans 01b, interruption avant renommage, digest invalide, Projet de reprise et rollback inverse ;
- intégration : activation atomique, dernier administrateur, changement de contexte et invalidations après commit ;
- UI : stepper séquentiel, erreurs reliées aux champs, reprise d'un brouillon, accès direct bloqué, clavier et focus ;
- performance : au moins 20 organisations visibles pour l'administrateur plateforme, 20 sites, 100 services, 1 000 membres ; listes API p95 < 300 ms et changement de contexte exploitable < 2 s sur la machine de référence ; le test des 120 salles appartient au lot Ressources.

## 14. Ownership, writers et handoffs obligatoires

Un seul writer intervient sur la persistance à un instant donné. La chaîne de handoff est exactement **ORG-01 historique → ORG-01b fiscal → RES-02 → PROJ-04 → PLAN-03**, identique à la section 9 :

1. **ORG-01 / Backend Core, v2→v3 — historique immuable** : owner du handoff Organisation déjà publié. Sortie inchangée : contrat `companyId`, identité/sites/unités/scopes, digest/comptages v3 et sauvegarde ; aucun champ fiscal nouveau.
2. **ORG-01b Fiscal / Backend Core, marqueur sur v3** : owner du profil fiscal/monétaire, `vatRates`, policies fiscales/ISO 4217 et `CompanyFiscalProfilePort.v1`. Sortie : marqueur/digest/comptages 01b avec `schemaVersion=3`, tests migration/isolation, sauvegarde et deux handoffs : précondition technique vers RES-02, contrat fiscal vers Commercial 08.
3. **RES-02 / Backend Resources, v3→v4** : exige le marqueur 01b ; owner des ressources, salles, catégories et relations site/`organizationUnitId`/parc. Sortie : catalogue Ressources versionné, digest/comptages v4 et preuve 120 salles.
4. **PROJ-04 / Backend Projects, v4→v5** : owner unique des Clients/Projets selon `docs/spec-project-planning-sequence.md`. Sortie : contrats/ports owner 04, readiness, reprise canonique pour chaque `companyId`, rattachement des historiques, digest/comptages v5.
5. **PLAN-03 / Backend Planning, v5→v6** : owner des séries, cellules et allocations. Entrée bloquée si une réservation active n'a pas de Projet ; sortie : compatibilité RC, digest/comptages v6 et tests Planning.

Le frontend Organisation est un consommateur distinct, sans numéro de fondation et sans droit d'écriture sur la persistance. L'intégrateur est seul habilité à activer successivement les writers, vérifier les handoffs et rejouer les gates aval. L'ordre métier visible reste Organisation → Sites/Services → Ressources → Client/Projet → Planning.

## 15. Definition of Done du lot Organisation 01

Le lot n'est prêt à intégrer que si la présente SPEC est revue, le modèle et les routes sont implémentés sans migration de stack implicite, les tests ciblés et `npm test` sont verts, la migration et son rollback sont démontrés, les contrôles d'isolation sont approuvés indépendamment, les E2E 1 à 6 et 9 à 12 passent, aucun P0/P1 n'est ouvert et `docs/project-status.md` est mis à jour par l'intégrateur. Les scénarios 7 et 8 deviennent gates d'intégration des lots Ressources, Projets et Planning ; Organisation 01 en fournit les contrats bloquants.
