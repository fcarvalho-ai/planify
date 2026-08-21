# Spécification — Module Clients 05

Statut : SPEC figée pour développement, revue indépendante requise  
Date : 2026-08-17

## Objectif

Fournir un référentiel client professionnel, isolé par société, qui alimente les projets et les devis sans dépendance réseau. Un compte porte son identité, ses coordonnées de facturation, ses contacts et, facultativement, une grille tarifaire privée.

## Périmètre

- compte client : nom/raison sociale, code, statut, email et téléphone génériques, site web HTTPS, adresse de facturation, pays et notes ;
- contacts `0..n`, créables, modifiables et supprimables logiquement à tout moment : prénom, nom, fonction, email requis, téléphone facultatif ;
- import d'une grille `.xlsx` (5 Mo maximum), avec analyse et prévisualisation avant confirmation ; aucune ligne ambiguë ou invalide n'est écrite ;
- sélection d'un contact lors de la création d'un budget/devis ; le document et chacune de ses versions conservent un snapshot du contact ;
- priorité de prix `projet > client > catalogue`. Le prix résolu est appliqué automatiquement lorsque le client ne transmet aucun prix. Toute saisie ou altération manuelle de prix, avec ou sans grille applicable, constitue un override réservé à `quote.overridePrice`, exige un `priceOverrideReason` dédié d’au moins trois caractères et est auditée. `discountReason` décrit uniquement une remise et ne peut jamais satisfaire le motif d’override de prix ;
- stockage local privé du classeur confirmé (nom de stockage opaque, SHA-256, permissions `0600`) ; aucune URL de téléchargement publique.

Hors périmètre : CRM externe, enrichissement réseau, facturation, synchronisation email, lecture d'anciens `.xls` binaires.

## Contrats

- `GET/POST /api/v1/clients`, `GET/PATCH /api/v1/clients/:id` ;
- `GET/POST /api/v1/clients/:id/contacts`, `PATCH/DELETE /api/v1/clients/:id/contacts/:contactId` ;
- `POST /api/v1/clients/:id/rate-card-import/preview`, puis `POST /api/v1/clients/:id/rate-card-imports` avec les lignes explicitement retenues ;
- mutations : CSRF/origine, `client.manage`, société de la session, `version`, `Idempotency-Key` sur les créations/imports, audit puis SSE après succès ;
- `POST /quotes` accepte `contactId`. Le contact doit être actif et appartenir au client du projet. Le snapshot contient l'identité et les coordonnées au moment de la création ; aucune modification ultérieure du contact ne réécrit le document.

## Format de grille

Deux dispositions sont reconnues. Le tableau normalisé contient `Référence`, `Désignation`, `Unité`, `Prix de vente HT`, `Coût HT` sur une même ligne de titres, éventuellement précédée de lignes de présentation. La disposition par services contient des blocs `Stockage MAM`, `Postproduction` ou `Logistique` : les lignes placées sous le titre du service sont des désignations et les colonnes `Jour`, `Semaine`, `Mois` et `Forfait` produisent chacune un tarif distinct. Les cellules vides ne créent rien et toute colonne `Remise` est volontairement ignorée. Les montants décimaux sont convertis dans la devise de la société. Une référence correspond à l'identifiant ou au code d'une ressource, d'un article Stock ou d'une prestation ; à défaut, une désignation unique peut être rapprochée. La prévisualisation expose catégorie, désignation, unité, prix, correspondances et erreurs ; l'utilisateur confirme uniquement les tarifs valides.

## Critères d'acceptation

1. Un planificateur autorisé gère les comptes et contacts de sa société ; un lecteur reçoit `403`, un identifiant d'une autre société reste `404`.
2. Email contact invalide, téléphone démesuré, code dupliqué, version obsolète et clé d'idempotence réutilisée avec un autre corps sont refusés.
3. La suppression d'un contact est logique ; les snapshots de devis historiques restent intacts.
4. Un `.xlsx` invalide ou un autre format est refusé. La prévisualisation ne crée ni tarif ni fichier permanent.
5. Après confirmation, la grille et ses tarifs sont versionnés, audités et privés ; le réimport idempotent ne duplique rien.
6. Une ligne de devis catalogue choisit le tarif projet, sinon client, sinon catalogue. L'origine est visible. Une salle individuelle « Salle de montage AVID N » hérite du tarif projet/client de la prestation générique « Salle de montage Avid » lorsqu'aucun tarif de même portée n'est défini directement pour la salle ; un tarif direct de même portée reste prioritaire. Les interfaces omettent `unitPriceMinor` lorsqu’elles attendent cette résolution automatique. Un prix réellement saisi ou altéré est refusé sans `quote.overridePrice` ou sans `priceOverrideReason` dédié, y compris en l'absence de grille ; le motif de remise reste indépendant.
7. L'interface échappe les données, reste navigable au clavier, propose des exemples de saisie et confirme les suppressions.

## Migration et rollback

Migration additive `clients-05-accounts-contacts-rates-v1` : initialise les collections et la permission d'override, sans réécrire les anciens clients, projets, devis ou réservations. Les valeurs par défaut des anciens comptes sont appliquées à la lecture puis persistées seulement lors d'une modification explicite. Rollback applicatif : l'ancien code ignore les nouveaux champs/collections ; les fichiers privés peuvent être conservés. Aucune suppression destructive automatique.
