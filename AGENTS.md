# AGENTS.md — Contrat de contribution

Ce fichier s'applique à tout le dépôt. Tout agent doit le lire avant d'agir. Les instructions explicites du Product Owner (PO) priment ; ensuite viennent ce fichier, `docs/spec-mvp.md`, `docs/architecture.md`, puis les conventions locales du code. Une contradiction doit être signalée dans `docs/project-status.md` et résolue sans réécrire silencieusement la spécification.

## 1. État réel et cible d'architecture

Le produit est un planning local de post-production, livré en `0.1.0-rc1`.

- **Implémentation actuelle** : monolithe Node.js/CommonJS sans dépendance npm externe ; `server.js` sert l'API HTTP, le SSE et les fichiers statiques ; `app.js` porte l'interface navigateur ; les données sont persistées atomiquement dans `data/planify.json`.
- **Cible documentée** : monolithe modulaire TypeScript/React/SQLite décrit dans `docs/architecture.md`.
- La cible n'autorise pas une migration implicite. Toute migration de stack ou de persistance exige une spécification approuvée, un plan de migration/rollback, puis le workflow complet de gates ci-dessous.
- Le runtime doit rester local, reproductible et autonome : aucun SaaS, CDN, actif distant, télémétrie ou accès réseau requis à l'exécution.

Flux logique à préserver :

```text
index.html + styles.css/planning.css + app.js
        -> API JSON /api/v1 + SSE /api/v1/events
        -> server.js (auth, RBAC, métier, audit, persistance)
        -> data/planify.json (RC1 uniquement)
```

Les invariants métier de `docs/spec-mvp.md` et les contrats de `docs/architecture.md` restent les références : intervalles semi-ouverts `[début, fin)`, capacité cumulée, annulation logique, contrôle optimiste par `version`, override motivé et audité, isolation société/site.

## 2. Ownership par chemins et modules

L'ownership signifie « responsable de cohérence et de validation », pas droit de modifier seul des contrats transverses.

| Chemin | Ownership principal | Contrôles obligatoires |
|---|---|---|
| `docs/spec-mvp.md`, `docs/ux-flows.md` | Produit / spécification | périmètre, règles métier, critères d'acceptation, décision PO si changement produit |
| `docs/architecture.md` | Architecture / contrats | dépendances, API, données, ADR ou justification de toute divergence |
| `server.js` | Backend / API / domaine | validation, RBAC, isolation, transactions/mutations, audit, SSE, erreurs stables |
| `app.js` | Frontend / client API | permissions visibles et serveur, états UI, accessibilité, conflits, concurrence, absence de fail-open |
| `index.html` | Shell frontend | structure sémantique, formulaires, focus, chargement des actifs locaux |
| `styles.css`, `planning.css` | UI / design system | responsive, focus visible, contraste, statuts non fondés sur la couleur seule |
| `data/.gitkeep`, `data/planify.json` | Persistance / intégration | format compatible, seed local non sensible, atomicité ; ne pas utiliser les données de travail comme fixture mutable |
| `tests/domain.test.js` | Domaine / planning | invariants, capacité, statuts, temps, dashboard |
| `tests/api.test.js` | API / intégration / sécurité | contrats, erreurs, auth, CSRF, RBAC, isolation, audit, SSE et fichiers statiques |
| `package.json`, `README.md`, `CHANGELOG.md` | Intégration / release | commandes exactes, version, procédure de démo et rollback |
| `docs/qa-*`, `docs/code-review.md`, `docs/security-review.md`, `docs/performance-report.md` | Reviewer indépendant correspondant | preuves datées, périmètre testé, verdict explicite et limites |
| `docs/project-status.md` | Agent intégrateur en cours | source de vérité opérationnelle après chaque changement matériel |
| `AGENTS.md` | Gouvernance | workflow, ownership et règles communes |

Un changement transversal (contrat API, modèle de données, auth, planning, dashboard) a au minimum deux owners : le module modifié et ses tests/consommateurs. L'auteur ne peut pas rendre seul le verdict indépendant `APPROVED` de sa propre modification.

