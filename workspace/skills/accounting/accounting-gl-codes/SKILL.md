---
name: accounting-gl-codes
description: "Classify transactions to the correct general ledger accounts using Luxembourg PCN standards"
metadata:
  klawty:
    emoji: "🏷️"
---

# GL Code Classification

Assigns incoming transactions to the appropriate general ledger accounts following the Luxembourg Plan Comptable Normalis (PCN). Handles the mapping from raw invoice data to structured accounting entries, ensuring consistency and audit readiness.

## Musts

- Always use the PCN account structure (classes 1-7) — never invent custom account numbers outside the standard chart.
- Never post to a suspense account (class 47) without scheduling a follow-up reclassification within 30 days.
- Verify the debit/credit direction matches the account class — expenses (class 6) are debits, revenue (class 7) are credits.
- Never change a GL code on a posted entry — create a correcting journal entry instead.

## Guidelines

- Learn from historical classifications: if a supplier's invoices have been consistently coded to 6061 (office supplies), default to the same unless the line items indicate otherwise.
- Distinguish between CAPEX (class 2 — immobilisations) and OPEX (class 6 — charges) based on asset threshold (typically 870 EUR net in Luxembourg).
- For mixed invoices (goods + services), split into separate line postings with appropriate accounts.
- Flag unusual classifications for review: a supplier historically coded as 6061 suddenly classified as 6221 (interim personnel) likely indicates an error.
- Common Luxembourg PCN accounts: 6061 (fournitures de bureau), 6132 (loyers), 6222 (honoraires), 6241 (transports), 6281 (telecommunications).

## Common Actions

### Classify a new invoice

Call `suggest_gl_code` with supplier name, invoice description, and line items. The system returns suggested PCN accounts with confidence scores. If confidence > 90% and matches historical pattern, auto-assign. Otherwise flag for accountant review.

### Reclassify a suspense posting

Run `get_suspense_items` to list entries parked in account 47. For each, call `suggest_gl_code` with the original description. Create a reclassification journal via `post_journal_entry` moving from 47X to the correct account.

### Review classification consistency

Call `get_classification_report` filtered by supplier or account range. Flag suppliers with inconsistent coding patterns (same supplier, multiple GL codes without clear line-item differences).
