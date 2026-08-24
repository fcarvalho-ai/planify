# Planify — Planning Post Prod

MVP autonome de gestion de planning pour studio de post-production.

## Démarrer

```bash
npm test
npm start
```

Puis ouvrir <http://localhost:8080>.

## Version candidate V1 — 0.5.0-rc4

Le développement V1 suit l'ordre et le backlog placés dans `docs/specifications/`. Les gates G0 à G8 ainsi que les parcours Integration/E2E sont franchis. Le candidat `0.5.0-rc4` ajoute aux réalisations et au moteur Finance six dashboards adaptés aux rôles, des KPI réconciliables, les exports Planning/KPI Excel et PDF et une API Analytics/BI locale. Il consolide les corrections visuelles RC2/RC3 et corrige l’ouverture du Planning depuis un Projet : les cartes d’une même salle/date restent confinées, la hauteur et le DOM sont bornés, et un index `ressource × créneau` maintient la grille interactive sur 10 000 réservations. Les coûts et marges restent protégés de bout en bout ; les surfaces authentifiées échouent fermées après déconnexion ou expiration de session. Le détail des preuves, limites P2 et empreintes est conservé dans `docs/project-status.md` et les rapports indépendants `docs/code-review.md`, `docs/qa-report.md`, `docs/security-review.md`, `docs/performance-report.md`, `docs/integration-report.md` et `docs/e2e-report.md`.

Le runtime RC1 reste local et autonome. Les contrats V1 sont introduits de façon additive dans `packages/` : erreurs/enveloppes, RBAC et scopes, idempotence, audit, événements, planning, pricing et consommation Devis/Planning. Les décisions structurantes sont dans `docs/adr/` et l'API candidate dans `docs/api/openapi-v1.yaml`.

Commandes de vérification :

```bash
npm run lint
npm run test:foundations
npm test
npm run build
node scripts/generate-performance-dataset.js --output /tmp/planify-performance.json
```

État de référence de la candidate : `npm test` exécute 340 tests. Les fichiers `data/*.json`, `output/` et `tmp/` restent locaux et sont exclus de Git afin qu'aucune donnée de travail, export client ou artefact temporaire n'entre dans la release.

Le générateur produit un jeu déterministe de 250 ressources et 10 000 réservations sur six mois. Il n'écrit jamais dans les données métier sans chemin `--output` explicite.

Compte administrateur de démonstration :

- e-mail : `admin@northlight.fr`
- mot de passe : `demo2026`

L'application ne requiert aucune dépendance npm externe. Le serveur fournit l’API et le frontend, et conserve les données localement dans `data/planify.json`. Si les fichiers statiques sont servis sans API, l’interface bascule explicitement en mode prototype avec stockage navigateur.

## Parc matériel et salles

Dans **Parc matériel**, choisissez **Article**, puis saisissez une marque, un modèle ou un besoin comme `cam`, `Lenovo`, `serveur montage`, `licence Adobe` ou `mail`. L’assistant comprend les synonymes et les fautes légères, propose des références documentées et préremplit fabricant, modèle, référence, suivi et caractéristiques. Ces données restent modifiables et doivent être validées par un responsable matériel.

Après l’article, créez son exemplaire physique avec le numéro de série, le numéro interne éventuel, les coûts, le fournisseur et les dates d’achat ou de garantie. La devise est celle de la société active.

Dans **Ressources**, ouvrez **Équiper la salle**. Seuls les exemplaires disponibles du même site peuvent être installés. L’installation et la dépose créent un mouvement Stock audité ; une salle équipée ne peut pas être supprimée avant la dépose du matériel.

Le catalogue fourni est autonome et versionné : aucune donnée ni image n’est chargée depuis un SaaS ou un CDN à l’exécution. Les photos Lenovo, HP, Dell et Avid sont copiées localement depuis des pages ou documents fabricants ; leur URL source reste affichée. Les droits restent ceux de leurs détenteurs respectifs. Les futurs connecteurs fabricants devront utiliser des sources autorisées et conserver la validation humaine avant enregistrement.

## Rollback de la migration Commercial Review

La migration `commercial-08-review-p1-v3` crée automatiquement une sauvegarde immuable `0600` du fichier JSON avant sa première application. Pour revenir à cette source, arrêtez d’abord le serveur, conservez séparément le fichier courant si des écritures ont eu lieu depuis la migration, puis exécutez depuis le dépôt :

```bash
PLANIFY_DATA_FILE=/chemin/vers/planify.json node -e "console.log(require('./server.js').rollbackCommercialReviewMigration())"
```

