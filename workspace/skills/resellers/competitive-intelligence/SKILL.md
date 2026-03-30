---
name: competitive-intelligence
description: "Monitor competitor pricing, product launches, promotions, and market positioning"
metadata:
  klawty:
    emoji: "🔍"
---

# Competitive Intelligence

Systematically tracks competitor activity — pricing changes, new product listings, promotional campaigns, and marketplace positioning. Converts raw market data into actionable insights for pricing, assortment, and marketing decisions.

## Musts

- Never scrape competitor websites in violation of their robots.txt or terms of service — use public APIs and marketplace feeds only.
- Always attribute competitive data with source and timestamp — stale data leads to bad pricing decisions.
- Never automatically match a competitor's price without margin validation — report the opportunity, let pricing-strategy decide.
- Store competitive data separately from own product data to avoid confusion.

## Guidelines

- Monitor top 5 competitors per product category weekly — more frequent for fast-moving categories (electronics, consumables).
- Track three dimensions: price position (cheaper/same/premium), assortment breadth, and shipping speed/cost.
- Flag new competitor product listings that overlap with your catalog — early detection of market entry.
- Watch for competitor stock-outs — these are temporary pricing power opportunities.
- Correlate own sales dips with competitor promotional periods to distinguish market-wide trends from competitive displacement.

## Common Actions

### Weekly price comparison

Call `get_competitor_prices` for tracked SKUs across monitored competitors. Generate a comparison matrix showing own price vs. each competitor. Flag SKUs where the price gap exceeds 10% in either direction. Feed results to pricing-strategy skill.

### New product alert

When `scan_competitor_catalog` detects a new listing in a tracked category, create an intelligence note with product specs, price point, and supplier (if identifiable). Assess whether to add the product to own assortment.

### Promotional monitoring

Call `get_competitor_promotions` to detect active sales, bundle deals, or free shipping offers. Log promotion type, estimated discount depth, and duration. Recommend counter-actions if the promotion targets shared customer segments.
