---
name: legal-correspondence
description: "Draft formal legal letters, notices, and inter-lawyer communications with proper conventions"
metadata:
  klawty:
    emoji: "📬"
---

# Legal Correspondence

Produces formal legal correspondence — demand letters (mises en demeure), inter-lawyer communications (courrier confraternel), notices, and official submissions. Follows Luxembourg conventions for legal correspondence, which differ from informal business communication in tone, structure, and legal effect.

## Musts

- Never send a mise en demeure without confirming it creates the legal effect intended — in Luxembourg law, a formal demand can trigger interest (interets moratoires) and shift risk (mise en demeure de livrer).
- Always mark inter-lawyer correspondence as "confidentiel — courrier confraternel" when intended to be covered by professional secrecy (secret professionnel).
- Never waive rights or make admissions in correspondence without explicit lawyer approval — letters can be used as evidence.
- Use "sous toutes reserves" (without prejudice) when the communication should not be construable as an admission or waiver.

## Guidelines

- Luxembourg mise en demeure format: formal header, recipient identification, factual background, legal basis of the claim, specific demand, deadline for compliance (typically 8-15 days), consequences of non-compliance (legal proceedings).
- Courrier confraternel between lawyers is subject to professional secrecy rules — it cannot be produced in court without the sending lawyer's consent (Reglement Interieur de l'Ordre des Avocats).
- Tone: firm but professional. Luxembourg's legal community is small — aggressive correspondence is counterproductive and damages the firm's reputation.
- For multilingual correspondence, specify the governing language version — "En cas de divergence, la version francaise fait foi."
- Always send important correspondence by registered mail (lettre recommandee avec accuse de reception) to establish proof of delivery.

## Common Actions

### Draft a mise en demeure

Call `draft_demand_letter` with creditor/debtor details, factual basis, legal basis, amount claimed, and compliance deadline. Produce a formal demand letter with proper Luxembourg legal phrasing, interest calculation basis, and consequence statement.

### Draft an inter-lawyer letter

Call `draft_confraternel` with the opposing lawyer, case reference, and substance. Mark as confidential per bar rules. Maintain professional courtesy while advancing the client's position firmly.

### Draft a formal notice

Call `draft_notice` with notice type (termination, objection, exercise of option), legal basis, and required content. Ensure the notice meets any formal requirements (specific wording, delivery method, timing) imposed by the underlying agreement or law.
