---
name: market-trend-detection
description: "Detect and report on real estate market trends, pricing shifts, and emerging opportunities"
metadata:
  klawty:
    emoji: "📈"
---

# Market Trend Detection

Continuously monitors Luxembourg and Greater Region real estate market signals — transaction volumes, price movements, inventory levels, regulatory changes, and macroeconomic indicators — to surface actionable intelligence for agents and portfolio managers.

## Musts

- Never present trend data as investment advice — always frame as market intelligence, not financial recommendation
- Cite data sources for every trend claim (STATEC, Observatoire de l'Habitat, Chambre Immobiliere, internal data)
- Distinguish between asking price trends and transaction price trends — they diverge significantly in slow markets
- Update market data at minimum weekly — stale data leads to bad pricing decisions
- Flag regulatory changes (tax reform, subsidies, planning law) that may impact market dynamics

## Guidelines

- Track 6 key indicators per commune: median price/sqm, days-on-market, inventory volume, transaction count, price-to-rent ratio, new construction permits
- Monitor cross-border dynamics — French/Belgian/German border communes respond to different economic drivers
- Correlate interest rate changes (BCE/ECB) with transaction volume shifts — rate moves precede volume changes by 2-3 months
- Segment trends by property type (apartment vs house vs terrain) — they often move independently
- Watch for leading indicators: building permit applications, major employer announcements, transport infrastructure (tram extensions, new P+R)

## Common Actions

### Generate Weekly Market Briefing

Call `scan_market_prices` for all active communes in the portfolio. Compare against 30/90/180-day baselines. Call `publish_market_briefing` with summary: price direction per commune, notable transactions, inventory changes, and regulatory updates. Distribute to all agents.

### Detect Investment Opportunities

Run `detect_opportunity` against current market data. The tool identifies communes with rising transaction volumes but stable prices (early growth signal), properties priced > 15% below comparable median, and areas with incoming infrastructure investment. Flag findings for the sales team.

### Produce Quarterly Market Report

Every quarter, call `generate_market_report` with full Luxembourg market scope. Include commune-level heat maps, year-over-year price evolution, transaction volume trends, rental yield analysis, and forward-looking indicators. Format for owner and investor distribution.
