# UX Organisation 01 — administration multi-organisations

Statut : contrat UX prêt pour implémentation et revue indépendante

Version cible : `0.3.0-alpha.1`

Date : 2026-08-14

Owner : UX / Frontend Organisation 01

Références normatives : `docs/spec-organization-01.md`, `docs/design-system.md`, `docs/target-architecture-v1.md`

## 1. Objectif et principes de conception

Organisation 01 est la porte d'entrée obligatoire du produit. L'expérience doit permettre à un administrateur de créer et piloter un nombre extensible d'organisations — par exemple **Eliote Props Prod**, **Eliote Location** et **FAV Location** — sans mélanger leurs données, puis de compléter chaque fondation dans un ordre intelligible avant d'accéder aux ressources, projets et planning.

Le parcours visible est strictement :

```text
O1 Identité
  -> O2 Sites, unités et prestations
  -> O3 Membres et responsabilités
  -> Activation
  -> Ressources
  -> Clients et projets/émissions
  -> Planning
```

Principes non négociables :

1. **Le serveur fait autorité.** Le client affiche `status`, `currentStage`, `stages`, `missingFields`, `nextAction` et `version` reçus de l'API ; il ne calcule jamais seul la complétude.
2. **Une étape suivante n'est jamais accessible trop tôt.** Son contrôle reste visible mais verrouillé, accompagné de la cause et d'une action vers le premier prérequis manquant.
3. **Une organisation reste toujours identifiable.** Nom, code, statut et contexte actif sont présents dans l'en-tête ; le libellé métier est « organisation », jamais « tenant » ou `companyId`.
4. **Une saisie longue reste maîtrisable.** Sauvegarde explicite par section, brouillon conservé, résumé des erreurs et reprise au dernier point valide.
5. **Les concepts proches sont distingués.** « Unité interne » décrit l'équipe qui travaille ; « prestation proposée » décrit ce que l'organisation vend ou délivre.
6. **Les statuts ne reposent pas sur la couleur.** Chaque état combine libellé, icône et traitement visuel conforme au design system.
7. **Aucun changement de contexte implicite.** Changer d'organisation renouvelle le contexte serveur, vide les données affichées de l'ancien contexte, puis recharge les référentiels autorisés.

## 2. Architecture d'information

### 2.1 Entrées de navigation

- Le rail principal expose **Administration** uniquement avec une permission pertinente.
- Son entrée **Organisations** mène au tableau multi-organisations pour `organization.create` ou plusieurs affectations visibles.
- Pour un membre mono-organisation, l'entrée mène directement à **Paramètres de l'organisation**.
- Dans la barre supérieure, le sélecteur de contexte affiche toujours l'organisation active ; il devient un bouton de liste si plusieurs affectations actives sont disponibles.
- Les modules aval verrouillés restent visibles dans le rail avec une icône cadenas, un libellé accessible et l'explication du gate manquant au focus ou à l'activation.

### 2.2 Routes frontend recommandées

| Route | Vue | Condition |
|---|---|---|
| `/administration/organizations` | tableau des organisations visibles | plusieurs organisations ou `organization.create` |
| `/administration/organizations/new` | création initiale | `organization.create` |
| `/organization/overview` | synthèse de l'organisation active | `organization.read` |
| `/organization/onboarding/identity` | étape O1 | `organization.manage`, sinon lecture |
| `/organization/fiscal-profile` | profil fiscal et aperçu des données publiées | `fiscalProfile.read` |
| `/organization/vat-rates` | catalogue des taux configurés | `vatRate.read` |
| `/organization/onboarding/structure` | étape O2 | O1 validée et droits structure |
| `/organization/onboarding/governance` | étape O3 | O2 validée et droits membres/rôles |
| `/organization/sites` | gestion détaillée des sites | organisation active ou O2 en cours |
| `/organization/units` | unités internes | organisation active ou O2 en cours |
| `/organization/offerings` | prestations proposées | organisation active ou O2 en cours |
| `/organization/members` | membres, rôles et périmètres | O2 validée |

Une URL directe vers une étape verrouillée rend la page demandée avec un panneau explicatif ; elle ne redirige ni en boucle ni vers un écran vide. Une URL hors permission affiche un refus non révélateur sans confirmer l'existence d'une autre organisation.

## 3. Tableau multi-organisations

### 3.1 En-tête et commandes

Titre : **Organisations**. Sous-titre : « Gérez les entités juridiques et opérationnelles accessibles à votre compte. »

Actions :

- action primaire **Créer une organisation**, visible uniquement avec `organization.create` ;
- recherche par raison sociale, nom commercial ou code ;
- filtres `Statut`, `Activité principale` et `Étape de configuration` ;
- tri initial `Nom`, puis code ; colonnes triables annoncées via `aria-sort` ;
- pagination serveur et total visible ; aucun plafond UX au nombre d'organisations.

### 3.2 Colonnes

| Colonne | Contenu |
|---|---|
| Organisation | raison sociale, nom commercial si présent, code |
| Activité principale | libellé métier, autres activités résumées par `+N` |
| Structure | nombre de sites actifs et d'unités actives |
| Configuration | `O1`, `O2`, `O3` ou `Prête`, avec progression textuelle |
| Statut | `Brouillon`, `Active`, `Suspendue`, `Archivée` |
| Dernière mise à jour | date localisée et auteur si autorisé |
| Actions | `Ouvrir`, `Changer de contexte`, menu selon permissions |

La ligne active porte le libellé **Contexte actuel**, pas une simple surbrillance. `Eliote Props Prod`, `Eliote Location` et `FAV Location` doivent rester lisibles sans troncature à 1440 px ; le nom complet est disponible au focus si l'espace est réduit.

### 3.3 États

