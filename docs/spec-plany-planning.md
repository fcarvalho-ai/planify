# Spécification — PlanyBot, assistant du Planning

Version : 0.1 — 2026-08-17  
Statut : SPEC prête pour DEV

## 1. Objectif

PlanyBot est l’assistant conversationnel intégré au module Planning. Il aide un planificateur à comprendre l’état du planning et à préparer une action, sans jamais créer, déplacer, modifier ou annuler une réservation de sa propre initiative.

Le premier incrément fonctionne entièrement en local, sans SaaS, CDN, modèle distant ni transfert de données hors de l’application.

## 2. Périmètre inclus

- aide contextuelle et exemples de questions ;
- recherche de salles disponibles sur une période ;
- résumé d’un projet accessible et de ses réservations ;
- détection et explication des conflits visibles par l’utilisateur ;
- préparation d’une demande de réservation à partir d’une phrase ;
- accompagnement conversationnel des cinq phases d’analyse d’un planning client ;
- action UI « Préparer dans le planning » qui préremplit le formulaire existant ;
- conversations persistées par société et par utilisateur ;
- RBAC `planning.read`, isolation société/site, audit sans contenu libre sensible ;
- idempotence des messages envoyés.

## 3. Hors périmètre

- création ou mutation automatique de réservation ;
- arbitrage automatique d’un conflit ou override ;
- envoi d’e-mail, notification externe ou accès Internet ;
- analyse sémantique par un LLM distant ;
- chatbot client ou support généraliste ;
- apprentissage sur les messages.

## 4. Principes non négociables

1. Le serveur est l’autorité pour les permissions et les données visibles.
2. `companyId` vient exclusivement de la session.
3. Un site non autorisé, un projet étranger ou un identifiant deviné ne doit jamais être révélé.
4. Une réponse de PlanyBot peut contenir une proposition, jamais une réservation créée.
5. Toute proposition doit être confirmée dans le formulaire Planning normal, avec les contrôles de disponibilité, conflit, capacité, version et override existants.
6. Les messages ne sont pas copiés dans l’audit ni diffusés par SSE.
7. L’interface rappelle explicitement : « PlanyBot prépare, vous confirmez. »

## 5. Données

### `planyConversations`

```json
{
  "id": "planyConversation_opaque",
  "companyId": "company_eliote_props_prod",
  "userId": "user_admin",
  "projectId": "project_optional",
  "siteId": "site_optional",
  "createdAt": "2026-08-17T12:00:00.000Z",
  "updatedAt": "2026-08-17T12:00:00.000Z"
}
```

### `planyMessages`

```json
{
  "id": "planyMessage_opaque",
  "conversationId": "planyConversation_opaque",
  "companyId": "company_eliote_props_prod",
  "userId": "user_admin",
  "role": "user|assistant",
  "intent": "help|availability|projectSummary|conflicts|bookingDraft|clientPlanningGuide",
  "content": "Texte borné",
  "facts": {},
  "actions": [],
  "createdAt": "2026-08-17T12:00:00.000Z"
}
```

### `planyIdempotency`

Le replay d’une même clé, pour le même utilisateur, la même société et le même corps, retourne exactement le même résultat sans doubler les messages. Une clé réutilisée avec un autre corps retourne `409 IDEMPOTENCY_CONFLICT`.

Limites : 800 caractères par message, 50 messages par conversation, 20 conversations conservées par utilisateur et société.

## 6. API

### `POST /api/v1/plany/messages`

Permission : `planning.read`. Mutation protégée par session, Origin et CSRF. En-tête `Idempotency-Key` obligatoire.

Entrée :

```json
{
  "message": "Quelles salles de mixage sont libres du 18/08/2026 au 20/08/2026 ?",
  "conversationId": null,
  "context": {
    "projectId": "project_optional",
    "siteId": "site_optional",
    "from": "2026-08-18",
    "to": "2026-08-20"
  }
}
```

