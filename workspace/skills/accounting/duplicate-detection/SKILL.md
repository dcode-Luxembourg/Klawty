---
name: duplicate-detection
description: "Identify and prevent duplicate invoice postings and double payments"
metadata:
  klawty:
    emoji: "🔁"
---

# Duplicate Detection

Prevents duplicate invoice entries and double payments by comparing incoming documents against existing records using multiple matching criteria. A single duplicate payment can cost hours of recovery effort and damage supplier relationships.

## Musts

- Check for duplicates BEFORE posting any invoice — never post first and reconcile later.
- Match on at least 3 fields: supplier + invoice number + amount. Date alone is insufficient (multiple invoices per day from the same supplier is normal).
- Never auto-delete a suspected duplicate — flag it for review. Some legitimate invoices have similar numbers (e.g., proforma vs. final).
- Log every duplicate detection event with the matching criteria and the decision taken (confirmed duplicate, false positive, merged).

## Guidelines

- Use fuzzy matching on invoice numbers: suppliers may add prefixes, dashes, or leading zeros inconsistently (INV-2024-001 vs 2024001 vs INV2024001).
- Check for near-amount duplicates (within 1%) — OCR errors or rounding differences can make exact-match miss a true duplicate.
- Cross-reference credit notes: a credit note + re-issued invoice for the same amount is NOT a duplicate — it's a correction sequence.
- Run a weekly `get_potential_duplicates` scan across all unreviewed entries — catches duplicates from different intake channels (email vs. portal vs. scan).
- Track duplicate rates per intake channel — high rates may indicate a process issue (e.g., both email and postal copies being entered).

## Common Actions

### Pre-posting duplicate check

Before creating an invoice record, call `check_duplicate` with supplier ID, invoice number, amount, and date. If a match is found, return the existing record details and block the new entry. If a near-match is found (fuzzy), flag for manual review.

### Periodic duplicate scan

Run `scan_duplicates` weekly across all invoices posted in the last 90 days. Generate a report of potential duplicates ranked by confidence. Present pairs with matching fields highlighted for efficient review.

### Resolve a confirmed duplicate

When a duplicate is confirmed, call `mark_as_duplicate` linking it to the original. If a payment was already made, initiate a refund request via `create_refund_request` to the supplier. Update both records with cross-references.
