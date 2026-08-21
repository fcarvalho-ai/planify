# Performance report — Organisation 01 / 01b

Date : 2026-08-14  
Candidat final : `server.js` SHA-256 `a5807cf8a3a64d1b28959f78dde741cad453fca79b076746a4ec59b9d00e7d7c`, `app.js` SHA-256 `bc7cff11e527652846a162d6fc048cde184b17f3db54f079c1f222f0d58ad1f9`  
Verdict : **APPROVED — calcul serveur et HTTP conformes**

## Résultats disponibles

- Suite complète finale : `npm test`, **82/82**, 0 échec/skip, durée totale **6 425 ms**, Node `v26.6.0`, Darwin arm64. La projection de confidentialité ajoutée après le benchmark ne modifie pas les parcours `readDb()` + complétude mesurés ci-dessous.
- Inspection : les lectures Organisation filtrent des tableaux en mémoire et la persistance reste un fichier JSON lu à chaque requête; aucune dépendance réseau ni traitement quadratique nouveau évident n'a été relevé sur les DTO fiscaux.
- Jeu court préparé sans modifier le dépôt : **5 sociétés, 4 contextes actifs pour l'administrateur et 125 entités Organisation** (25 sites, 25 unités, 75 prestations; 28/25/75 avec le seed).
- Benchmark sans socket, après 20 échauffements : 500 cycles `readDb()` + calcul de complétude des 5 sociétés, **p50 0,494 ms, p95 0,885 ms, max 16,245 ms** sur Node `v26.6.0`, Darwin arm64. La volumétrie de 125 entités n'introduit donc aucun signal de saturation du cœur lecture/complétude.
- Benchmark HTTP final sur une instance et un fichier de données isolés, après 10 échauffements : 100 listes sociétés, **p50 1,061 ms, p95 1,574 ms, max 1,891 ms** ; 30 mutations Organisation avec écriture atomique, **p50 2,524 ms, p95 3,214 ms, max 3,215 ms**. Toutes les réponses ont réussi et les seuils contractuels (`< 300 ms` lecture, `< 250 ms` écriture) sont très largement respectés.

## Limite résiduelle non bloquante

- La performance UI complète sur appareil bas de gamme n'est pas automatisée. Le smoke navigateur local de l'assistant O1 reste fluide et navigable, mais ce constat ne remplace pas une campagne front dédiée lors du gate E2E produit.

## Conclusion

P0/P1 performance observé : **0**. Les mesures cœur, HTTP et écriture atomique sont approuvées sur le jeu demandé. Le gate Performance Organisation 01/01b est **APPROVED** ; la campagne UI multi-appareils demeure un contrôle E2E non bloquant pour ce gate serveur.
