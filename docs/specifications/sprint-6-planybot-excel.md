# Sprint 6 — PlanyBot et import Excel

Date : 2026-08-22

Références : Backlog V1 (`US-057` à `US-060`, `US-062` à `US-064`), Ordre de lancement V1, `docs/spec-mvp.md`, `docs/architecture.md` et candidat approuvé `0.2.0-rc2`.

## 1. Objectif et règle d’autorité

Le Sprint 6 transforme PlanyBot en assistant contextuel du parcours Projet → Devis → Planning, sans en faire une source de vérité. PlanyBot peut lire des données autorisées, expliquer, détecter des ambiguïtés et préparer une commande. Seuls les moteurs métier déterministes valident les quantités, tarifs, disponibilités, capacités, conflits et mutations.

La règle de gate est non négociable : **l’IA propose, l’humain confirme, le moteur exécute**. Aucune réservation, ligne commerciale ou modification de planning n’est créée à la réception d’un fichier ou d’un message.

Le runtime reste local, autonome et sans SaaS, CDN, télémétrie ni dépendance réseau. Le monolithe CommonJS et la persistance JSON RC1 sont conservés ; ce Sprint n’autorise aucune migration implicite de stack.

## 2. Périmètre V1 exact

| Story | Livrable | Critère d’acceptation testable |
|---|---|---|
| US-057 | Panneau PlanyBot contextuel | Panneau repliable affichant à planifier, conforme, dépassements et actions depuis des données serveur actualisées. |
| US-058 | Dialogue PlanyBot | Réponses sur Projet, Devis, Planning et disponibilité, accompagnées de faits structurés et sans quantité inventée. |
| US-059 | Recommandations de ressources | Classement déterministe : disponibilité → continuité → préférence client → site → coût ; chaque proposition expose ses critères. |
| US-060 | Action après confirmation | PlanyBot prépare une commande et sa prévisualisation ; seule une confirmation explicite déclenche le moteur et une mutation auditée. |
| US-062 | Analyse d’un planning Excel client | Extraction bornée de dates, prestations, ressources, durées, commentaires et ambiguïtés ; aucune écriture métier pendant l’analyse. |
| US-063 | Clarification | Les cellules ambiguës ou incomplètes produisent des questions ; aucune donnée incertaine n’est appliquée avant validation humaine. |
| US-064 | Audit PlanyBot | Proposition, faits utilisés, confirmation/refus, commande et résultat sont traçables sans conservation inutile de contenu sensible. |

`US-061` (« répartir automatiquement une quantité vendue ») reste en V2 et est explicitement exclue. Sont aussi exclus : OCR de PDF image, apprentissage automatique en ligne, appels à un LLM distant, optimisation prédictive et exécution autonome.

## 3. Contrats fonctionnels

### 3.1 Contexte et conversation

- Une conversation appartient à un utilisateur et une société ; elle peut être liée à un Projet, un site, un Devis/version et une analyse Excel.
- Chaque lecture revalide les permissions et scopes société/site/projet/entité courants. Une réduction de droits invalide l’accès aux faits et propositions historiques devenus hors périmètre.
- Les réponses contiennent un `intent`, un texte explicatif, des `facts` structurés et zéro ou plusieurs `proposals`. Une réponse ne transforme jamais une proposition en résultat métier.
- Les conversations et messages sont bornés ; les champs libres sont normalisés, limités et échappés à l’affichage.

### 3.2 Recommandation déterministe

Le serveur construit les candidats autorisés, puis calcule un ordre stable et explicable :

1. ressource disponible et compatible avec la prestation ;
2. continuité avec les affectations déjà retenues pour le Projet ;
3. préférence client structurée et active, si elle existe ;
4. site du Projet puis sites explicitement autorisés ;
5. coût déterministe disponible, sans exposer ce coût à un rôle non autorisé ;
6. identifiant opaque comme dernier départage stable.

Chaque candidat expose des raisons textuelles et des indicateurs structurés. Un candidat indisponible, hors scope ou incompatible n’est jamais recommandé, même si le message utilisateur le nomme.

### 3.3 Cycle proposition → confirmation → exécution

