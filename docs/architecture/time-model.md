# Modèle temporel V1

Statut : candidat Gate G0 — 2026-08-19  
Décision normative : `docs/adr/ADR-002-temps-et-calendrier.md`

- Un instant est persisté en UTC ; une saisie datetime exige un offset explicite.
- Chaque site porte un fuseau IANA, notamment `Europe/Paris`.
- Un intervalle est semi-ouvert `[startsAt, endsAt)` : la fin d’une réservation peut être le début de la suivante.
- Une période en jours utilise des dates civiles ; le passage été/hiver ne vaut jamais implicitement 24 heures.
- `includeWeekends` est explicite. Les jours fériés sont transmis comme politique, jamais déduits silencieusement.
- Les quantités vendues et les cellules planning sont distinctes : un changement de calendrier ne réécrit pas un devis accepté.

Les tests de fondation couvrent lundi→vendredi, vendredi→lundi, week-end inclus/exclu, jour férié, passage à l’heure d’été et passage à l’heure d’hiver.