- Chargement supérieur à 300 ms : skeleton fidèle à six lignes, entête conservé.
- Vide administrateur plateforme : « Aucune organisation n'a encore été créée » + **Créer la première organisation**.
- Aucun résultat de recherche : rappeler les filtres et proposer **Réinitialiser les filtres**.
- Erreur partielle : conserver les commandes et afficher **Réessayer** dans la zone du tableau.
- Lecture seule : aucune action de mutation, mais progression et prochaine étape restent lisibles.

### 3.4 Changement de contexte

Le menu de contexte recherche les organisations à partir de huit entrées et affiche nom, code, statut et portée principale. Les organisations suspendues ou archivées accessibles en lecture sont identifiées comme telles.

Séquence :

1. l'utilisateur choisit une affectation active ;
2. si un formulaire est modifié, dialogue **Changer d'organisation ?** avec `Continuer l'édition` et `Ignorer et changer` ;
3. l'interface affiche `Changement en cours…`, bloque les mutations concurrentes et appelle le changement de contexte ;
4. après succès, elle purge listes, recherches, caches locaux et abonnement SSE liés à l'ancien contexte ;
5. elle recharge l'accueil de la nouvelle organisation et annonce « Contexte changé : Eliote Location » ;
6. après échec, l'ancien contexte reste intégralement actif et le focus revient à l'option choisie.

Aucune donnée de l'ancien contexte ne reste visible pendant le chargement du nouveau. Le client ne mémorise jamais un `companyId` comme autorité durable.

## 4. Création et cadre commun de l'onboarding

### 4.1 Création initiale

**Créer une organisation** ouvre une page dédiée, pas une petite modale. Le premier écran demande seulement : raison sociale, code interne, pays d'immatriculation et activité principale. La soumission crée le brouillon puis ouvre O1 avec les valeurs conservées. Le bouton porte **Créer le brouillon et continuer**.

L'en-tête de l'assistant affiche :

- breadcrumb `Organisations / Nouvelle organisation` puis le nom dès création ;
- raison sociale et code ;
- badge `Brouillon`, `Active`, `Suspendue` ou `Archivée` ;
- texte `Étape 1 sur 3` ;
- action secondaire **Quitter et reprendre plus tard**.

### 4.2 Stepper serveur

Le stepper horizontal desktop et vertical mobile possède quatre repères :

1. **Identité** — O1 ;
2. **Sites et services** — O2 ;
3. **Membres et accès** — O3 ;
4. **Activation** — synthèse finale.

États possibles :

- `En cours` : étape courante, `aria-current="step"` ;
- `Terminée` : accessible en lecture/édition selon permission ;
- `À compléter` : étape autorisée mais incomplète ;
- `Verrouillée` : non interactive tant que le serveur ne la débloque pas ;
- `À revalider` : une modification amont a invalidé un gate précédemment terminé.

Une étape terminée peut être revisitée. Une modification susceptible d'invalider l'aval affiche avant sauvegarde : « Cette modification nécessitera de revalider Sites et services. » L'état réel n'est mis à jour qu'après la réponse serveur.

### 4.3 Structure d'une page d'étape

- Colonne principale `minmax(0, 760px)` : sections de formulaire.
- Colonne latérale desktop `280px` sticky : **État de l'étape**, exigences, éléments manquants et prochaine action.
- Pied sticky : **Enregistrer le brouillon** à gauche ; action primaire **Valider l'étape O…** à droite.
- Le bouton de validation est disponible à l'utilisateur autorisé même si la complétude affichée est imparfaite : sa soumission laisse le serveur confirmer et permet de restituer les erreurs exactes. Il n'est désactivé que pendant une requête, en lecture seule ou si l'étape est verrouillée.
- Une validation réussie affiche le statut `Terminée`, annonce le succès, puis propose **Continuer vers…** ; aucun passage automatique ne fait perdre le contexte.

## 5. O1 — Identité légale et opérationnelle

### 5.1 Séquence fermée en cinq sous-étapes

O1 contient un stepper interne distinct du stepper O1–O3. Son ordre normatif est exactement :

```text
1. Identité légale
  -> 2. Territoire et statut fiscal
  -> 3. Identifiants structurés
  -> 4. Devise et taux par défaut
  -> 5. Validation