Une proposition persistée porte au minimum : identifiant opaque, conversation, acteur, Projet, site, type de commande, payload canonique borné, version des objets sources, digest, résultat de disponibilité/conflit, date d’expiration et statut `prepared`, `confirmed`, `rejected`, `expired` ou `executed`.

- La préparation est sans mutation Planning/Commercial.
- La confirmation exige `planning.write` ou la permission métier adaptée, une clé d’idempotence et les versions courantes.
- Le serveur revalide au moment de confirmer : session, droits, scopes, Projet, ressources, disponibilité, capacité, versions et digest.
- Une divergence renvoie une erreur stable et exige une nouvelle prévisualisation ; aucun fallback silencieux n’est permis.
- L’exécution appelle les commandes Planning/Commercial existantes, puis audite et émet le SSE après commit.
- Le rejeu exact restitue le résultat autorisé ; un payload différent avec la même clé retourne `409`.

### 3.4 Import Excel client

- Formats du Sprint : `.xlsx` et `.csv` structurés. Les PDF texte existants restent compatibles mais ne constituent pas le critère G6 Excel ; les PDF image/OCR sont hors périmètre.
- Taille maximale, nombre de feuilles, lignes, colonnes, cellules fusionnées, chaînes et dates sont bornés côté serveur.
- Le fichier demeure local et privé. Son nom normalisé, sa taille et son SHA-256 sont tracés ; son contenu n’est jamais servi comme fichier statique.
- L’analyse distingue valeurs reconnues, normalisées, ambiguës et rejetées. Chaque ligne conserve feuille, numéro de ligne, cellules sources utiles et niveau de confiance explicable.
- La prévisualisation permet de corriger la prestation, la ressource, les dates, la durée et les commentaires avant toute application.
- Les corrections humaines créent une nouvelle révision de l’analyse ; elles ne réécrivent pas l’original ni un Devis accepté.
- L’application vers un Devis brouillon ou la préparation de réservations est une commande distincte, idempotente et confirmée.

## 4. API et données cibles

Les routes existantes `/api/v1/plany/*` et `/api/v1/quotes/:id/client-planning/*` constituent la base à revalider. Le contrat OpenAPI du Sprint doit séparer clairement :

- conversation et consultation ;
- analyse de fichier sans mutation métier ;
- correction/clarification d’une analyse ;
- création d’une proposition ;
- confirmation ou refus d’une proposition ;
- lecture d’un audit PlanyBot selon permission.

Toute nouvelle collection JSON est additive, initialisée sans réécriture destructive et protégée par migration marquée, sauvegarde privée vérifiée et rollback documenté. Les fichiers importés restent hors Git.

## 5. Sécurité, confidentialité et audit

- Authentification, CSRF/Origin, RBAC serveur, isolation société/site/projet/entité et revalidation des replays sont obligatoires.
- Les réponses ne révèlent ni existence hors tenant, ni coût/marge sans permission, ni coordonnées personnelles inutiles.
- L’audit enregistre des faits structurés, le digest du contenu et les décisions ; le texte libre sensible est minimisé et borné.
- Les formules Excel ne sont jamais exécutées. Les chemins, liens externes, macros, objets embarqués et noms de fichiers ne deviennent jamais une autorité de lecture locale ou réseau.
- Les quotas couvrent taille de fichier, analyses par document, conversations, messages, propositions actives et confirmations.

## 6. Accessibilité et expérience

- PlanyBot reste une fenêtre distincte en bas de l’écran, repliable, sans superposition avec la zone d’import.
- Les phases Importer → Analyser → Clarifier/Comparer → Vérifier → Confirmer annoncent leur état par texte et `aria-live`, pas uniquement par couleur.
- Toute proposition possède les actions clavier « Voir la prévisualisation », « Confirmer » et « Refuser » ; le focus revient au déclencheur après fermeture.
- Une action en attente, obsolète, refusée ou exécutée reste explicitement distinguée.

## 7. Performance et résilience

- L’analyse d’un classeur représentatif doit rester interactive et ne pas bloquer le serveur ; les bornes du fichier et la durée sont rapportées.
- Le panneau contextuel ne relit pas toute la base à chaque caractère ; la réponse est déclenchée par envoi explicite et réutilise les moteurs/index existants.
- Le planning 250 ressources / 10 000 réservations conserve les seuils actuels après activation du panneau.
- Une coupure ou un retry ne crée aucune proposition, ligne ou réservation en double.

