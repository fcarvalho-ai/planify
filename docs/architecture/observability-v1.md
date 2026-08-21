# Observabilité et erreurs V1

## Corrélation

Chaque requête reçoit un identifiant opaque. Le contrat V1 le nomme `error_id` dans toute erreur et `request_id` dans `meta`. Durant la compatibilité RC1, `requestId` reste présent avec la même valeur.

## Logs

Logs JSON locaux : date UTC, `requestId`, méthode, route normalisée, statut, durée millisecondes. Sont interdits : cookies, CSRF, mots de passe, contenu de fichiers importés, texte libre client et identifiants fiscaux complets.

## Mesures minimales

- compte et latence des routes API ;
- nombre de mutations réussies/refusées par code stable ;
- clients SSE ouverts/fermés et révocations ;
- temps SchedulingEngine/PricingEngine/QuoteConsumptionEngine ;
- taille du journal d'événements et retard de rejeu.

Le runtime local n'envoie aucune télémétrie. Les métriques restent en mémoire ou dans les rapports de test jusqu'à une décision d'exploitation approuvée.
