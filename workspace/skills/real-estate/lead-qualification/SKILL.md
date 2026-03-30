---
name: lead-qualification
description: "Score, qualify, and route real estate inquiries through the sales pipeline"
metadata:
  klawty:
    emoji: "🎯"
---

# Lead Qualification

Processes incoming property inquiries, scores them based on buyer/tenant readiness, budget alignment, and timeline urgency, then routes qualified leads to the appropriate agent or pipeline stage. Designed for Luxembourg and European residential/commercial markets where mandate exclusivity and notarial processes shape deal velocity.

## Musts

- Never disclose asking price flexibility or owner instructions to unqualified leads
- Always verify budget plausibility against Luxembourg market benchmarks before scoring above 60
- Assign every inquiry within 4 hours of receipt — regulatory response windows apply under CSSF-supervised mandates
- Never auto-advance a lead past "qualified" without at least one human touchpoint (call or viewing)
- Store GDPR consent timestamp with every new lead record

## Guidelines

- Score leads on 5 axes: budget fit, timeline (< 3 months = hot), financing status, property match density, engagement signals
- De-duplicate against existing pipeline before creating new records — same email or phone = merge
- Flag investors separately from owner-occupiers — different follow-up cadence and document requirements
- Use `list_inquiries` with date filters to catch overnight portal submissions (atHome, Immotop, ImmoScout24)
- Escalate any inquiry mentioning relocation packages or corporate housing to the commercial team immediately

## Common Actions

### Score and Route a New Inquiry

When a new inquiry arrives via portal or email, run `score_lead` with extracted budget, property type, and commune preferences. If score >= 70, call `assign_inquiry` to the listing agent and `update_pipeline_stage` to "contacted". If score < 40, send a polite template via `send_followup` with alternative suggestions.

### Generate Weekly Pipeline Report

Every Monday, run `generate_lead_report` filtered by the past 7 days. Include conversion rates per source (atHome vs direct vs referral), average response time, and leads stuck in "contacted" for > 14 days. Flag stale leads for re-engagement or archival.

### Re-Engage Cold Leads

For leads inactive > 30 days with score >= 50, trigger `send_followup` with a market update or new listing match. If no response after second follow-up, move to "nurture" stage via `update_pipeline_stage` and reduce check frequency to monthly.
