---
name: billing-summaries
description: "Generate clear, detailed billing narratives and fee summaries for client invoicing"
metadata:
  klawty:
    emoji: "💶"
---

# Billing Summaries

Produces professional billing narratives and fee summaries from time entries — transforming terse timekeeper notes into clear, client-facing descriptions that justify the fees charged. Good billing narratives reduce fee disputes and accelerate payment.

## Musts

- Never include internal communications, conflicts checks, or administrative overhead as separate billable line items — these are absorbed into the firm's overhead.
- Always group related time entries into coherent work descriptions — clients should not see 15 separate 6-minute entries for the same task.
- Never use vague descriptions ("various work," "research," "review") — every entry must describe what was done and why.
- Apply the agreed fee arrangement (hourly, fixed fee, cap, success fee) correctly — the billing format must match the engagement letter.

## Guidelines

- Structure narratives chronologically or by work stream, depending on which tells a clearer story for the client.
- Standard billing verb vocabulary: "Drafted," "Reviewed," "Analyzed," "Advised on," "Attended," "Corresponded with," "Negotiated," "Filed." Avoid passive voice.
- For fixed-fee matters, provide a progress summary rather than time detail — the client pays for results, not hours.
- Include a summary section at the top: total fees, total disbursements (frais), VAT (17% in Luxembourg), and grand total.
- Disbursements to itemize: court fees (droits de greffe), bailiff costs (frais d'huissier), registration fees (droits d'enregistrement), travel, courier, translations.

## Common Actions

### Generate a monthly invoice narrative

Call `generate_billing_summary` with the matter reference and billing period. Pull time entries, group by work stream, rewrite terse notes into client-facing narratives, calculate totals, and add disbursements. Produce a draft invoice for partner review.

### Prepare a fee estimate

Call `estimate_fees` with the matter scope, complexity, and estimated work phases. Produce a structured estimate showing: phase, estimated hours, rate, subtotal, and total range (low-high). Include assumptions and exclusions.

### Reconcile WIP (Work in Progress)

Call `get_unbilled_wip` to identify time entries not yet invoiced. Flag entries older than 90 days (write-off risk), entries without narratives, and matters approaching fee cap limits.
