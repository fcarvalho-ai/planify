# ADR-002 — Temps et calendrier

Statut : adopté — 2026-08-19

Les instants sont persistés en UTC ISO 8601. Les sites portent un fuseau IANA. Les intervalles sont semi-ouverts `[début, fin)`, donc deux périodes adjacentes ne se chevauchent pas. Une date locale n'est jamais convertie avec un offset fixe. Week-ends et jours fériés sont des politiques explicites ; ils ne changent pas silencieusement une durée vendue. Les changements DST font partie des tests du moteur.

## Règles normatives

| Sujet | Règle V1 |
|---|---|
| Journée commerciale | Une journée vendue correspond à une date civile du fuseau IANA du site. Sa durée de référence est définie par les horaires du site ; elle ne vaut jamais implicitement 24 heures. |
| Demi-journée | Une demi-journée vaut exactement `0,5` journée commerciale. Elle doit être explicitement saisie ; elle n'est pas déduite d'une heure de début ou de fin. |
| Heures | Une quantité horaire est la durée réelle entre les deux instants UTC. Une transition DST peut donc produire 23 ou 25 heures pour une plage civile couvrant le changement. |
| Week-end | Samedi et dimanche sont exclus uniquement lorsque `includeWeekends=false`. Ils restent visibles au planning et ne sont jamais retirés silencieusement d'une réservation. |
| Jour férié | Un jour férié provient du calendrier versionné du site. Il est exclu d'un calcul de jours ouvrés, mais ne supprime ni ne déplace une réservation existante. |
| Intervalle | Toutes les disponibilités et capacités utilisent `[startsAt, endsAt)`. Deux intervalles dont la fin du premier égale le début du second sont adjacents, sans conflit. |
| Heure locale inexistante | Une saisie située dans le saut DST est refusée avec `LOCAL_TIME_NONEXISTENT`; aucune correction automatique n'est appliquée. |
| Heure locale ambiguë | Une saisie située dans le repli DST exige l'offset explicite ou le choix de l'occurrence ; sans ce choix elle est refusée avec `LOCAL_TIME_AMBIGUOUS`. |

## Exemples de référence — Europe/Paris

- `2026-03-29T00:00:00+01:00` → `2026-03-29T04:00:00+02:00` représente **3 heures réelles**.
- `2026-10-25T00:00:00+02:00` → `2026-10-25T04:00:00+01:00` représente **5 heures réelles**.
- Vendredi 21 août → lundi 24 août inclus représente 2 jours commerciaux avec week-end exclu, et 4 dates civiles avec week-end inclus.
- Si le 19 août est férié dans le calendrier du site, une semaine lundi–vendredi contient 4 jours ouvrés ; une réservation existante le 19 reste néanmoins intacte.

Le frontend envoie toujours des instants avec offset. Le serveur persiste leur instant UTC et conserve le fuseau du site comme contexte de présentation et de calcul civil.
