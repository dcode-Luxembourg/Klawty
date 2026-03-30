---
name: comparative-law
description: "Compare legal frameworks across jurisdictions for cross-border matters and regulatory arbitrage analysis"
metadata:
  klawty:
    emoji: "🌍"
---

# Comparative Law

Compares legal frameworks across jurisdictions — primarily Luxembourg, Belgium, France, Germany, and EU-wide — to support cross-border transactions, regulatory compliance, and forum selection decisions. Luxembourg's position as a financial center makes comparative analysis essential for most commercial matters.

## Musts

- Never equate legal concepts across jurisdictions without noting the differences — a French "SARL" is not identical to a Luxembourg "SARL" despite the same name.
- Always identify the conflict-of-laws rules (Rome I for contracts, Rome II for torts, Brussels I bis for jurisdiction) before advising on cross-border matters.
- Never recommend a jurisdiction choice solely on favorable substantive law — procedural requirements, enforcement mechanisms, and practical considerations (language, costs, duration) matter equally.
- Cite the specific legal provision in each jurisdiction being compared — general statements without sources are unhelpful.

## Guidelines

- Luxembourg vs. France: similar Code Civil heritage, but Luxembourg commercial law diverges significantly (e.g., more flexible company law, different employment protections, distinct financial regulation under CSSF).
- Luxembourg vs. Belgium: close historical ties but separate legal systems since 1839. Tax treatment, corporate governance, and labor law differ materially.
- Luxembourg vs. Germany: different legal families (Romanistic vs. Germanic) but aligned on EU law implementation. Significant differences in contract formation, corporate governance (Aufsichtsrat), and labor co-determination.
- For fund structures, compare Luxembourg (SICAV, SIF, RAIF) with Ireland (ICAV, QIAIF), Netherlands (FGR), and Cayman — Luxembourg dominates EU fund domiciliation for regulatory reasons.
- Always note the date of comparison — laws change, and a comparison can become outdated quickly.

## Common Actions

### Cross-border transaction analysis

Call `compare_jurisdictions` with the legal question, relevant jurisdictions, and transaction type. Produce a comparison table showing: applicable law, key requirements, costs, timeline, and practical advantages/disadvantages per jurisdiction.

### Forum selection recommendation

Call `analyze_forum_options` with the dispute type, parties' locations, and contract terms. Compare: applicable procedural rules, average case duration, costs, enforcement mechanisms, and language of proceedings. Recommend the optimal forum with reasoning.

### Regulatory comparison

Call `compare_regulatory_frameworks` for a specific sector (financial services, data protection, employment). Map the requirements across jurisdictions, identify gaps, and flag areas where Luxembourg law is more or less restrictive than comparators.
