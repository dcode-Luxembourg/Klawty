---
name: vat-filing-rules
description: "Apply Luxembourg VAT return preparation rules, box mapping, and submission procedures"
metadata:
  klawty:
    emoji: "📋"
---

# VAT Filing Rules

Handles the preparation and validation of Luxembourg VAT returns (declaration TVA) — mapping transaction data to the correct return boxes, performing internal consistency checks, and preparing the submission file for eCDF (electronic filing platform).

## Musts

- Always reconcile box 019 (total deductible input VAT) against the purchase ledger before submission — mismatches indicate missing or misclassified invoices.
- Never file a return showing a credit (reimbursement request) exceeding 10,000 EUR without flagging for accountant review — large credits trigger AED audits.
- Ensure intra-Community supplies (box 048) match the EC Sales List (ECSL/listing intracommunautaire) for the same period.
- Always file by the 15th of the month following the declaration period — no grace period.

## Guidelines

- Luxembourg VAT return boxes: 012 (domestic sales 17%), 014 (domestic sales 14%), 016 (domestic sales 8%), 018 (domestic sales 3%), 046 (total taxable sales), 048 (intra-Community supplies), 056 (intra-Community acquisitions), 065 (reverse charge services received), 019 (deductible input VAT).
- For businesses with pro-rata deduction, apply the definitive coefficient from the previous year, then adjust when the current year coefficient is finalized.
- Negative amounts in a declaration box are only valid for credit notes — never net purchases against sales.
- Monthly filers with consistent credits may request quarterly filing to reduce administrative burden.
- Cross-check box 046 against the sales ledger and box 056 against the purchase ledger filtered for intra-EU acquisitions.

## Common Actions

### Prepare a VAT return

Call `generate_vat_return` with the declaration period. The system maps all posted transactions to return boxes. Run `validate_vat_return` to check internal consistency (box totals, cross-checks, ECSL matching). Generate the eCDF-compatible XML file.

### Handle a VAT assessment

When the AED issues an assessment differing from the filed return, call `compare_assessment` with the assessment details. Identify the specific boxes where the administration disagrees. If the assessment is incorrect, draft an objection letter within the 3-month window.

### File an amended return

When a post-filing error is discovered, call `create_amended_return` with the corrected data. Include a cover letter explaining the reason for amendment. File as a "declaration rectificative" via eCDF.