## 8. Découpage DEV

1. **S6-A — Contrats et audit** : modèles conversation/proposition, statuts, permissions, OpenAPI, quotas, migration/rollback et tests négatifs.
2. **S6-B — Panneau et dialogue** : contexte temps réel, faits structurés, réponses bornées et accessibilité.
3. **S6-C — Recommandations et confirmation** : classement explicable, preview, versions, idempotence et exécution par moteur.
4. **S6-D — Excel et clarification** : analyse multi-structure, ambiguïtés, corrections versionnées, application contrôlée et E2E.

## 9. Gate G6

G6 est `APPROVED` uniquement si les preuves portent sur le même candidat et démontrent :

- zéro mutation pendant dialogue, recommandation ou analyse ;
- une preview complète avant confirmation ;
- une confirmation humaine explicite et autorisée ;
- revalidation disponibilité/conflit/version au moment d’exécuter ;
- retry idempotent, divergence refusée et aucune fuite de scope ;
- audit consultable de la proposition jusqu’au résultat ;
- import Excel ambigu clarifié avant application ;
- E2E navigateur du panneau, clavier/focus et persistance après rechargement ;
- tests ciblés et `npm test` verts, puis REVIEW, QA, SECURITY et PERFORMANCE indépendants sans P0/P1.

## 10. Rollback

Le rollback du Sprint 6 désactive les nouvelles routes et l’interface, restaure la sauvegarde vérifiée de toute migration additive et laisse intacts Projets, Devis, réservations et audits antérieurs. Une proposition non exécutée peut être abandonnée ; une action déjà exécutée reste une opération métier historique et n’est jamais supprimée par le rollback technique.

## 11. État DEV

### S6-A — intégré le 2026-08-22

- collections additives `planyProposals` et `planyProposalCommands`, marqueur d’intégrité, sauvegarde privée et rollback byte-exact ;
- préparation persistée sans mutation Planning, avec commande canonique, versions sources, digest, prévisualisation et expiration ;
- lecture privée, refus explicite et confirmation sous `planning.write` ;
- confirmation idempotente revalidant les autorités courantes avant appel au moteur Réservation ;
- audit préparation/exécution/refus et SSE Réservation uniquement après une exécution nouvelle ;
- panneau PlanyBot avec prévisualisation, actions clavier natives et information de revalidation ;
- contrat OpenAPI et tests négatifs RBAC, digest, isolation utilisateur, replay divergent et rollback.

Preuves fraîches : tests ciblés 12/12, suite complète 265/265, lint et build verts. Cet état est un lot DEV ; il ne constitue pas le Gate G6 et ne couvre pas encore S6-B/C/D.

### S6-B/C — classement explicable intégré le 2026-08-23

Les intentions Disponibilité et Préparation produisent un tableau `recommendations` explicable. Les candidats sont d’abord filtrés par disponibilité, compatibilité, société, site, Projet et scopes d’entité, puis triés par continuité Projet, préférence client structurée portée par une grille tarifaire active, site du Projet, coût interne autorisé et identifiant stable. La préférence client n’est lue qu’avec `quote.read` et le coût ne participe au départage qu’avec `finance.read` ; sa valeur n’est jamais renvoyée dans la recommandation. Les raisons effectivement utilisées sont retournées avec chaque candidat. La première recommandation alimente la prévisualisation persistée ; elle ne contourne pas la confirmation S6-A.

Preuves ciblées : classement stable, préférence client active, raison explicite et absence du coût brut dans la réponse. Ce classement reste une aide déterministe : il ne réserve rien et ne remplace ni la disponibilité ni la confirmation humaine.

### S6-D — clarification versionnée intégrée le 2026-08-23

