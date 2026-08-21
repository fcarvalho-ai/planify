# Sprint 4 V1 — Planning ↔ Devis

Date de cadrage : 2026-08-21  
Gate de sortie : `G4 — Continuité commerciale`

## 1. Autorité et objectif

Cette spécification traduit les quatorze lignes Sprint 4 du Backlog V1 et l’Ordre de lancement V1. Elle complète `docs/spec-mvp.md`, `docs/architecture.md`, l’ADR-004 et le candidat G3 approuvé ; elle ne modifie pas les règles fiscales ni les instantanés des Devis acceptés.

L’objectif G4 est d’assurer une continuité déterministe et traçable entre quantité vendue, quantité planifiée, reste à planifier, dépassement et Devis complémentaire. Les opérations groupées du Planning doivent être atomiques : succès complet ou absence totale de mutation.

Le runtime reste le monolithe local CommonJS/JSON. Aucun SaaS, modèle distant, changement de stack ou réservation automatique par PlanyBot n’entre dans ce Sprint.

## 2. Périmètre canonique

| Story | Capacité | Critère testable |
|---|---|---|
| US-038 | Copier/coller | copie distincte, nouvelle identité, liens Projet/Devis/ligne conservés, original intact |
| US-039 | Multi-sélection | Ctrl/Cmd/Shift et rectangle, sélection explicite de cellules visibles |
| US-040 | Batch | déplacer, coller ou annuler un groupe dans une transaction et une commande idempotente |
| US-041 | Peinture | peindre des cellules non contiguës à partir d’un Projet et d’une prestation, sans doublon |
| US-042 | Undo/Redo | création, déplacement, resize et annulation compensés côté serveur avec contrôle de version |
| US-048 | Autosave | états `saving`, `synchronized`, `offline` ; aucune confirmation locale mensongère |
| US-049 | Consommation | vendu, planifié, reste et dépassement calculés par une règle serveur unique |
| US-050 | Mapping | chaque réservation planifiée conserve Projet, Devis, version, ligne et prestation source |
| US-051 | Statut | `unplanned`, `partiallyPlanned`, `compliant`, `overPlanned`, `validated` dérivés du serveur |
| US-052 | Premier complément | premier dépassement crée exactement un complément brouillon par Devis accepté |
| US-053 | Synchronisation | hausse/baisse resynchronisée transactionnellement ; zéro annule le brouillon vide avec audit |
| US-054 | Gel | complément envoyé/accepté jamais réécrit ; un nouveau dépassement crée le numéro suivant |
| US-055 | Base vendue | Devis principal + compléments acceptés constituent la quantité vendue totale |
| US-056 | Non planifiable | stockage, forfaits et frais restent hors complétude Planning |

Sont exclus : réalisé, facturation, encaissement, Finance Engine, optimisation autonome PlanyBot, double option, présence multi-utilisateur et import Excel intelligent. Ils restent ordonnés dans les Sprints 5 à 8.

## 3. Source de vérité et quantités

- Un Devis accepté et ses lignes restent immuables. Aucune mutation Planning ne modifie ses quantités, prix, remises, HT, TVA, TTC ni instantanés.
- Une ligne planifiable possède une unité commerciale versionnée et un mapping explicite. Sa quantité planifiée est la somme des réservations actives reliées, convertie selon l’unité par le serveur.
- `sold = ligne du Devis accepté + lignes correspondantes des compléments acceptés`.
- `remaining = max(sold - planned, 0)` ; `overage = max(planned - sold, 0)`.
- Les réservations `cancelled` ne consomment rien. Les prestations non planifiables ont l’état `nonApplicable` et ne diminuent pas la complétude.
- Le statut global est dérivé des seules lignes planifiables. `validated` exige une validation humaine portant sur le digest courant ; toute mutation ultérieure invalide ce digest.
- Le `QuoteConsumptionEngine` est l’autorité commune de l’API, de PlanyBot et des agrégats. Le frontend ne recalcule pas une règle financière parallèle.

## 4. Mapping Devis → Planning

Toute réservation issue d’un Devis accepté conserve au minimum :

- `projectId` ;
- `sourceQuoteId` ;
- `sourceQuoteVersionId` ;
- `sourceQuoteLineId` ;
- le `sourceId` de prestation ou ressource de la ligne lorsqu’il existe ;
- l’unité de planification et les paramètres calendaires réellement appliqués.

Le serveur vérifie que le Devis est accepté, que sa version est courante, que la ligne appartient au Devis et au Projet, qu’elle est planifiable et que les sites/scopes sont autorisés. Un identifiant deviné hors périmètre répond `404` sans fuite.

## 5. Commande batch atomique

Le contrat canonique est `POST /api/v1/reservations/batch` avec `Idempotency-Key` obligatoire. Le corps contient une liste bornée d’actions homogènes ou mixtes parmi :

- `duplicate` : copier une réservation ou une cellule vers une date/ressource cible ;
- `move` : déplacer une réservation entière avec sa durée ;
- `cancel` : annulation logique ;
- `create` : création issue du mode peinture ;
- `restore` : compensation d’une annulation lorsque la transition et la version le permettent.

La commande prévalide toutes les actions, versions, statuts, droits, scopes, dates, liens commerciaux et conflits sur un état de travail. Elle n’écrit qu’après validation complète. Une erreur retourne l’index de l’action et un code stable ; aucune réservation, commande idempotente, trace d’audit, synchronisation de complément ou émission SSE partielle n’est conservée.

