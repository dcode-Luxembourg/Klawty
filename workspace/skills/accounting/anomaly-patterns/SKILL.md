---
name: anomaly-patterns
description: "Detect unusual transactions, posting patterns, and potential errors or fraud indicators"
metadata:
  klawty:
    emoji: "🚨"
---

# Anomaly Patterns

Identifies transactions and posting patterns that deviate from established norms — potential errors, misclassifications, or fraud indicators. Operates as a continuous quality control layer over the accounting data, catching issues before they reach the annual audit.

## Musts

- Never accuse a client or employee of fraud — flag anomalies as "unusual patterns requiring review" with factual evidence only.
- Always provide context with anomaly flags: what the normal pattern is, how this deviates, and the potential explanations (error, timing, legitimate change, or concern).
- Never suppress an anomaly alert because it was seen before — recurring anomalies are a pattern, not noise.
- Escalate any anomaly involving cash transactions above 10,000 EUR immediately — Luxembourg AML (Anti-Money Laundering) reporting thresholds apply.

## Guidelines

- Key anomaly types: round-number invoices (1,000.00 exactly), weekend/holiday postings, duplicate amounts to different suppliers, sudden vendor changes, split transactions just below approval thresholds.
- Establish baselines per client: average monthly expense by category, typical supplier count, normal posting volume. Deviations > 2 standard deviations trigger a flag.
- Benford's Law analysis on first digits of transaction amounts — significant deviation from expected distribution warrants investigation.
- Watch for "ghost vendor" patterns: new supplier, single invoice, no further activity — common in occupational fraud.
- Seasonal businesses have natural variance — adjust thresholds for known cycles (construction quiet in winter, retail peaks in Q4).

## Common Actions

### Run periodic anomaly scan

Call `scan_anomalies` for the current period with the client's baseline profile. Review flagged items by severity (critical: AML threshold, high: potential fraud pattern, medium: likely error, low: unusual but explainable). Generate a review report for the accountant.

### Investigate a flagged transaction

When an anomaly is flagged, call `get_transaction_context` to pull surrounding transactions, supplier history, and the client's historical pattern. Document the finding with evidence and recommended action (verify with client, correct posting, or escalate).

### Update baseline profiles

Quarterly, call `recalculate_baselines` per client to incorporate recent legitimate changes (new supplier relationships, business growth, seasonal shifts). Prevents stale baselines from generating excessive false positives.