Sortie :

```json
{
  "conversationId": "planyConversation_opaque",
  "intent": "availability",
  "assistantMessage": "3 salles de mixage sont disponibles…",
  "facts": {},
  "actions": []
}
```

Erreurs stables : `VALIDATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `CONVERSATION_LIMIT`, `IDEMPOTENCY_CONFLICT`.

### `GET /api/v1/plany/conversations/:id/messages`

Permission : `planning.read`. Retourne uniquement une conversation appartenant à l’utilisateur courant dans sa société active.

## 7. Intentions

### Disponibilités

PlanyBot reconnaît les familles montage/AVID/remote, mixage/Pro Tools, étalonnage/DaVinci et PAD. Il utilise les cellules effectives du planning, y compris les déplacements unitaires, et exclut les réservations annulées.

### Résumé projet

Le projet provient d’abord du contexte actif, sinon d’une correspondance explicite dans le texte. Le résumé comprend période, nombre de réservations, journées planifiées et ressources, dans les seuls sites autorisés.

### Conflits

PlanyBot signale les chevauchements de cellules sur une même ressource et les réservations concernées. Il n’effectue aucun override.

### Préparation de réservation

PlanyBot extrait autant que possible le projet, le type de salle et les dates. Il retourne une action `prepareBooking`. Si une donnée obligatoire manque, il la demande au lieu d’inventer une valeur.

### Guide d’analyse du planning client

Avec le contexte `workflow: clientPlanning`, PlanyBot accompagne les phases `upload`, `analyzing`, `compare`, `availability` et `confirmation`. Le serveur relit le devis et l’analyse dans la société et les sites autorisés ; il ne fait jamais confiance à un résumé fourni par le navigateur. PlanyBot explique les correspondances, les lignes ambiguës ou inconnues, la vérification des disponibilités et la confirmation finale. Ce dialogue ne crée et ne modifie aucune réservation.

Dans ce parcours, PlanyBot utilise une fenêtre flottante en bas de l’écran, visuellement distincte du tiroir d’import restauré dans sa forme simple. La fenêtre peut être réduite et rouverte sans perdre les messages de la session.

## 8. UX et accessibilité

- bouton flottant « PlanyBot » uniquement dans le Planning ;
- panneau latéral nommé « PlanyBot — Assistant Planning » ;
- historique lisible, questions rapides et champ de saisie ;
- réponse chargée annoncée via `aria-live` ;
- fermeture par bouton et Échap, focus restauré au déclencheur ;
- actions accessibles au clavier ;
- aucune information d’état portée par la couleur seule ;
- avertissement permanent sur la confirmation humaine.

## 9. Critères d’acceptation

1. Une personne non connectée reçoit 401 et un rôle sans `planning.read` reçoit 403.
2. Les disponibilités ne comprennent aucune ressource d’une autre société ou d’un site interdit.
3. Une question de disponibilité ne modifie aucune réservation.
4. Un résumé de projet inaccessible ne révèle pas son existence.
5. Les conflits sont calculés sur les cellules effectives et les intervalles semi-ouverts.
6. Une demande « réserve » produit uniquement une proposition et laisse le formulaire non soumis.
7. Un replay idempotent ne crée pas de messages supplémentaires.
8. Les messages utilisateur sont échappés dans l’interface et absents des audits/SSE.
9. Le panneau est utilisable au clavier et se ferme par Échap avec restauration du focus.
10. L’application fonctionne hors ligne, sans dépendance nouvelle.
11. Pendant l’import d’un planning client, PlanyBot explique chaque phase et une question utilisateur ne provoque aucune mutation Planning.

## 10. Rollback

Le lot est additif. Le rollback applicatif consiste à retirer les deux routes et le panneau PlanyBot ; les trois collections peuvent rester ignorées sans affecter Planning, Devis ou Réservations. Aucune migration destructrice ni réécriture des données existantes n’est autorisée.