Un rejeu exact restitue le même résultat sans nouvel audit/SSE. Une même clé avec un corps différent retourne `409 IDEMPOTENCY_CONFLICT`. Une réussite produit un audit batch corrélé et les audits métier nécessaires, puis les événements SSE après commit.

## 6. Copier/coller, multi-sélection et peinture

- Le presse-papiers contient des références de cellules et un offset date/ressource, jamais une autorité métier sérialisée.
- Une copie reçoit un nouvel identifiant et conserve Projet, Devis, version et ligne source ; l’original ne change pas.
- La multi-sélection ne peut inclure que des cellules rendues et autorisées. Les actions de lot restent limitées à 200 cellules.
- Le mode peinture exige Projet, prestation planifiable, site, dates et ressources. Une cellule déjà équivalente est signalée avant confirmation ; aucun doublon silencieux n’est créé.
- Chaque preview est sans effet de bord. PlanyBot explique les conflits mais ne confirme aucune mutation.

## 7. Undo/Redo et autosave

Undo/Redo est une compensation serveur, pas une simple pile visuelle. Chaque entrée mémorise commande, résultat, versions avant/après et identifiant d’opération. Une compensation est refusée si l’état courant a divergé ou si la transition est devenue interdite ; l’interface recharge alors l’état serveur.

La pile est bornée à 50 actions par session et vidée lors d’un changement de société. Redo rejoue une nouvelle commande idempotente dérivée de l’action compensée. Les états terminaux et documents commerciaux figés ne sont jamais contournés.

L’indicateur d’autosave signifie :

- `saving` dès l’envoi d’une mutation ;
- `synchronized` uniquement après réponse serveur et intégration du résultat ;
- `offline` si le serveur est inaccessible, sans fallback silencieux localStorage et sans annoncer une réussite.

## 8. Devis complémentaires

- Le premier dépassement d’un Devis accepté crée au plus un complément `draft`, relié au Devis, au Projet et aux lignes sources.
- Tant que ce complément reste brouillon, chaque transaction Planning le synchronise à la hausse ou à la baisse dans la même mutation atomique.
- Le tarif est résolu `projet > client > catalogue`; faute de tarif courant compatible, le prix figé de la ligne source est utilisé et tracé.
- Si le dépassement revient à zéro, le brouillon vide est annulé logiquement et audité.
- Un complément `sent` ou `accepted` est immuable pour la synchronisation automatique. Un dépassement ultérieur crée le complément séquentiel suivant.
- Un complément accepté entre dans `sold`; il ne modifie jamais rétroactivement le Devis principal.

## 9. Sécurité, erreurs et performance

Toute mutation applique auth/session, CSRF/Origin, `planning.write`, société, site, Projet, entités Ressource, version, idempotence, capacité et terminalité. Les dépassements commerciaux exigent les permissions Devis prévues ; un planificateur sans `quote.manage` peut créer la réservation autorisée, mais aucune donnée commerciale sensible ne lui est exposée.

Erreurs stables minimales : `VALIDATION_ERROR`, `VERSION_CONFLICT`, `PLANNING_CONFLICT`, `RESERVATION_TERMINAL`, `BATCH_ACTION_FAILED`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_CONFLICT`, `QUOTE_NOT_ACCEPTED`, `QUOTE_LINE_NOT_PLANIFIABLE`.

Le dataset de référence reste 250 ressources / 10 000 réservations. Une action batch de 100 cellules vise p95 `<250 ms`; le rendu Planning reste interactif `<2 s` et conserve la virtualisation G3.

## 10. Migration et rollback

Tout ajout persistant Sprint 4 est additif et marqué. Avant mutation de données existantes : sauvegarde byte-exacte `0600`, digests source/intégrité, compteurs et reprise idempotente. Le marqueur valide des invariants structurels sans figer les champs métier mutables.

Le rollback exige un export de reprise, refuse un marqueur ou une sauvegarde falsifiés et restaure exactement les octets antérieurs. Les réservations et Devis existants ne sont ni supprimés ni renumérotés silencieusement.

## 11. Incréments DEV

1. **S4-A — Opérations groupées** : US-038 à US-042 et US-048 ; batch atomique, presse-papiers, multi-sélection, peinture, compensation et autosave.
2. **S4-B — QuoteConsumptionEngine** : US-049 à US-051 et US-056 ; moteur canonique, mapping fermé, statuts et digest.
3. **S4-C — Compléments** : US-052 à US-055 ; création/synchronisation/gel/réintégration transactionnels.

Chaque incrément inclut tests positifs, négatifs, RBAC/scopes, idempotence, audit, SSE, absence d’écriture partielle, documentation API et statut.

## 12. Critères Gate G4

G4 est `APPROVED` uniquement si, sur un candidat unique :

- copier/coller et les actions batch ne laissent jamais un demi-résultat ;
- multi-sélection, peinture, undo/redo et autosave fonctionnent par souris et clavier ;
- les liens Projet/Devis/version/ligne restent intacts après copie, move, resize et compensation ;
- l’API, PlanyBot et l’interface donnent les mêmes vendu/planifié/reste/dépassement ;
- les non-planifiables ne bloquent pas la validation ;
- `+5 → +3 → 0` met à jour puis annule exactement le même complément brouillon ;
- un complément envoyé/accepté n’est jamais réécrit et le suivant est séquentiel ;
- replay, conflit, version obsolète, terminalité et scopes échouent sans état partiel ;
- les seuils 250/10 000 et batch 100 sont respectés ;
- REVIEW, QA, SECURITY et PERFORMANCE concluent à zéro P0/P1 ;
- l’E2E navigateur démontre vendu → planifié → dépassement → complément → réduction → reload/redémarrage.
