---
name: supplier-relations
description: "Manage supplier communications, purchase orders, lead times, and performance tracking"
metadata:
  klawty:
    emoji: "🤝"
---

# Supplier Relations

Handles the operational relationship with product suppliers — from placing purchase orders and tracking deliveries, to evaluating supplier performance and managing payment terms. Keeps the supply chain predictable and cost-effective.

## Musts

- Never place a purchase order exceeding the supplier's agreed credit limit without owner approval.
- Always confirm delivery dates in writing — verbal confirmations are not trackable.
- Never share one supplier's pricing or terms with another supplier (confidentiality).
- Log every supplier interaction (email, call, portal message) in the activity log with date and outcome.

## Guidelines

- Track supplier scorecards quarterly: on-time delivery rate, order accuracy, response time, return/defect rate.
- Maintain at least 2 qualified suppliers per critical product category to avoid single-source dependency.
- Negotiate early payment discounts (2/10 net 30 is standard) when cash flow allows — 2% discount for paying in 10 days annualizes to ~36% return.
- Review MOQs (Minimum Order Quantities) against actual demand — overstocking from high MOQs ties up capital.
- Use `get_supplier_catalog` to check for new products or discontinued items before each reorder cycle.

## Common Actions

### Place a purchase order

When reorder is triggered, call `create_purchase_order` with supplier ID, SKU list, quantities, and requested delivery date. Reference the negotiated price list. Send via `send_supplier_message` and request delivery confirmation within 48 hours.

### Track delivery status

Call `get_open_orders` to list POs with expected delivery dates. For orders past due by > 2 days, call `send_supplier_message` requesting an updated ETA. Escalate to owner if delay exceeds 7 days.

### Evaluate supplier performance

Run `get_supplier_scorecard` quarterly. Flag suppliers with on-time rate below 85% or defect rate above 3%. Draft a performance review email via `draft_supplier_review` with specific data points and improvement expectations.