## 3. Workflow obligatoire, sans saut de gate

Toute évolution suit dans cet ordre :

```text
SPEC -> DEV -> REVIEW -> QA -> SECURITY/PERFORMANCE
     -> INTEGRATION -> E2E -> RELEASE
```

Une correction issue d'un gate revient à **DEV**, puis repasse le gate qui l'a trouvée et tous les gates aval impactés. Un ancien rapport `APPROVED` ne couvre jamais automatiquement du code modifié après sa date.

### Gate SPEC

- Relire `docs/spec-mvp.md`, `docs/architecture.md` et `docs/project-status.md`.
- Définir périmètre inclus/exclu, critères d'acceptation testables, impacts API/données/UI/sécurité/performance et rollback.
- En cas de divergence cible/RC1, écrire explicitement laquelle est conservée.
- Sortie : spécification non ambiguë et entrées de statut identifiées. Aucun développement sur une décision produit réellement ouverte.

### Gate DEV

- Prendre ownership explicite des fichiers avant édition ; limiter le diff au périmètre convenu.
- Implémenter les tests automatisables avec le code, y compris les cas négatifs.
- Respecter les contrats et ne pas masquer une erreur par un fallback prototype.
- Sortie : syntaxe valide, tests ciblés verts, aucun secret ni artefact temporaire, documentation technique impactée prête.

### Gate REVIEW

- Revue indépendante du diff et de ses consommateurs : exactitude, régressions, lisibilité, compatibilité, erreurs, accessibilité et tests manquants.
- Classer les constats `P0` critique, `P1` bloquant release, `P2` important non bloquant, `P3` amélioration.
- Sortie : `APPROVED` uniquement si aucun P0/P1 ouvert ; constats et preuves consignés dans `docs/code-review.md`.

### Gate QA

- Exécuter les tests ciblés puis `npm test` sur un état propre et déterministe.
- Vérifier critères fonctionnels, cas limites, erreurs, permissions et non-régression. Aucun test désactivé ou résultat annoncé sans commande réellement exécutée.
- Sortie : rapport `docs/qa-report.md` daté avec commande, environnement, total succès/échecs et verdict ; zéro échec pour `APPROVED`.

### Gate SECURITY / PERFORMANCE

- **Sécurité** : threat-check des entrées, auth/session/CSRF, RBAC serveur, isolation société/site, XSS, exposition statique, secrets/logs, abus et dépendances. Toute vulnérabilité critique/élevée bloque.
- **Performance** : mesurer les chemins affectés avec un jeu représentatif ; pour le planning, référence 100 ressources/10 000 réservations, lecture API p95 `< 300 ms`, conflit + écriture p95 `< 250 ms`, UI exploitable `< 2 s` et interactive.
- Sortie : verdicts indépendants et limites explicites dans `docs/security-review.md` et `docs/performance-report.md`. Si un axe est objectivement non impacté, documenter l'analyse d'impact plutôt que fabriquer une mesure.

### Gate INTEGRATION

- Rejouer le parcours complet avec frontend, API, persistance et SSE ; vérifier contrats aller/retour, données existantes, démarrage local et absence d'accès réseau requis.
- Résoudre les collisions de fichiers et confirmer que la branche/intégration contient tous les correctifs approuvés, sans changements étrangers.
- Sortie : `npm test` vert et smoke local documenté.

### Gate E2E

- Sur données de démonstration déterministes, valider au minimum : connexion ; client/projet/ressource ; création multi-ressources ; déplacement ; redimensionnement ; conflit et override motivé ; annulation ; filtres ; dashboard vers planning ; permissions lecteur ; actualisation SSE.
- Tester par l'interface, pas seulement l'API, avec persistance après rechargement/redémarrage pour les parcours concernés.
- Sortie : preuves reproductibles, résultat attendu/observé et aucun P0/P1 ouvert.

### Gate RELEASE

