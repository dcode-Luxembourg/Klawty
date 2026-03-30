---
name: invoice-processing
description: "Process, validate, and reconcile construction invoices against contracts, valuations, and delivery records"
metadata:
  klawty:
    emoji: "🧾"
---

# Invoice Processing

Handle the full invoice lifecycle for construction projects — receipt, validation, reconciliation against contracts and deliveries, retention calculation, and payment certification. Accurate invoice processing protects project finances and maintains supplier relationships.

## Musts

- Never approve an invoice without matching it against the corresponding purchase order or contract
- Always verify quantities and rates against certified valuations or delivery records
- Deduct retention at the contractual rate — never skip retention without written authorization
- Flag duplicate invoices immediately — same supplier, same amount, similar date
- Never process invoices for work not yet inspected and certified
- Maintain a payment certificate register with full audit trail

## Guidelines

- Use `reconcile_invoices` as the primary validation tool — it checks PO matching, delivery confirmation, and rate verification
- Cross-reference with `track_delivery` for material invoices — invoice quantity must match delivered quantity
- Verify subcontractor valuations against measured progress from `list_milestones`
- Track cumulative payments against contract values — catch overvaluation early
- Process invoices within the contractual payment terms to maintain good supplier relationships
- Keep a disputed invoice register separate from approved invoices

## Common Actions

### Invoice Validation

When: Invoice received from supplier or subcontractor
How: Call `reconcile_invoices` to match against purchase order or subcontract. Verify: correct project reference, matching rates, correct quantities, applicable discounts, retention deduction, CIS deduction (if applicable). Check for duplicates. If valid, approve for payment. If discrepancies found, raise query.
Example: Steel fabricator invoice 45,200 — PO value 44,800 for 56 tonnes at 800/t. Invoice claims 56.5 tonnes. Check delivery tickets: 56.2 tonnes delivered. Approve 44,960, query 0.3 tonne difference (240).

### Interim Valuation Processing

When: Monthly subcontractor valuation date (per contract)
How: Receive subcontractor application. Verify claimed progress against `list_milestones` and site records. Measure completed work against contract rates. Deduct retention, previous payments, and any contra-charges. Issue payment certificate. Log via `reconcile_invoices`.
Example: MEP subcontractor month 3 application: 120K gross. Verified: first fix complete L1 (45K), L2 50% (22.5K), distribution boards installed (18K). Approved gross: 85.5K. Less 5% retention (4,275). Less previous payments (52K). This certificate: 29,225.

### Retention Management

When: Practical completion (50% retention release) and end of defects liability period (final retention release)
How: Verify practical completion certificate is issued. Calculate retention held to date from payment certificate register. Issue retention release certificate for 50% at PC. Track defects liability period. Release remaining 50% at DLP expiry (typically 12 months post-PC), subject to all defects being rectified.
Example: Practical completion achieved — total retention held across 8 subcontractors: 67,400. Release 50% (33,700) per contract terms. Remaining 33,700 held until defects liability expiry (March 2025).

### Duplicate Invoice Detection

When: Every invoice received — duplicates are common in construction
How: Call `reconcile_invoices` which checks for matching supplier + amount + date combinations. Also check for split invoices (same work billed across two invoices) and rebilled rejected invoices. Flag any potential duplicates for manual review before processing.
Example: Concrete supplier invoice 8,450 dated 15th — previous invoice for 8,450 from same supplier dated 12th already processed. Flagged as potential duplicate. Investigation: different delivery dates, both legitimate. Approved after verification against separate delivery tickets.

### Payment Dispute Resolution

When: Invoice rejected, partially approved, or queried by either party
How: Document the dispute clearly — amounts, reasons, supporting evidence. Cross-reference original contract terms, delivery records, and inspection records. Draft resolution proposal. If unresolved, escalate with full documentation via `generate_audit_trail`. Track dispute status until closed.
Example: Plastering subcontractor disputes 2,400 deduction for defective work. Evidence: inspection photos showing cracking on L1 corridor walls, remedial work measured at 30m2 at 80/m2. Sub claims environmental cause (heating not operational). Resolution: 50/50 split — 1,200 deducted, sub remobilizes to repair remaining defects at their cost.