```

Une seule sous-étape est modifiable à la fois. La suivante reste visible avec le statut **Verrouillée** et la raison « Validez d'abord … ». **Continuer** soumet les données de la sous-étape au serveur ; elle ne devient **Terminée** et ne déverrouille la suivante qu'après réponse de validation réussie. Une erreur conserve la sous-étape active, place le focus sur son résumé et ne permet aucun accès direct à la suite. Revenir sur une sous-étape terminée est permis ; une modification la repasse **À valider** et reverrouille toutes les suivantes jusqu'à une nouvelle validation serveur. Le navigateur ne déduit jamais ce statut de la seule présence des champs.

#### Sous-étape 1 — Identité légale

| Champ UI | Contrat | Requis pour O1 |
|---|---|---:|
| Raison sociale | `legalName` | oui |
| Nom commercial | `tradeName` | non |
| Code interne | `code` | oui |
| Forme juridique | `legalForm` | oui |
| Pays d'immatriculation | `registrationCountry` | oui |

Cette première sous-étape contient également les éléments non fiscaux nécessaires à l'identité complète : activités et activité principale, description, fuseau IANA, locale BCP 47, pays par défaut, siège social principal et contact principal. Le siège saisit libellé, ligne 1, complément, code postal, ville, région et pays ; son type est fixé à `registeredOffice` et il est principal. Le contact principal saisit type, nom, fonction, email et téléphone, avec au moins un email ou téléphone. Site web et logo restent facultatifs.

Choisir `Post-production` ou `Laboratoire` affiche : « Les prestations correspondantes seront précisées à l'étape 2. » Cela ne crée aucun service implicitement. Les anciens champs scalaires `registrationNumber`, `establishmentNumber` et `vatNumber` ne sont ni affichés ni envoyés. La politique juridique appliquée et sa version sont affichées en lecture seule, sans prétendre vérifier l'existence administrative de l'entité.

#### Sous-étape 2 — Territoire et statut fiscal

| Champ UI | Contrat | Requis pour O1 |
|---|---|---:|
| Territoire fiscal principal | `taxCountry` ISO 3166-1 alpha-2 | oui |
| Statut TVA | `vatStatus` | oui |

Les libellés correspondent exactement au contrat : **Assujettie** = `registered`, **Exonérée** = `exempt`, **Non applicable** = `notApplicable`. L'interface envoie la valeur canonique, jamais le libellé traduit. Le territoire fiscal est distinct du pays d'immatriculation ; lorsqu'ils diffèrent, les deux valeurs sont confirmées sans être présentées comme une erreur.

La validation réussie charge la policy fiscale versionnée qui fait autorité pour la sous-étape 3. Modifier ensuite `taxCountry` ou `vatStatus` invalide immédiatement les identifiants et le taux sélectionné, puis reverrouille les sous-étapes 3 à 5. Aucune valeur de l'ancien territoire n'est conservée silencieusement comme valide.

#### Sous-étape 3 — Identifiants structurés

Tous les numéros légaux et fiscaux sont saisis dans `taxIdentifiers[]`, jamais dans une chaîne libre agrégée. Chaque groupe contient **Type**, **Pays**, **Valeur** et **Libellé facultatif** ; la version de policy, attribuée par le serveur et jamais éditable, est affichée après validation. Les types conservent leurs valeurs canoniques : immatriculation (`businessRegistration`), établissement (`establishment`), TVA (`vat`), numéro fiscal (`taxNumber`), autre (`other`). **Ajouter un identifiant** ajoute un groupe ; **Retirer** annonce le type et le suffixe masqué avant suppression. Les valeurs sensibles ne sont placées ni dans l'URL, ni dans les logs client, ni dans les annonces live.

Pour `FR@1`, l'interface présente : **SIREN — 9 chiffres**, **SIRET du siège — 14 chiffres commençant par le SIREN**, et **TVA intracommunautaire**. SIREN et SIRET sont requis. La TVA est requise uniquement avec **Assujettie**. Avec **Exonérée** ou **Non applicable**, aucun faux numéro TVA n'est créé. Pour un territoire générique, l'aide précise que la validation est structurelle et qu'une confirmation humaine reste nécessaire.

La sous-étape 4 reste verrouillée tant que le serveur n'a pas accepté l'ensemble d'identifiants exigé par la policy courante.

#### Sous-étape 4 — Devise et taux par défaut

| Champ UI | Contrat | Requis pour O1 |
|---|---|---:|
| Devise de référence | `currency` ISO 4217 | oui |
| Taux de TVA par défaut | `defaultVatRateId` parmi les taux actifs/applicables du tenant | oui |
| Capital social | `shareCapital`, exprimé dans la devise sélectionnée | non |

La devise est donc choisie seulement après validation des identifiants. Le sélecteur de taux affiche code, libellé, pourcentage localisé et période. Pour la France, `20,00 %` (`rateBps=2000`) est proposé avec « Proposition modifiable » ; ce n'est jamais une constante légale. L'administrateur peut sélectionner un autre taux actif/applicable ou ouvrir **Gérer les taux** avec `vatRate.manage`. Avec **Exonérée** ou **Non applicable**, un taux explicite reste requis et peut être à 0 %. Le formulaire envoie exclusivement `defaultVatRateId`, jamais un pourcentage comme seconde autorité.

Changer le territoire après cette validation réexamine atomiquement identifiants, statut TVA, devise et taux, puis renvoie l'utilisateur à la première sous-étape devenue invalide.

#### Sous-étape 5 — Validation

La dernière sous-étape est une synthèse en lecture avant confirmation : identité légale, siège principal, contact, activités, territoire/statut fiscal, identifiants masqués, devise, taux et versions de policy. Chaque bloc comporte **Modifier** vers sa sous-étape. **Valider O1** appelle la complétude serveur ; seul un succès fait passer O1 à `Terminée` et déverrouille O2. Si le serveur renvoie des `missingFields`, la première sous-étape concernée se rouvre, les suivantes sont verrouillées et le focus rejoint l'erreur exacte.

### 5.2 Catalogue des taux de TVA

**Gérer les taux** ouvre une sous-vue conservant le contexte O1 et son brouillon. La liste est filtrée exclusivement par l'organisation active et affiche : code, libellé, taux en pourcentage localisé, période `[Début, Fin)`, état, badge **Par défaut** et version. Les filtres sont `Actif` et `Applicable le`, avec pagination serveur. Un résultat d'un autre tenant n'est jamais proposé, même si son identifiant est connu.

Le drawer **Ajouter un taux** ou **Créer une nouvelle période** contient :

- code et libellé ;
- taux affiché comme pourcentage avec deux décimales au maximum, converti exactement en `rateBps` entier sans calcul flottant ; l'aide donne l'équivalence « 20,00 % = 2 000 points de base » ;
- date civile de début requise et date de fin facultative, avec rappel que la fin est exclue ;
- état actif.

Un taux en dehors de `0,00 %` à `100,00 %`, une fraction non représentable en point de base, une période vide ou le chevauchement du même code produit une erreur au champ. Modifier le taux ou les bornes d'une ligne déjà référencée n'est pas proposé : l'action devient **Créer une nouvelle période**. Désactiver le taux par défaut ouvre un dialogue bloquant qui impose de sélectionner un remplacement actif/applicable dans la même mutation ; aucun remplacement n'est présélectionné arbitrairement. Un taux futur peut être créé sans devenir immédiatement le défaut.

Les actions d'édition exigent `vatRate.manage`; `vatRate.read` seul rend la liste et les détails en lecture seule. `organization.manage` ne déverrouille jamais implicitement ces commandes. Chaque succès recharge les versions serveur et annonce sobrement `Taux créé` ou `Taux mis à jour`, sans énoncer d'identifiant fiscal.

### 5.3 Aperçu fiscal publié pour un futur Devis

Un panneau repliable **Aperçu des informations qui seront figées sur un futur devis** est disponible avec `fiscalProfile.read`. Il ne crée aucun devis et ne calcule aucun montant. Il présente en lecture seule, sous forme de liste de définition : raison sociale, adresse `registeredOffice` principale validée exclusivement, territoire fiscal, identifiants nécessaires masqués selon permission, devise et taux par défaut actuellement applicable, ainsi que la version du profil fiscal. Une adresse de facturation, opérationnelle ou secondaire n'est jamais substituée à ce siège principal.

L'encart explique : « Un futur devis conservera une copie de ces informations au moment de sa création. Une modification ultérieure du profil ne réécrira pas ce document. » Une donnée manquante apparaît comme **À compléter pour O1**, jamais sous forme de valeur inventée. L'aperçu n'offre ni saisie de ligne, ni montant HT/TVA/TTC, ni override de taux ; ces commandes appartiendront au lot Devis et seront contrôlées par `quote.overrideVatRate`.

### 5.4 Validation, versions et erreurs

- La sauvegarde de l'identité générale exige `organization.manage`; celle du profil fiscal exige `fiscalProfile.manage`; la validation complète O1 n'est proposée qu'à un acteur réunissant ces capacités. Sinon, l'état indique **Validation fiscale requise par un administrateur autorisé** sans exposer de commande inefficace.
- Validation légère au blur pour format et bornes ; le serveur reste arbitre.
- Erreur sous le champ avec message actionnable et association `aria-describedby`.
- Après soumission invalide, un résumé `Corrigez 4 éléments` contient des liens ; le focus va au résumé puis le premier lien mène au champ.
- Les chemins serveur `fiscalProfile.taxCountry`, `fiscalProfile.currency`, `fiscalProfile.vatStatus`, `fiscalProfile.taxIdentifiers.<type>`, `fiscalProfile.defaultVatRateId` et `fiscalProfile.validation` ouvrent la section et ciblent le contrôle correspondant.
- L'enregistrement fiscal envoie les `version` et `fiscalProfileVersion` courantes. Un `409 VERSION_CONFLICT` ne fusionne jamais automatiquement les identifiants ou le taux : il propose **Comparer avec la version actuelle**, puis une nouvelle soumission explicite.
- Un changement de policy nécessitant revalidation affiche **Profil fiscal à revalider**, la policy avant/après et les champs concernés ; seule une validation serveur réussie retire cet état.
- `400 FIELD_NOT_ALLOWED` sur un ancien champ scalaire ou un champ tenant est rendu comme incompatibilité de formulaire, sans tentative de fallback vers l'ancien contrat.
- Un doublon inaccessible reçoit un message générique : « Cette identité ne peut pas être enregistrée. Vérifiez les informations ou contactez un administrateur. »
- Une erreur serveur conserve toutes les valeurs et le brouillon local en mémoire ; aucun fallback localStorage silencieux ne remplace l'API.

Avant une modification sensible — territoire, devise, statut TVA, identifiants ou taux par défaut — le résumé de soumission nomme les champs modifiés et rappelle qu'ils seront audités. Après succès, la zone d'activité, visible seulement avec `audit.read`, traduit les actions serveur en libellés sobres : **Profil fiscal mis à jour**, **Taux par défaut modifié**, **Taux créé** ou **Taux mis à jour**. Elle n'affiche ni valeur complète d'identifiant, ni motif libre complet, et utilise le `requestId` uniquement dans le détail technique autorisé.

## 6. O2 — Sites, unités internes et prestations

### 6.1 Vue d'ensemble

O2 utilise trois panneaux successifs dans la même page :

1. **Sites** — où l'organisation opère ;
2. **Unités internes** — qui réalise le travail ;
3. **Prestations proposées** — ce que l'organisation fournit.

Un résumé supérieur indique, par exemple : `2 sites actifs · 5 unités · 5 prestations · 1 exigence à décider`.

### 6.2 Sites

Le premier site bénéficie de l'action **Créer le premier site**. Les suivants utilisent **Ajouter un site**. Chaque carte ou ligne affiche nom, code, type, ville, activités, fuseau et état.

Le drawer de site regroupe :

- identité : nom, code, type (`Siège`, `Post-production`, `Location`, `Laboratoire`, `Mixte`, `Autre`) ;
- adresse complète ;
- fuseau explicite, prérempli depuis l'organisation ;
- email/téléphone facultatifs ;
- activités, limitées à celles de l'organisation ;
- statut actif.

La désactivation d'un site est une action distincte. Si un remplacement est requis, le dialogue impose un site actif compatible et décrit les éléments concernés ; aucune valeur n'est présélectionnée arbitrairement.

### 6.3 Unités internes

La table affiche code, nom, type, site ou `Tous les sites`, parent, responsable et statut. Le formulaire utilise les libellés :

- Type : Département, Service interne, Laboratoire, Équipe ;
- Site : un site précis ou `Unité globale à l'organisation` ;
- Unité parente : combobox limitée aux parents valides ;
- Activités prises en charge ;
- Responsable, optionnel à ce stade.