Le rollback vérifie le marqueur, le digest de la sauvegarde et l’intégrité de la projection migrée avant restauration. Il restaure exactement l’état antérieur et supprime donc de l’état actif toute écriture réalisée après la sauvegarde. Il doit être accompagné du retour à la version applicative précédente, faute de quoi le code courant réappliquera la migration au prochain démarrage.

### Rollback Sprint 1

Le rollback des quatre migrations Sprint 1 exige un export de récupération distinct avant toute restauration. L’export contient l’état courant complet, est écrit avec des droits `0600`, puis vérifié avant que la sauvegarde antérieure à Sprint 1 soit restaurée octet pour octet :

```bash
PLANIFY_DATA_FILE=/chemin/vers/planify.json node -e "console.log(require('./server.js').rollbackSprint1Migrations({ exportFile: '/chemin/vers/recovery-sprint1.json' }))"
```

Le rollback refuse toute exécution sans export ou si l’un des quatre marqueurs Sprint 1 est absent. Après restauration, remettre en service la version applicative antérieure au Sprint 1 ; sinon le démarrage courant réappliquera les migrations. L’export permet une reprise contrôlée des écritures réalisées depuis le début du Sprint 1.

### Rollback Sprint 5 — ressources avancées

La migration additive Sprint 5 sauvegarde l’état précédent en `0600` avant d’activer les contrats double option et allocation générique. Son rollback exige également un export distinct de l’état courant :

```bash
PLANIFY_DATA_FILE=/chemin/vers/planify.json node -e "console.log(require('./server.js').rollbackSprint5AdvancedResources({ exportFile: '/chemin/vers/recovery-sprint5.json' }))"
```

La restauration retire les données Sprint 5 créées depuis la sauvegarde. Elle doit donc être suivie du retour à la version applicative précédente ; l’export est la source de récupération obligatoire des écritures postérieures.

### Rollback Sprint 6 — propositions PlanyBot

La migration additive PlanyBot sauvegarde l’état précédent en `0600`. Son rollback exige un export distinct, vérifié et privé de l’état courant avant toute restauration byte-exacte :

```bash
PLANIFY_DATA_FILE=/chemin/vers/planify.json node -e "console.log(require('./server.js').rollbackSprint6PlanyBot({ exportFile: '/chemin/vers/recovery-sprint6-planybot.json' }))"
```

Après restauration, remettre en service une version antérieure au Sprint 6 ; sinon le runtime courant réappliquera la migration au démarrage. Les réservations déjà exécutées après confirmation humaine restent des opérations métier à rapprocher depuis l’export et ne sont jamais supprimées silencieusement.

### Rollback Sprint 7 — réalisations et Finance

Les trois migrations Sprint 7 doivent être retirées dans l’ordre inverse de leur application : Occupation, Finance, puis Réalisations. Chaque commande exige un export privé distinct de l’état courant avant la restauration byte-exacte :

```bash
PLANIFY_DATA_FILE=/chemin/vers/planify.json node -e "console.log(require('./server.js').rollbackSprint7Occupancy({ exportFile: '/chemin/vers/recovery-s7-occupancy.json' }))"
PLANIFY_DATA_FILE=/chemin/vers/planify.json node -e "console.log(require('./server.js').rollbackSprint7Finance({ exportFile: '/chemin/vers/recovery-s7-finance.json' }))"
PLANIFY_DATA_FILE=/chemin/vers/planify.json node -e "console.log(require('./server.js').rollbackSprint7Actuals({ exportFile: '/chemin/vers/recovery-s7-actuals.json' }))"
```

Chaque export doit utiliser un chemin neuf et distinct des données actives. Après restauration, remettre en service une version antérieure au Sprint 7 ; sinon le runtime courant réappliquera les migrations au prochain démarrage. Les exports restent la source de reprise des réalisations, coûts, dépenses et seuils créés depuis les sauvegardes.

### Rollback Sprint 8 — dashboards et exports

Le Sprint 8 n’ajoute aucune migration de données : dashboards, API Analytics/BI et exports sont des lectures dérivées des données existantes. Pour revenir à `0.4.0-rc1`, arrêter le serveur, conserver une copie privée du fichier de données courant, remettre en service le code et les actifs de `0.4.0-rc1`, puis redémarrer avec le même `PLANIFY_DATA_FILE`. Les données G7 restent compatibles ; les routes, exports et surfaces G8 disparaissent avec le retour applicatif. Vérifier ensuite connexion, Planning, Réalisations et Finance avant réouverture aux utilisateurs.
