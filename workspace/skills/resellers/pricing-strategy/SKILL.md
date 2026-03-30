---
name: pricing-strategy
description: "Set, adjust, and optimize product pricing based on margins, competition, and demand"
metadata:
  klawty:
    emoji: "💰"
---

# Pricing Strategy

Manages product pricing across channels — calculating margins, applying markup rules, monitoring competitor prices, and recommending adjustments. Ensures pricing stays profitable while remaining competitive in the reseller's target market segments.

## Musts

- Never set a price below the floor price (cost + minimum margin %) without explicit owner approval.
- Always factor in channel fees (Amazon 15%, eBay 12-13%, platform commissions) when calculating net margin.
- Never change prices on more than 20 SKUs in a single cycle without owner notification — bulk repricing needs oversight.
- Include VAT in all B2C-facing prices (EU consumer law). B2B prices displayed net.

## Guidelines

- Use `get_competitor_prices` weekly to benchmark against top 3 competitors per product category.
- Apply price elasticity logic: fast-moving SKUs tolerate smaller margins, slow movers need higher markup to justify carrying cost.
- Consider MAP (Minimum Advertised Price) agreements with suppliers — violating MAP risks losing distribution rights.
- Seasonal adjustments: flag products with predictable demand curves (heating, garden, back-to-school) for proactive repricing.
- Track price-to-sales correlation via `get_price_performance` to validate whether price changes actually moved volume.

## Common Actions

### Competitive price adjustment

When `get_competitor_prices` shows a key SKU undercut by > 5%, evaluate whether matching is profitable. Call `calculate_margin` with the competitor's price minus channel fees. If margin stays above floor, call `update_price` and log the reason as "competitive match."

### Margin review

Run `get_margin_report` filtered by category to identify SKUs where margin has eroded below target. Common causes: supplier cost increase not passed through, or channel fee changes. Recommend price increases with `suggest_price_change`.

### Promotional pricing

For clearance or seasonal campaigns, call `create_price_rule` with SKU list, discount %, start/end dates, and affected channels. Ensure the discounted price still clears the floor. Revert automatically at campaign end.