- Tous les gates précédents portent sur le même état candidat.
- Mettre à jour version, `CHANGELOG.md`, `README.md`, procédure de démo/rollback et `docs/project-status.md`.
- Vérifier démarrage et suite complète. La release est bloquée par : test rouge, P0/P1, vulnérabilité critique/élevée, perte/corruption de données, rollback absent, statut documentaire faux ou critère Gate 01 non démontrable.
- Seul le PO valide les choix d'interface/expérience métier ; les agents valident la qualité technique.

## 4. Règles de non-interruption du Product Owner

Les agents avancent de manière autonome sur toute décision technique réversible comprise dans le périmètre approuvé. Ils ne sollicitent pas le PO pour choisir une implémentation, répartir le travail, résoudre un test, arbitrer un style interne ou confirmer une étape déjà spécifiée.

Avant toute question au PO, les agents doivent : lire les documents et le code concernés, rechercher les décisions existantes, consulter l'owner du module, tester l'hypothèse la plus sûre et consigner l'incertitude. En attendant une réponse non bloquante, poursuivre les tâches indépendantes.

Interrompre le PO seulement si au moins un cas est avéré :

1. deux interprétations produit incompatibles modifient visiblement le comportement ou le périmètre ;
2. une action destructive/irréversible, une migration de données ou un rollback avec perte exige son autorisation ;
3. des identifiants, droits externes, données ou décisions métier indisponibles sont indispensables ;
4. une contrainte légale, sécurité critique ou risque pour des données réelles impose l'arrêt ;
5. le même blocage externe empêche toute progression sûre malgré les alternatives documentées.

La question doit être unique, courte et accompagnée de : faits vérifiés, option recommandée, impact des alternatives et travail poursuivable sans réponse. Une préférence cosmétique n'est jamais un blocage technique.

## 5. Commandes et preuves

Commandes contractuelles de la RC1 :

```bash
npm test                 # suite Node complète
npm start                # application sur http://localhost:8080
node --check server.js   # syntaxe backend
node --check app.js      # syntaxe frontend
```

- Node.js `>=20`. Aucune installation de dépendance n'est nécessaire dans l'état actuel.
- Ne pas inventer `lint`, `build`, `db:migrate`, `db:seed` ou des sous-suites npm absentes de `package.json`. Ajouter un script seulement si l'évolution l'exige, avec documentation et test du script.
- Pour un smoke, lancer le serveur sur un port disponible, vérifier la page, l'auth/API affectée et l'arrêt propre. Ne pas laisser de processus ou fichier temporaire.
- Une preuve contient : commande exacte, date, environnement/version Node, résultat, nombre de tests et limites. Ne jamais affirmer qu'un gate passe sans preuve fraîche sur l'état testé.

## 6. Conventions de code et contrats

- Conserver CommonJS et les API natives Node tant qu'une migration n'est pas approuvée ; favoriser des fonctions courtes, pures pour le domaine, et des validations serveur centralisées.
- JSON UTF-8, champs `camelCase`, routes versionnées `/api/v1`, dates ISO 8601 avec offset à l'entrée et instants UTC en persistance. Identifiants opaques.
- Réponses d'erreur stables : `{ error: { code, message, details?, requestId } }`. Ne pas exposer stack, existence d'un autre tenant ou détail d'authentification.
- Toute mutation sensible exige validation, autorisation serveur, périmètre société/site, contrôle de `version` quand applicable, écriture atomique, audit, puis invalidation SSE **après** succès.
- Une réservation `option` ou `confirmed` consomme la capacité ; `cancelled` ne la consomme pas. Une réservation active a au moins une ressource ; toutes appartiennent au même site/société.
- Ne pas dupliquer une règle métier divergente entre `app.js` et `server.js` : le serveur reste l'autorité ; la validation UI sert au feedback.
- Échapper toute donnée injectée dans le DOM, préserver focus visible/navigation clavier et ne jamais coder un statut uniquement par couleur.
- Pas de refactor opportuniste, changement de format ou dépendance nouvelle hors périmètre. Tout comportement modifié reçoit un test de non-régression.

## 7. Sécurité non négociable

