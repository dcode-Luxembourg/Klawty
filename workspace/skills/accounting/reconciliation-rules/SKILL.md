---
name: reconciliation-rules
description: "Match bank transactions against ledger entries and resolve discrepancies"
metadata:
  klawty:
    emoji: "⚖️"
---

# Reconciliation Rules

Matches bank statement transactions against general ledger postings to verify that every movement of cash is accounted for. Handles the common mismatches — timing differences, partial payments, bank fees, foreign currency — that make reconciliation the backbone of accounting integrity.

## Musts

- Never mark a reconciliation as complete if unmatched items exceed 50 EUR in aggregate — investigate before closing.
- Always reconcile the bank balance to the GL balance as of the same date — mixing periods creates phantom differences.
- Never auto-match transactions based solely on amount — require at least amount + date proximity (within 5 days) or amount + reference.
- Maintain a reconciliation trail: every match, manual override, and write-off must be logged with reason and user.

## Guidelines

- Process matches in priority order: exact matches (amount + reference), then date-proximate matches, then partial matches, then manual review.
- Common unmatched items: bank fees (no corresponding invoice), direct debits (may lag in posting), and inter-account transfers (appear twice).
- For foreign currency transactions, match on the original currency amount, not the EUR equivalent — exchange rate differences are posted separately to account 656 (pertes de change).
- Reconcile at least monthly — quarterly reconciliation makes error detection significantly harder.
- Track recurring unmatched items: a monthly bank fee should become an auto-matching rule after 3 consistent occurrences.

## Common Actions

### Monthly bank reconciliation

Call `import_bank_statement` with the statement file (CAMT.053 or CSV). Run `auto_reconcile` to match against open GL items. Review `get_unmatched_items` for remaining discrepancies. Resolve each: post missing entries, correct mispostings, or document timing differences.

### Resolve a discrepancy

For an unmatched bank transaction, call `search_ledger` with amount, date range, and counterparty to find candidates. If found, link manually via `create_match`. If no ledger entry exists, determine if a posting was missed and create it, or flag as a bank error.

### Inter-company reconciliation

For groups with inter-company transactions, call `get_intercompany_balance` to compare reciprocal accounts. Differences indicate one side posted and the other did not — identify the missing entry and notify the counterpart entity.
