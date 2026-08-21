# Environnements V1

| Environnement | Données | Réseau | Usage |
|---|---|---|---|
| dev | fichier JSON local ignoré | loopback | développement et smoke |
| test | fichier temporaire par suite | loopback éphémère | tests déterministes |
| staging | copie anonymisée/seed V1 | accès explicitement borné | gates d'intégration/E2E |

Variables supportées : `PORT`, `PLANIFY_DATA_FILE`, `PLANIFY_ALLOWED_ORIGINS`, `PLANIFY_ALLOW_ORIGINLESS_MUTATIONS`, `PLANIFY_SSE_REVALIDATE_MS`, `NODE_ENV`. Aucun secret n'est commité. Le démarrage doit rester autonome et sans SaaS/CDN.

La production n'est pas créée par simple renommage de staging. Elle exige la décision d'hébergement, la persistance transactionnelle, le stockage de secrets, les sauvegardes, le monitoring et le rollback de release.
