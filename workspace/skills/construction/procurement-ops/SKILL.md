---
name: procurement-ops
description: "Manage RFQs, purchase orders, material deliveries, and procurement schedules for construction projects"
metadata:
  klawty:
    emoji: "📦"
---

# Procurement Operations

Run the procurement pipeline from requisition through delivery. Issue RFQs, compare quotes, place orders, track deliveries, and ensure materials arrive on site when the programme needs them — not before (storage cost) and not after (delay cost).

## Musts

- Never place an order without at least 2 comparable quotes (3 preferred)
- Always verify lead times against the construction programme before committing
- Flag any single-source dependency — if only one supplier can deliver, escalate immediately
- Never exceed budget line items without flagging via `flag_budget_overrun`
- Include delivery logistics in every order — site access hours, crane availability, unloading zone
- Track all procurement commitments against cash flow forecasts

## Guidelines

- Issue RFQs at least 2x the expected lead time before the required-on-site date
- Use `search_supplier_catalog` to identify potential suppliers before creating RFQs
- Call `compare_quotes` to evaluate on price, lead time, warranty, and past performance
- Monitor `track_delivery` daily for orders in transit — late deliveries are the #1 site disruption
- Bundle related items into single RFQs where possible to improve pricing
- Maintain approved supplier lists per material category

## Common Actions

### Issue Request for Quotation

When: Material or equipment needed per the procurement schedule, typically 8-12 weeks before required on site
How: Call `search_supplier_catalog` to identify 3-5 qualified suppliers. Call `create_rfq` with detailed specifications, quantities, required delivery date, site delivery constraints, and submission deadline. Set follow-up reminder for quote deadline.
Example: RFQ for 240m2 curtain wall glazing units — issued to 4 facade specialists, quotes due in 10 working days, delivery required Week 22.

### Evaluate and Compare Quotes

When: Quote submission deadline reached, minimum 2 quotes received
How: Call `compare_quotes` to generate side-by-side analysis on unit price, total cost, lead time, payment terms, warranty, and supplier track record. Flag any quote exceeding budget via `get_budget_vs_actual`. Recommend preferred supplier with justification.
Example: 3 quotes for structural steel — Supplier A cheapest but 4-week lead time risk, Supplier B 8% more but guaranteed delivery, Supplier C excluded (no site references). Recommend Supplier B.

### Place and Track Orders

When: Quote approved by PM or client (depending on value threshold)
How: Call `place_order` with confirmed supplier, agreed price, delivery schedule, and payment terms. Immediately call `track_delivery` to set up tracking. Update procurement schedule and cash flow.
Example: PO-2024-087 issued for MEP ductwork — delivery in 3 drops: Week 18 (L1), Week 20 (L2), Week 22 (L3). First drop confirmed by supplier.

### Monitor Delivery Pipeline

When: Every cycle — delivery delays cascade through the entire programme
How: Call `track_delivery` for all open orders. Flag any delivery at risk of missing its required-on-site date. Cross-reference with `list_milestones` to assess programme impact. Escalate delays via `create_delay_alert`.
Example: Bathroom tiles showing 5-day delay from manufacturer — current float on tiling activity is 3 days. Flag as critical, contact supplier for expediting options.

### Handle Budget Overruns

When: Quote or order exceeds approved budget line
How: Call `get_budget_vs_actual` to quantify the variance. Call `flag_budget_overrun` with the line item, variance amount, and cause (scope change, market price increase, specification upgrade). Include value engineering alternatives if available.
Example: Specified marble flooring 35% over budget — flag overrun, propose porcelain alternative at 10% under budget with comparable aesthetic.