Une hiérarchie est montrée par indentation et chemin textuel. Une boucle ou une profondeur supérieure à quatre est expliquée au niveau du parent, jamais seulement par une erreur globale.

### 6.4 Prestations proposées et matrice d'exigences

La table affiche code, nom, catégorie, unité interne responsable facultative et statut. Les catégories sont Montage, Étalonnage, Mixage, PAD, Laboratoire, Location, Autre. Aucun champ de prix n'apparaît.

Pour chaque exigence issue des activités, une matrice présente :

| Exigence | Décision | Prestation associée | État |
|---|---|---|---|
| Montage | Activée / Non applicable | sélection ou création | À compléter / Conforme |
| Étalonnage | Activée / Non applicable | sélection ou création | … |
| Mixage | Activée / Non applicable | sélection ou création | … |
| PAD | Activée / Non applicable | sélection ou création | … |
| Laboratoire | Activée / Non applicable | sélection ou création | … |

`Non applicable` ouvre un champ motif obligatoire de 10 à 500 caractères et rappelle que la décision est auditée. Le motif complet n'est pas réaffiché dans une liste publique. Repasser à `Activée` annonce qu'O2 redeviendra incomplet jusqu'à association d'une prestation active.

L'interface ne permet jamais de substituer une unité à une prestation. Exemple pour Eliote Props Prod : l'unité interne **Montage** peut porter la prestation **Montage image**, mais chacune conserve sa propre fiche.