- Aucun secret, cookie, jeton, mot de passe réel, donnée client libre ou contenu sensible dans le dépôt, les logs, rapports ou captures.
- Mots de passe hachés de façon adaptative ; comparaison/auth non discriminante ; sessions opaques `HttpOnly`, `SameSite=Lax`, `Secure` hors localhost, rotation et expiration.
- CSRF et contrôle strict d'origine sur toute mutation ; permissions et périmètres vérifiés côté serveur à chaque cas d'usage.
- `companyId` vient de la session, jamais de l'autorité du client. Les identifiants devinés d'un autre tenant doivent rester inaccessibles.
- Entrées structurées validées et bornées ; sorties HTML échappées ; aucun chemin utilisateur ne sélectionne directement un fichier statique.
- La liste blanche des fichiers statiques doit rester explicite. Ne jamais servir `data/`, `.git/`, sources serveur, tests, docs, variables d'environnement ou fichiers arbitraires.
- Le mode prototype/localStorage reste explicitement opt-in et ne doit jamais devenir un fallback silencieux après erreur API/auth.
- Toute dépendance nouvelle doit être justifiée, verrouillée, vérifiée et compatible avec l'exécution locale hors ligne.

## 8. Coordination multi-agents, fichiers et branches

- Avant d'éditer, annoncer dans le canal d'équipe : rôle, chemins pris en charge, critères de sortie. Un seul writer par fichier à un instant donné.
- Découper le travail par ownership de chemins. Pour un contrat partagé, désigner un owner de contrat ; les autres agents adaptent leurs consommateurs après publication du contrat.
- Ne jamais écraser, restaurer ou nettoyer le travail d'un autre agent. Inspecter l'état avant chaque patch ; si un fichier partagé change pendant le travail, suspendre l'édition, synchroniser avec son owner et réappliquer un diff minimal.
- Utiliser des patches ciblés. Éviter les reformattages globaux et fichiers générés qui créent des collisions. Ne modifier que les fichiers annoncés.
- Si Git est disponible : une branche/worktree par lot (`agent/<role>-<sujet>`), commits petits et mono-intention, pas de force-push, reset destructif, rebase d'une branche d'autrui ni merge non autorisé. Si Git n'est pas initialisé, appliquer les mêmes règles par ownership et journal de statut ; ne pas initialiser Git sans demande.
- L'intégrateur seul assemble les lots, résout les conflits avec les owners, exécute les gates aval et fige l'état candidat. Les reviewers ne corrigent pas silencieusement le code qu'ils approuvent : ils rendent des constats au développeur.
- Tout handoff indique : fichiers modifiés, décisions, commandes exécutées/résultats, risques, TODO et statut du gate. Aucun agent ne déclare le projet entier terminé sur la seule base de son sous-lot.

## 9. Mise à jour obligatoire de `docs/project-status.md`

Après chaque changement matériel ou verdict de gate, l'agent responsable met à jour `docs/project-status.md` dans le même lot :

- date et version candidate si elles changent ;
- ligne du module : état réel (`À faire`, `En cours`, `Intégré`, `Approved`, `Bloqué`), owner, preuve de test, dépendances/blocages ;
- décisions d'architecture/release nouvelles et divergences temporaires ;
- commande et résultat frais pertinents.

Ne jamais conserver `Approved` si le code couvert a changé sans revalidation. Ne pas supprimer un risque : le fermer avec sa preuve ou le laisser visible. Éviter les pourcentages subjectifs. Un statut bloqué nomme le blocage, son owner et la condition de déblocage.

Exception : une tâche explicitement limitée à un seul fichier respecte cette limite et mentionne dans son handoff la mise à jour de statut restant à faire par l'intégrateur.

## 10. Definition of Done d'un lot

Un lot est prêt à intégrer seulement si : périmètre et critères couverts ; diff minimal ; tests ciblés et `npm test` verts ; sécurité et compatibilité analysées ; documentation et statut à jour ; aucun P0/P1 ouvert ; données/rollback protégés ; handoff reproductible. « Fonctionne chez moi », un smoke API seul ou un ancien rapport ne suffit pas.
