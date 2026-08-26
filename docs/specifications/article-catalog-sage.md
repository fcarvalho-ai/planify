# Spécification — Catalogue articles SAGE

Statut : approuvé par le Product Owner pour développement  
Date : 2026-08-26  
Source approuvée : `Catalogue_articles_SAGE_nettoye.xlsx` (71 lignes)

## Objectif

Planify maintient un référentiel local d’articles compatible avec la future facturation SAGE. Le catalogue fournit les références visibles dans les devis et des dimensions analytiques stables, sans dépendre d’Excel ni de SAGE à l’exécution.

## Modèle et invariants

- Le **code SAGE** est conservé exactement comme dans la source. Il peut être partagé par plusieurs prestations historiques (`T TECH`).
- Le **code analytique Planify** est obligatoire, unique par société et stable. Il permet de distinguer les prestations qui partagent un code SAGE.
- Un article porte : famille, catégories, désignation professionnelle, désignation source, état actif, version et métadonnées d’audit.
- Toute création ou modification est versionnée, contrôlée de façon optimiste et auditée. Les suppressions sont des désactivations logiques.
- Les données sont isolées par société. `article.read` autorise la lecture ; `article.manage` autorise les mutations.
- Le référentiel approuvé est seedé uniquement pour Northlight Post par une migration additive, rejouable et réversible. Les autres sociétés démarrent avec un catalogue vide.

## Devis et historique

- Le catalogue articles est proposé dans l’éditeur de lignes de devis.
- Une ligne issue du catalogue porte `sourceType: article` et capture un snapshot immuable : identifiant article, code SAGE, code analytique, désignation, famille, catégories et version.
- La référence SAGE apparaît à gauche de la désignation dans l’éditeur et le PDF.
- Modifier ou désactiver un article n’altère jamais une ligne existante, une version de devis ou un PDF historique.
- Le serveur reste l’autorité : l’UI ne peut pas fournir ou modifier elle-même le snapshot.

## Analytique et future passerelle SAGE

- Les lignes analytiques issues des devis exposent le code SAGE et le code analytique capturés.
- Les agrégations futures utilisent le code analytique Planify ; les exports vers SAGE utilisent le code SAGE capturé.
- Aucun appel réseau ou connecteur SAGE n’est inclus dans ce lot.

## Critères d’acceptation

- 71 articles Northlight sont importés une seule fois, avec 71 codes analytiques uniques.
- Un administrateur peut lister, créer, modifier et désactiver un article ; un lecteur ne peut pas muter.
- Les doublons de code analytique sont refusés sans écriture partielle ; les codes SAGE dupliqués sont acceptés.
- Une ligne de devis créée depuis un article affiche sa référence dans l’interface et le PDF.
- Après modification du catalogue, le devis conserve l’ancien snapshot et ses analyses conservent les anciens codes.
- Les routes, erreurs, permissions et schémas sont documentés dans OpenAPI.
- Migration, rollback, tests ciblés, suite complète et gates indépendants passent avant intégration.

## Hors périmètre

- synchronisation bidirectionnelle avec SAGE ;
- factures, avoirs et écritures comptables ;
- tarification automatique propre à SAGE ;
- modification automatique des lignes historiques lors d’une mise à jour du catalogue.