### 6.5 Validation O2

Le panneau latéral détaille séparément :

- site actif et adresse complète ;
- unité compatible active ;
- chaque exigence activée couverte par une prestation active ;
- chaque décision non applicable motivée.

La validation incomplète place le focus sur le résumé puis propose des liens tels que **Compléter l'adresse de Paris** ou **Décider pour PAD**.

## 7. O3 — Membres, rôles et couverture des sites

### 7.1 Vue gouvernance

La page contient :

- KPI textuels : membres actifs, administrateurs, sites couverts, invitations en attente ;
- table des membres : identité, fonction, statut, rôles, périmètre, site par défaut ;
- panneau **Couverture des sites** listant chaque site avec son responsable explicite ou l'administrateur global qui le couvre.

### 7.2 Ajouter ou rattacher un membre

Le drawer séquentiel contient :

1. identité locale ou utilisateur existant autorisé ;
2. nom affiché, fonction et référence employé facultative ;
3. rôles choisis dans le catalogue fermé ;
4. périmètre explicite : **Toute l'organisation** ou **Sites et unités sélectionnés** ;
5. site par défaut, limité au périmètre ;
6. résumé avant enregistrement.

Une liste vide de sites est affichée comme **Aucun site autorisé**, jamais comme « Tous ». Les permissions effectives sont résumées en langage métier ; le détail du catalogue est disponible dans un disclosure accessible.

### 7.3 Garde-fous

- Retirer le dernier administrateur actif affiche un refus bloquant et l'action **Désigner d'abord un autre administrateur**.
- Un site non couvert affiche `Responsable manquant` avec **Affecter un responsable**.
- Les actions non autorisées sont absentes ; une fiche en lecture seule reste consultable.
- Un responsable borné à un site ne voit pas les coordonnées ou membres des autres sites.
- Les identifiants ou résultats d'une autre organisation ne sont jamais proposés dans les combobox.

### 7.4 Validation O3 et activation

Après validation O3, une page **Prête à activer** résume O1, O2 et O3 avec liens de révision. L'action primaire **Activer l'organisation** appelle la relecture complète serveur.

Succès : statut **Active · Prête**, toast `Organisation activée`, puis carte **Prochaine étape : configurer les ressources**. L'activation ne redirige pas automatiquement ; l'utilisateur choisit **Configurer les ressources** ou **Voir l'organisation**.

Échec après modification concurrente : afficher les prérequis redevenus invalides, conserver la page et proposer **Actualiser l'état**.

## 8. Vue d'ensemble après activation

La synthèse comporte :

- identité et statut ;
- cartes Sites, Unités, Prestations, Membres ;
- chaîne de préparation métier : `Organisation prête` → `Ressources à configurer` → `Projet requis` → `Planning` ;
- dernières modifications auditées, uniquement avec `audit.read` ;
- actions d'administration selon permission.

Suspendre et Archiver sont dans un menu secondaire, jamais à côté de l'action principale. Chaque dialogue nomme la conséquence, demande le motif et la version courante. **Archiver l'organisation** exige une confirmation textuelle explicite et rappelle que l'état est terminal dans ce lot.

Une organisation suspendue affiche une bannière persistante : « Lecture autorisée ; les nouvelles opérations métier sont bloquées. » Une organisation archivée est en lecture seule.

## 9. Wireframes texte

### 9.1 Tableau multi-organisations — desktop

```text
┌ Rail ─┬──────────────────────────────────────────────────────────────┐
│       │ Organisations                         [Créer une organisation]│
│ Admin │ Gérez les entités accessibles à votre compte.                │
│  └Org │ [Rechercher…] [Statut ▾] [Activité ▾] [Étape ▾]              │
│       ├──────────────────────────────────────────────────────────────┤
│       │ Organisation       Activité      Configuration  Statut       │
│       │ Eliote Props Prod  Post-prod     Prête          ● Active     │
│       │  EPP · Contexte actuel     2 sites · 5 unités      [Ouvrir]  │
│       │ Eliote Location    Location      O2 · à compléter  Brouillon │
│       │ FAV Location       Location      O1 · à compléter  Brouillon │
│       └──────────────────────────────────────────────────────────────┤
│       │ 1–3 sur 3                                           1 / 1    │
└───────┴──────────────────────────────────────────────────────────────┘
```

