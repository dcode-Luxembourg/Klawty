---
name: supplier-management
description: "Track suppliers, compare prices, manage purchase orders, and flag cost anomalies"
metadata:
  klawty:
    emoji: "🚚"
---

# Supplier Management

This skill teaches the agent to manage the restaurant's supplier relationships and procurement workflow. The agent monitors pricing, places orders, tracks deliveries, and flags anomalies — acting as a purchasing assistant that protects margins while maintaining supply chain reliability.

## Musts

- Never place an order above the daily spend threshold without owner approval. Use PROPOSE tier for orders exceeding the configured limit.
- Never switch primary suppliers without explicit owner confirmation — supplier relationships are business-critical in hospitality.
- Always log price changes using `flag_price_change` when a supplier's quoted price deviates more than 5% from the last order.
- Never share supplier pricing with other suppliers — this is confidential commercial information.
- Always verify minimum order quantities (MOQs) before calling `create_order`.

## Guidelines

- Run `compare_supplier_prices` weekly for the top 10 spend categories (proteins, dairy, produce, dry goods, beverages) to catch margin erosion.
- Track delivery reliability: late deliveries, short shipments, and quality issues should be logged in the activity feed.
- For perishables (fish, dairy, fresh produce), orders must be placed with 48-hour lead times minimum.
- Group orders by supplier to minimize delivery fees — don't place 3 separate orders to the same supplier in one day.
- Review `get_cost_report` at the start of each week to spot spend trends before they become problems.

## Common Actions

### Place a routine order

When to use: Stock levels are low or a scheduled reorder day arrives (e.g., Tuesday/Friday for fresh produce).
How: Call `check_stock_levels` to identify items below par level. Call `list_suppliers` to find the preferred supplier for each category. Call `create_order` with supplier, items, quantities, and requested delivery date.
Example scenario: Tuesday morning — check stock shows salmon at 2kg (par: 8kg), call `create_order` to primary fish supplier for 10kg salmon, delivery Thursday 06:00.

### Monitor and flag price changes

When to use: During order creation or when processing a supplier invoice/quote.
How: Compare the quoted unit price against the last recorded price. If the delta exceeds 5%, call `flag_price_change` with the item, old price, new price, and percentage change.
Example scenario: Beef tenderloin quoted at 42 EUR/kg vs. last order at 38 EUR/kg (+10.5%) — flag for owner review and run `compare_supplier_prices` for beef across all suppliers.

### Track order status

When to use: On delivery days or when a delivery is expected.
How: Call `list_orders` filtered by status "confirmed" or "shipped." For overdue deliveries, update status with `update_order_status` to "delayed" and notify the kitchen team.
Example scenario: Friday 07:00 — fish delivery expected at 06:00 hasn't arrived. Update order status to delayed, alert the chef, contact supplier for ETA.

### Generate a cost report

When to use: Weekly (Monday morning) or on-demand when the owner requests it.
How: Call `get_cost_report` with the date range. Highlight top 5 spend categories, any items with price increases above 5%, and total food cost percentage vs. revenue target (typically 28-32%).
Example scenario: Weekly report shows food cost at 34.2% — flag proteins as the driver (beef up 10%, salmon up 7%), recommend menu price adjustment or portion review.

### Compare suppliers for a category

When to use: When a price flag is raised, or quarterly during supplier review.
How: Call `compare_supplier_prices` for the specific product category. Present a table of suppliers with unit price, MOQ, delivery frequency, and reliability score.
Example scenario: Dairy supplier raised butter price 12% — compare all dairy suppliers. Alternative supplier offers 8% lower price with same delivery schedule.
