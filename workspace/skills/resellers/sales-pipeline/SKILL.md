---
name: sales-pipeline
description: "Track B2B leads and deals from first contact through negotiation to closed order"
metadata:
  klawty:
    emoji: "📊"
---

# Sales Pipeline

Manages the B2B sales funnel for resellers — tracking leads from initial inquiry through qualification, quotation, negotiation, and order confirmation. Ensures no opportunity falls through the cracks and follow-up cadences are maintained.

## Musts

- Never mark a deal as "won" until a signed order or purchase order is received — verbal agreements are "verbal_commit" stage only.
- Always log the source of every new lead (trade show, referral, website, cold outreach) for ROI tracking.
- Never delete a lost deal — move to "lost" with a reason code for pipeline analytics.
- Follow up on every open quote within 5 business days if no response received.

## Guidelines

- Qualify leads on 4 criteria: budget authority, need urgency, purchase timeline, decision-maker access (BANT).
- Use `get_pipeline_summary` at cycle start to identify deals stuck in a stage for more than their expected duration.
- Prioritize deals by weighted value (deal amount x probability %) to focus effort on highest expected revenue.
- Track win/loss ratios per product category and lead source — double down on what converts.
- For deals > 10K EUR, suggest a site visit or video call before quoting — high-value deals close better with relationship.

## Common Actions

### Qualify a new lead

When a new inquiry arrives, call `create_lead` with contact details and source. Run `qualify_lead` against BANT criteria. If qualified (score > 60), advance to "qualified" stage and assign a follow-up within 48 hours.

### Follow up on stale deals

Run `get_stale_deals` filtered by stage duration thresholds (quoted > 7 days, negotiating > 14 days). Draft personalized follow-up messages via `draft_followup` referencing the specific quote or last conversation point.

### Generate pipeline report

Call `get_pipeline_report` with date range. Summarize total pipeline value, weighted forecast, conversion rates per stage, and expected closes this month. Flag any deals with overdue next actions.
