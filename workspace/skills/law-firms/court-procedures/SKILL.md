---
name: court-procedures
description: "Track Luxembourg court filing requirements, procedural steps, and hearing schedules"
metadata:
  klawty:
    emoji: "🏛️"
---

# Court Procedures

Manages procedural requirements for Luxembourg courts — filing deadlines, document formats, service requirements, and hearing schedules. Covers the Tribunal d'Arrondissement, Justice de Paix, Cour Superieure de Justice, and specialized jurisdictions (Tribunal du Travail, Tribunal Administratif).

## Musts

- Never miss a procedural deadline — late filings can result in irrecevabilite (inadmissibility) or forclusion (time-bar). Luxembourg courts are strict on procedure.
- Always verify which court has jurisdiction before filing — subject matter (ratione materiae) and territorial (ratione loci) jurisdiction must both be satisfied.
- Never file a document without the required number of copies — Luxembourg courts require original + copies for each party (nombre de roles).
- Always include the RCS number when a party is a legal entity — the court will reject filings with incomplete party identification.

## Guidelines

- Justice de Paix: claims up to 15,000 EUR, employment disputes (Tribunal du Travail), lease disputes. Simpler procedure, no mandatory avocat for claims under 10,000 EUR.
- Tribunal d'Arrondissement: claims above 15,000 EUR, corporate disputes, IP matters. Mandatory representation by an avocat a la Cour.
- Refere (urgent interim measures): same-day or next-day hearings available. File with the President of the competent court. Standard of proof: urgence + absence de contestation serieuse or dommage imminent.
- Appeal deadlines: 40 days from notification for civil matters, 3 months for administrative matters. Missing the appeal deadline is fatal.
- Luxembourg uses the "assignation" system (service by huissier de justice) to commence civil proceedings, not simple filing.

## Common Actions

### Prepare a court filing

Call `prepare_filing` with case type, court, parties, and claims. Generate the required documents: assignation/requete, supporting exhibits (pieces), legal argument (conclusions), and power of attorney (if applicable). Verify copy count and format requirements.

### Track procedural deadlines

Call `get_case_deadlines` to list all active cases with upcoming procedural dates: filing deadlines, hearing dates, evidence submission cutoffs, and appeal windows. Flag any deadline within 10 business days without a prepared filing.

### Monitor hearing schedule

Call `get_hearing_calendar` for upcoming hearings across all active cases. Include: date, time, court, chamber, judge (if known), case reference, and preparation status. Alert 5 days before each hearing to confirm preparation is complete.
