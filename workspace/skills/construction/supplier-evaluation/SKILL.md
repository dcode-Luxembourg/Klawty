---
name: supplier-evaluation
description: "Assess, score, and manage construction supplier and subcontractor performance"
metadata:
  klawty:
    emoji: "⭐"
---

# Supplier Evaluation

Evaluate suppliers and subcontractors on delivery reliability, quality, pricing competitiveness, safety record, and contractual compliance. Build and maintain an approved supplier register that improves procurement decisions over time.

## Musts

- Never recommend a supplier without checking their insurance and certification status via `check_certifications`
- Always evaluate on at least 4 criteria: price, quality, delivery reliability, and safety record
- Flag any supplier with expired insurance or lapsed certifications immediately
- Never sole-source without documenting the justification and escalating for approval
- Maintain separation between supplier evaluation and order placement — evaluate first, order second
- Record all supplier performance data for trend analysis across projects

## Guidelines

- Use `search_supplier_catalog` to discover new suppliers and benchmark against incumbents
- Cross-reference delivery performance from `track_delivery` history when scoring reliability
- Weight delivery reliability highest for critical-path materials — a cheap supplier who delivers late costs more
- Check subcontractor references from at least 2 comparable projects before first appointment
- Review supplier scores quarterly — performance degrades silently without active monitoring
- Consider geographic proximity for just-in-time deliveries and emergency call-outs

## Common Actions

### Score Existing Supplier

When: After order completion or quarterly review cycle
How: Compile data from `track_delivery` (on-time rate), `log_inspection` (quality defects), `reconcile_invoices` (billing accuracy), and `check_certifications` (compliance status). Score 1-5 on each dimension. Calculate weighted average. Update supplier register.
Example: Concrete supplier — delivery: 4/5 (2 late out of 20), quality: 5/5 (zero failed cube tests), price: 3/5 (market rate), safety: 5/5 (zero incidents). Overall: 4.2/5. Approved for continued use.

### Vet New Supplier

When: New material requirement, existing supplier capacity issue, or cost reduction initiative
How: Call `search_supplier_catalog` to identify candidates. Call `check_certifications` for insurance, trade licenses, and quality accreditations (ISO 9001, CE marking). Request references. Compare against incumbents using `compare_quotes` on a trial order.
Example: New drywall subcontractor — verified: public liability insurance (valid 14 months), CSCS cards for all operatives, 3 references from fit-out projects > 500m2. Trial: 1 floor scope to evaluate quality and speed.

### Flag Underperforming Supplier

When: Repeated delivery delays, quality defects, or safety violations detected
How: Document specific incidents with dates and evidence. Calculate cost impact of poor performance (delay costs, rework costs, management time). Use `create_delay_alert` if performance is affecting the programme. Recommend corrective action or replacement.
Example: Electrical subcontractor — 3 failed inspections in 4 weeks (cable routing non-compliant). Estimated rework cost: 12 labour-days. Recommend formal warning letter and dedicated supervisor, or mobilize replacement sub within 2 weeks.

### Certification Monitoring

When: Every cycle — expired certifications create liability exposure
How: Call `check_certifications` for all active suppliers on current projects. Call `flag_expiring_document` for any certification expiring within 30 days. Notify supplier via `draft_client_email` requesting renewal evidence.
Example: Scaffolding contractor PASMA certification expires in 21 days — flag and request updated certificate. If not provided within 14 days, suspend from approved list.