- l’analyse source Excel/CSV/PDF reste immuable ; une correction produit une révision distincte avec numéro, acteur, date, digest et audit ;
- prestation, ressource, date, durée et horaires sont revalidés contre le Devis, le site et les scopes courants ;
- une ligne ambiguë ou non reconnue exige une confirmation explicite et un motif humain borné avant toute prévisualisation Planning ;
- la prévisualisation vérifie qu’elle consomme exactement la dernière correction confirmée et refuse une sélection obsolète ;
- la commande de révision est idempotente et ne crée ni ligne commerciale ni réservation ;
- l’interface PlanyBot demande le motif, enregistre la correction, puis seulement ensuite vérifie les disponibilités.

Preuves fraîches : Devis 48/48, suite complète 266/266, lint, build, syntaxe et diff-check verts. Cet état termine l’incrément DEV S6-D ; REVIEW, QA, SECURITY/PERFORMANCE, INTEGRATION et E2E G6 restent requis sur un candidat figé.

### Correctifs issus des gates G6 — intégrés le 2026-08-23

- chaque réponse, message, conversation et marqueur idempotent PlanyBot conserve une provenance minimale des entités réellement exposées ; un rejeu ou une lecture revalide ces entités avec les droits et scopes courants et échoue fermé si cette provenance n’est pas démontrable ;
- le chemin direct Excel → Devis utilise les révisions humaines immuables de S6-D : une ligne ambiguë ou non reconnue ne peut être appliquée avant qualification de la ressource, du libellé, de la période et du motif ; le serveur refuse aussi toute dérive entre la dernière révision confirmée et la commande d’application ;
- l’analyse locale XLSX/PDF/CSV s’exécute via les API asynchrones de décompression et impose des plafonds par entrée et agrégés sur archives, feuilles, lignes, colonnes, cellules, chaînes partagées, fusions et flux PDF ; un dépassement retourne une erreur stable sans persistance ;
- l’OpenAPI couvre la lecture de conversation, l’analyse du planning client, l’application contrôlée des lignes ainsi que la prévisualisation et la conversion vers le Planning.

Preuves DEV fraîches : Clients + PlanyBot 24/24, Devis 49/49, suite complète 269/269, lint, build, syntaxe, OpenAPI YAML 3.1 et diff-check verts. Ces correctifs reviennent au workflow REVIEW → QA → SECURITY/PERFORMANCE ; aucun verdict indépendant n’est revendiqué ici.

### Durcissement final de la provenance — intégré le 2026-08-23

La provenance persistée est versionnée et inclut les permissions effectivement mobilisées ainsi que les identifiants sources des agrégats. Une réponse commerciale exige donc encore `quote.read` lors d’un rejeu, et un résumé Projet devient inaccessible si les scopes Réservation ou Ressource ayant servi à son calcul sont retirés, même lorsque le Projet reste autorisé. Une ancienne entrée qui ne démontre pas cette provenance reste conservée mais n’est pas restituée : le contrôle échoue fermé. Les opérations OpenAPI contenant `{quoteId}` déclarent toutes ce paramètre de chemin comme requis et un test vérifie cette propriété pour chaque template.

Preuves DEV fraîches : PlanyBot 14/14, suite complète 270/270, lint, build, validation sémantique des 46 chemins OpenAPI et diff-check verts. Revalidation indépendante requise.

### Provenance compacte et revalidable — intégré le 2026-08-23

La provenance PlanyBot est portée en `schemaVersion: 3`. Elle conserve les permissions effectivement utilisées et, pour les agrégats potentiellement volumineux, une empreinte déterministe des scopes d’entité courants au lieu de recopier toutes les réservations et ressources sources. Le rejeu et l’historique comparent cette empreinte aux droits courants et échouent fermés après toute réduction ou modification de périmètre. Les faits directement exposés restent contrôlés par leurs identifiants bornés. Une recommandation utilisant la préférence tarifaire client requiert explicitement `quote.read`; la continuité et la disponibilité revalident les scopes Réservation et Ressource.

Le contrat OpenAPI déclare également `ReservationAllocation` comme alias explicite de l’union d’allocations. La validation sémantique résout les 228 références de schéma et les paramètres requis des 46 chemins.

Preuves DEV fraîches : PlanyBot 14/14, suite complète 270/270, lint et build verts ; la provenance d’un résumé Projet reste inférieure à 2 000 caractères dans le test de non-régression. Revalidation indépendante obligatoire avant approbation G6.