### 9.2 Assistant O1 fiscal — desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Organisations / Eliote Props Prod                  Brouillon · O1/3  │
│ [● Identité] ── [🔒 Sites et services] ── [🔒 Membres] ── [🔒 Activer]│
│ [✓ 1 Identité] [✓ 2 Territoire] [✓ 3 Identifiants] [● 4 Devise/taux]│
│ [🔒 5 Validation — validez d'abord Devise et taux]                   │
├───────────────────────────────────────────────┬──────────────────────┤
│ Devise et taux par défaut                     │ État de la sous-étape│
│ Devise [EUR ▾]                                │ ✓ Identité validée   │
│                                               │ ✓ Territoire validé  │
│ Taux par défaut [STANDARD · 20,00 % ▾]        │                      │
│ Proposition modifiable       [Gérer les taux] │ Prochaine action     │
│                                               │ [Valider devise/taux]│
│ Résumé validé                                 │                      │
│ France · Assujettie · 3 identifiants   [Voir] │                      │
├───────────────────────────────────────────────┴──────────────────────┤
│ [Retour aux identifiants]              [Valider devise et taux]      │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.3 Assistant O2 — desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Organisations / Eliote Props Prod                  Brouillon · O2/3  │
│ [✓ Identité] ── [● Sites et services] ── [🔒 Membres] ── [🔒 Activer]│
├───────────────────────────────────────────────┬──────────────────────┤
│ Sites                         [Ajouter un site]│ État de l'étape      │
│ Paris Post-production · actif · Europe/Paris  │ ✓ 1 site actif       │
│ Boulogne Laboratoire · actif · Europe/Paris   │ ✓ 5 unités           │
│                                               │ ! PAD à décider      │
│ Unités internes              [Ajouter]        │                      │
│ Montage / Étalonnage / Mixage / PAD / Labo    │ Prochaine action     │
│                                               │ [Décider pour PAD]   │
│ Prestations proposées        [Ajouter]        │                      │
│ Montage image · Étalonnage · Mixage · Labo    │                      │
│                                               │                      │
│ Exigences : Montage ✓  Étalonnage ✓  Mixage ✓  PAD !  Labo ✓        │
├───────────────────────────────────────────────┴──────────────────────┤
│ [Quitter et reprendre] [Enregistrer]      [Valider l'étape O2]       │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.4 Mobile

```text
┌──────────────────────────────┐
│ ‹ Organisations       O2/3   │
│ Eliote Props Prod · Brouillon│
│ [✓ O1] [● O2] [🔒 O3] [🔒]   │
├──────────────────────────────┤
│ État : 1 élément manquant    │
│ [Décider pour PAD]           │
├──────────────────────────────┤
│ Sites (2)                    │
│ [Paris Post-production   ›]  │
│ [Boulogne Laboratoire    ›]  │
│ [+ Ajouter un site]          │
│                              │
│ Unités internes (5)      ›   │
│ Prestations (4)          ›   │
│ Exigences                ›   │
├──────────────────────────────┤
│ [Enregistrer] [Valider O2]   │
└──────────────────────────────┘
```

## 10. Erreurs, concurrence et récupération

| Situation | Comportement UX |
|---|---|
| `422 ONBOARDING_INCOMPLETE` | résumé d'erreurs, liens vers champs/objets, focus contrôlé, données conservées |
| `409 PREREQUISITE_NOT_MET` | panneau de blocage avec étape, éléments manquants et `nextAction` serveur |
| `409 VERSION_CONFLICT` | ne pas écraser ; afficher `Cette fiche a changé`, recharger la version actuelle et proposer de ressaisir les différences |
| `403` ou route hors scope | refus neutre, aucune donnée ou existence étrangère révélée |
| `404 NOT_FOUND` | message identique pour absent et hors périmètre |
| session expirée | conserver le brouillon en mémoire de l'onglet, demander reconnexion, ne renvoyer qu'après nouveau contrôle CSRF/contexte |
| réseau indisponible | bannière, lecture des données déjà visibles, aucune mutation mise en file automatiquement |
| sauvegarde lente | libellé `Enregistrement…`, largeur stable, `aria-busy=true`, actions incompatibles bloquées |
| SSE reçu pendant édition | ne pas remplacer les champs ; bannière `Une version plus récente est disponible` + **Comparer** |

Les erreurs techniques détaillées restent repliées et copiables avec `requestId`, sans stack ni données sensibles. Les toasts ne sont jamais l'unique support d'une erreur de formulaire.

Pour `company.fiscalProfile.updated.v1`, `company.defaultVatRate.changed.v1`, `vatRate.created.v1` et `vatRate.updated.v1`, le client invalide uniquement les lectures fiscales du contexte actif puis recharge les représentations autorisées. Un événement ne fournit jamais un taux faisant autorité ni un identifiant fiscal à afficher directement. S'il concerne un autre `companyId`, il est ignoré ; après changement de contexte, l'ancien abonnement est fermé avant d'ouvrir le nouveau. Pendant une édition, l'interface conserve les champs saisis et applique le comportement **Comparer**, sans fusion automatique.

## 11. Permissions et présentation de l'isolation

| Profil | Tableau organisations | O1 général | Profil fiscal / taux | O2 | O3 | Activer |
|---|---|---|---|---|---|---|
| Administrateur plateforme | visibles selon affectations ; création | création initiale uniquement sans accès implicite ultérieur | aucun accès implicite après création | selon affectation | désigne le premier admin dans le cadre autorisé | selon permission explicite |
| Administrateur organisation | son organisation | gérer | gérer seulement avec `fiscalProfile.manage` / `vatRate.manage` dédiées | gérer | gérer | oui avec `organization.activate` |
| Responsable de site | contexte autorisé | lire | lecture seulement avec `fiscalProfile.read` / `vatRate.read` | gérer ses sites/unités | lire la couverture autorisée | non |
| Planificateur / gestionnaire de parc | contexte autorisé | lire | lecture seulement si permissions fiscales explicites | lire | lecture minimale | non |
| Lecteur | contexte autorisé | lire | aucune donnée fiscale non autorisée ; valeurs sensibles masquées | lire selon scope | aucune donnée personnelle non autorisée | non |

Le frontend utilise les permissions pour présenter les actions, mais traite toujours un refus serveur comme autorité. Une action disparue après changement de rôle est retirée immédiatement au prochain retour serveur/SSE, sans conserver de capacité dans un menu déjà ouvert.

`organization.manage`, `fiscalProfile.manage` et `vatRate.manage` sont indépendantes. Une personne qui peut modifier le nom ou l'activité ne voit pas pour autant **Enregistrer le profil fiscal** ou **Ajouter un taux**. L'aperçu Devis exige `fiscalProfile.read`; les identifiants restent masqués si la représentation serveur les masque. Aucun contrôle frontend ne déduit un droit à partir du libellé du rôle.

## 12. Responsive, accessibilité et clavier

### 12.1 Responsive

- Desktop `≥1280px` : rail 64 px, contenu, panneau d'état sticky ; largeur utile maximale 1440 px.
- Tablette `768–1279px` : panneau d'état repliable au-dessus du formulaire ; drawers jusqu'à 90 vw ; tableau à colonnes prioritaires Organisation/Configuration/Statut.
- Mobile `<768px` : navigation basse, stepper compact défilable, sections en accordéons, formulaires plein écran, barre d'actions sticky ; aucune table horizontale indispensable.
- Le stepper interne O1 conserve les cinq sous-étapes dans l'ordre normatif à toutes les largeurs. Sur mobile, il affiche le libellé courant `Sous-étape 3 sur 5 — Identifiants structurés` et une liste accessible des étapes/verrous ; il ne réordonne jamais Devise avant Identifiants.
- Sur tablette et mobile, les identifiants fiscaux et les taux deviennent des cartes ordonnées avec libellés répétés ; les actions Ajouter/Retirer restent adjacentes à l'élément concerné et le badge Par défaut est textuel.
- L'aperçu Devis passe en une liste de définition à une colonne ; aucune valeur légale, devise ou période n'est tronquée sans mécanisme accessible pour obtenir le texte complet.
- À 200 % de zoom, aucune action ne disparaît ; à 400 %, reflow en une colonne.
- Cibles tactiles minimales 44 × 44 px ; aucune interaction ne dépend du hover.

### 12.2 Clavier et focus

- **Aller au contenu** est le premier focus.
- Tab suit : en-tête → stepper → résumé d'état → formulaire → actions.
- Le stepper utilise Tab entre étapes accessibles ; les étapes verrouillées sont annoncées mais non activables.
- Combobox : flèches, Entrée, Échap ; recherche à partir de huit choix.
- Drawer : focus initial sur titre ou premier champ invalide ; Échap ferme seulement sans modification ; focus rendu au déclencheur.
- Dialogue : piège de focus, titre et description associés, Échap selon caractère destructif.
- Après ajout d'un site/unité/membre, focus sur la nouvelle ligne et annonce `Ajouté` dans une région `aria-live=polite`.
- Après ajout d'un identifiant ou d'un taux, focus sur le premier champ du nouvel élément ; après retrait, focus sur l'élément suivant ou sur **Ajouter un identifiant/taux**.
- Après suppression logique/désactivation, focus sur l'élément suivant ou l'en-tête de liste si elle est vide.
- Les raccourcis à une touche sont désactivés dans les champs ; aucune commande métier n'est clavier-only.

### 12.3 WCAG 2.2 AA et internationalisation

- Contraste 4,5:1 texte normal, 3:1 composants/focus ; anneau 2 px `--color-focus` avec offset 2 px.
- Erreur, succès, brouillon, verrouillage et sélection combinent texte, icône et couleur.
- Labels visibles ; aides et erreurs liées avec `aria-describedby` ; champs obligatoires annoncés textuellement.
- Titres hiérarchiques, landmarks, listes et tables sémantiques ; `aria-sort`, `aria-current` et états expanded/disabled exacts.
- Région live polie pour sauvegarde, changement de contexte et progression ; assertive pour erreur critique.
- Support clair/sombre/système et `prefers-reduced-motion` ; aucune marque d'organisation ne détermine le thème.
- Locale initiale `fr-FR`, nombres et monnaies localisés, fuseaux affichés ; textes prévus pour +30 % de longueur sans concaténation de fragments.
- Les coordonnées et numéros légaux masqués selon permission ont un libellé accessible `Information masquée`.
- Les groupes d'identifiants utilisent `fieldset`/`legend` avec type et position ; les erreurs de SIREN, SIRET et TVA ne reposent ni sur un placeholder ni sur la couleur.
- Un pourcentage est annoncé avec son libellé et sa période, par exemple « Taux normal, 20 virgule 00 pour cent, applicable à partir du 1er janvier 2026 » ; la valeur en points de base reste une aide technique, pas le seul nom accessible.
- Les statuts **Par défaut**, **Futur**, **Expiré**, **À revalider** et **Information masquée** combinent texte et icône ; les identifiants sensibles ne sont jamais placés dans une région live.

## 13. Critères UI testables

- [ ] Le tableau reste exploitable avec 20 organisations, recherche, filtres, tri et pagination serveur.
- [ ] Les trois exemples sont différenciés par leur identité et activité, pas seulement par une couleur ou un logo.
- [ ] Le changement Eliote Props Prod → Eliote Location purge l'ancien contenu avant le nouveau chargement et renouvelle SSE/contexte.
- [ ] O2 est verrouillée avant validation serveur d'O1 ; O3 est verrouillée avant O2 ; Activation est verrouillée avant O3.
- [ ] Une URL directe vers O2 verrouillée explique les prérequis et fournit une action vers O1.
- [ ] O1 matérialise exactement cinq sous-étapes dans l'ordre Identité légale → Territoire et statut fiscal → Identifiants structurés → Devise et taux par défaut → Validation ; chaque suivante reste verrouillée jusqu'au succès serveur de la précédente.
- [ ] Modifier une sous-étape O1 validée la repasse à valider, reverrouille toutes les suivantes et replace la reprise sur la première erreur serveur ; aucun accès direct ne contourne la séquence.
- [ ] O1 restitue toutes les exigences requises sans rendre `tradeName`, logo, site web ou capital bloquants ; SIREN/SIRET sont requis sous `FR@1` et la TVA ne bloque que lorsque `vatStatus="registered"`.
- [ ] Aucun formulaire n'émet les anciens scalaires `registrationNumber`, `establishmentNumber` ou `vatNumber`; les identifiants sont des entrées structurées et bornées.
- [ ] Le profil fiscal exige territoire, devise, statut TVA, identifiants selon policy et taux par défaut actif/applicable ; le taux FR proposé à 20 % est clairement modifiable.
- [ ] Un utilisateur avec `organization.manage` seul ne peut modifier ni profil fiscal ni taux ; lecture et mutation suivent les quatre permissions fiscales dédiées.
- [ ] Le catalogue refuse visuellement et côté serveur les flottants non représentables, périodes invalides/chevauchantes et désactivation du défaut sans remplacement atomique.
- [ ] Un conflit de `version` ou `fiscalProfileVersion` conserve la saisie, ne fusionne rien automatiquement et offre une comparaison accessible.
- [ ] L'aperçu futur Devis est en lecture seule, utilise exclusivement l'adresse `registeredOffice` principale validée, masque les identifiants selon permission et ne calcule ni HT, ni TVA, ni TTC.
- [ ] Les événements SSE fiscaux invalident uniquement le contexte actif et ne deviennent jamais une source directe de données fiscales.
- [ ] Les erreurs de gate sont reliées à chaque champ/objet et le focus permet de les parcourir.
- [ ] O2 distingue visuellement et sémantiquement site, unité interne et prestation proposée.
- [ ] Post-production impose une décision explicite pour Montage, Étalonnage, Mixage et PAD ; Laboratoire suit la même règle.
- [ ] `Non applicable` exige un motif borné et annonce l'audit avant validation.
- [ ] Une portée vide est affichée `Aucun site autorisé`, jamais interprétée comme globale.
- [ ] Le dernier administrateur et un site sans couverture produisent des blocages actionnables.
- [ ] Lecture seule montre la complétude et les causes sans exposer de commandes de correction.
- [ ] Les états loading, vide, erreur partielle, refus, conflit de version, suspendu et archivé sont couverts.
- [ ] Les parcours complets fonctionnent à 1440 × 900, 1024 × 768, 390 × 844, zoom 200 %, thème clair/sombre et mouvement réduit.
- [ ] Axe ne remonte aucune violation critique/sérieuse ; toutes les actions essentielles sont réalisables au clavier avec focus visible.

## 14. Scénarios UI/E2E Organisation 01

1. **Création O1 fiscale FR séquentielle** : créer Eliote Props Prod ; valider successivement Identité légale, Territoire FR/statut assujetti, SIREN/SIRET/TVA structurés, puis EUR/taux normal proposé à 20 % ; vérifier avant chaque succès que la sous-étape suivante est verrouillée, tenter un accès direct, corriger une erreur via le résumé, terminer Validation, recharger et retrouver O2 débloquée.
2. **Structure O2** : créer deux sites, unités Montage/Étalonnage/Mixage/PAD/Laboratoire et prestations correspondantes ; vérifier que l'absence de décision PAD bloque puis valider après correction.
3. **Non applicable** : choisir `Non applicable` sans motif puis avec motif valide ; vérifier erreur, annonce d'audit et invalidation lors du retour à `Activée` sans prestation.
4. **Gouvernance O3** : ajouter administrateur global et responsable de site limité ; vérifier la couverture, refuser le retrait du dernier administrateur, valider O3 puis activer.
5. **Multi-organisations** : créer Eliote Location et FAV Location, changer de contexte plusieurs fois, recharger et vérifier nom, navigation, listes, permissions et SSE du seul contexte actif.
6. **Lecture limitée** : se connecter comme responsable d'un seul site puis comme lecteur ; vérifier actions absentes, champs personnels masqués et raisons de progression encore lisibles.
7. **Accès direct et isolation** : ouvrir une étape verrouillée puis tenter une URL/identifiant d'une autre organisation ; obtenir une explication locale pour le gate et un refus non révélateur pour l'isolation.
8. **Concurrence** : ouvrir O1 dans deux sessions, enregistrer A puis B avec version périmée ; vérifier absence d'écrasement, comparaison/rechargement et focus récupérable.
9. **Récupération** : interrompre une sauvegarde, retrouver le formulaire rempli, réessayer, puis changer de contexte avec modifications non enregistrées et vérifier la confirmation.
10. **Accessibilité/responsive** : rejouer création, changement de contexte, O1–O3 et activation au clavier seul sur desktop, puis les actions essentielles sur mobile et à zoom 200 %.
11. **Statut TVA et territoire** : passer d'Assujettie à Exonérée avec taux explicite à 0 %, vérifier que la TVA n'est plus exigée, puis changer de territoire et constater la revalidation atomique de tous les champs concernés.
12. **Catalogue TVA et concurrence** : créer un taux futur, refuser un chevauchement, choisir un autre défaut, tenter de désactiver le défaut sans remplacement, puis provoquer un conflit de versions et vérifier comparaison, audit visible autorisé et rechargement SSE.
13. **Permissions et isolation fiscales** : avec `organization.manage` sans permissions fiscales, vérifier les commandes absentes et les refus serveur ; avec une affectation d'un autre tenant, tenter un `vatRateId` connu et obtenir une réponse non révélatrice sans donnée résiduelle dans l'interface.
14. **Aperçu futur Devis** : créer aussi une adresse de facturation distincte, vérifier que le snapshot affiche exclusivement le `registeredOffice` principal validé, les identifiants masqués selon permission et aucune action/montant Devis, puis modifier le taux par défaut et constater que l'aperçu se recharge seulement après réponse serveur/SSE.

## 15. Hors périmètre UX de ce lot

- création des 120 salles et affectation d'équipements : conçues et validées dans Ressources 02 ;
- création Client/Projet/Émission : Projets 04 ;
- grille jour × salle, multi-semaines et déplacement inter-salles : Planning 03 ;
- SSO, MFA, import massif, création/calcul/export de Devis, facturation, suppression physique d'organisation et validation légale par service externe ;
- migration visuelle vers React ou ajout d'une dépendance UI externe.

Organisation 01 montre les modules aval et leurs prérequis, mais ne simule ni ne duplique leurs formulaires ou règles.
