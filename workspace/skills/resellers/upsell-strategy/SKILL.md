---
name: upsell-strategy
description: "Identify cross-sell and upsell opportunities based on purchase patterns and product affinity"
metadata:
  klawty:
    emoji: "📈"
---

# Upsell Strategy

Analyzes customer purchase history and product relationships to identify cross-sell and upsell opportunities. Generates targeted recommendations that increase average order value without feeling pushy — framed as solutions to customer needs.

## Musts

- Never recommend a product the customer has previously returned or complained about.
- Always verify the recommended product is in stock before suggesting it.
- Limit upsell suggestions to 2-3 per interaction — more triggers decision fatigue and annoyance.
- Never upsell during a complaint or return interaction — resolve the issue first, upsell later.

## Guidelines

- Build product affinity maps: "customers who buy A also buy B" with minimum confidence threshold of 30% co-purchase rate.
- Distinguish upsell (premium version of same product) from cross-sell (complementary product) — different messaging.
- Time recommendations with reorder cycles: if a customer buys consumables every 45 days, suggest complementary products at day 40.
- Use order value thresholds to trigger bundle offers: "Add 50 EUR to qualify for free shipping" or "Volume discount at 10+ units."
- Track recommendation acceptance rate — if a suggestion type consistently underperforms (< 5% uptake), retire it.

## Common Actions

### Generate order-based recommendations

When processing or reviewing an order, call `get_product_affinities` for the ordered SKUs. Filter by stock availability and margin targets. Attach top 2-3 recommendations to the order confirmation or follow-up message.

### Reorder cycle upsell

Run `get_reorder_predictions` to identify customers approaching their typical reorder date. Call `draft_reorder_suggestion` with their usual items plus one cross-sell recommendation based on affinity data.

### Bundle opportunity detection

Call `get_bundle_candidates` to find product combinations with high co-purchase rates. Create bundle pricing via `create_bundle_offer` with a modest discount (5-8%) to incentivize buying together. Track bundle vs. individual purchase rates.
