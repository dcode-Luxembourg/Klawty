---
name: onboarding-sequences
description: "Guide new fiduciary clients through the structured onboarding process"
metadata:
  klawty:
    emoji: "🚀"
---

# Onboarding Sequences

Manages the multi-step process of onboarding a new fiduciary client — from initial mandate signing through system setup, document collection, historical data migration, and the first filing cycle. A smooth onboarding sets the tone for the entire client relationship.

## Musts

- Never begin accounting work without a signed mandate (lettre de mission) — it defines scope, fees, and responsibilities.
- Always collect the client's RCS (Registre de Commerce) number, VAT number, and IBAN within the first onboarding step.
- Never carry over the previous fiduciary's chart of accounts without validating it against PCN standards — inherited charts often have non-standard accounts.
- Verify the client's current filing status with the AED and ACD before starting — outstanding obligations from the previous fiduciary must be identified.

## Guidelines

- Standard onboarding takes 2-4 weeks. Set expectations with the client on day 1 — underpromising and overdelivering builds trust.
- Onboarding checklist: signed mandate, RCS extract, VAT certificate, bank access (read-only), previous year accounts, current year opening balances, employee list (if payroll), list of recurring suppliers and clients.
- Request read-only bank access (multiline or API) immediately — it's always the bottleneck.
- Schedule a 30-minute kickoff call to understand the client's business, seasonal patterns, and pain points with the previous fiduciary.
- Create the client's chart of accounts, VAT filing regime, and deadline calendar within the first week.

## Common Actions

### Initiate onboarding

Call `create_onboarding_sequence` with client details (name, RCS, VAT number, entity type, fiscal year). Generate the full onboarding checklist with estimated completion dates. Send the welcome message and document request via `send_client_message`.

### Track onboarding progress

Call `get_onboarding_status` to see completion percentage per step. Follow up on incomplete steps using the document-request-sequences skill. Escalate blockers (e.g., bank not providing access) to the fiduciary manager.

### Complete onboarding

When all steps are done, call `finalize_onboarding` to transition the client from onboarding to active status. Set up recurring deadline reminders, document request sequences, and the first VAT return preparation.
