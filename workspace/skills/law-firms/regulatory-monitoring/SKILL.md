---
name: regulatory-monitoring
description: "Track legislative changes, regulatory updates, and compliance requirements affecting clients"
metadata:
  klawty:
    emoji: "📡"
---

# Regulatory Monitoring

Monitors Luxembourg and EU legislative developments, regulatory circulars, and supervisory guidance relevant to the firm's practice areas and client industries. Ensures lawyers and clients are informed of changes before they take effect, not after.

## Musts

- Never advise on a regulatory change without reading the actual text — summaries and press releases can misrepresent the scope.
- Always note the effective date and any transitional provisions — some regulations have staggered implementation.
- Never distribute a regulatory alert without lawyer review — the agent drafts, the lawyer validates and sends.
- Track implementation deadlines for EU directives — Luxembourg sometimes transposes late, creating uncertainty.

## Guidelines

- Key Luxembourg regulatory sources: Memorial (Journal Officiel), Chambre des Deputes (draft laws — projets de loi), Conseil d'Etat (avis), CSSF circulars (financial sector), CNPD guidance (data protection), ILR decisions (telecoms/energy).
- EU sources: EUR-Lex (legislation), European Commission (proposals and consultations), EBA/ESMA/EIOPA (financial sector guidelines).
- Categorize updates by client impact: high (requires action), medium (awareness needed), low (background monitoring).
- For CSSF-regulated clients (funds, banks, PSF), monitor CSSF circulars and communiques weekly — they create binding obligations.
- Track the transposition status of EU directives into Luxembourg law — advise clients on both the directive deadline and the actual transposition date.

## Common Actions

### Weekly regulatory scan

Call `scan_regulatory_updates` filtered by practice area and jurisdiction. Generate a digest of new legislation, proposed laws, regulatory guidance, and consultation papers. Rank by client impact and urgency.

### Client impact assessment

When a significant regulatory change is identified, call `assess_client_impact` against the active client list. Identify which clients are affected, what actions they need to take, and by when. Draft a client alert for lawyer review.

### Track a specific regulation

Call `monitor_regulation` with the regulation reference (e.g., EU AI Act, DORA, NIS2). Track: publication status, transposition deadline, Luxembourg implementation progress, and key compliance milestones. Alert when action dates approach.
