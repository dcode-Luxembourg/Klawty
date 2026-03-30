---
name: comparable-analysis
description: "Analyze comparable property transactions to support pricing and valuation decisions"
metadata:
  klawty:
    emoji: "📊"
---

# Comparable Analysis

Identifies and analyzes recent property transactions comparable to a subject property, producing data-driven pricing recommendations. Uses Luxembourg's publicized acte notarie data, portal listing history, and internal transaction records to build robust comparable sets adjusted for location, surface, condition, and energiepass class.

## Musts

- Use minimum 3 comparable transactions for any pricing recommendation — fewer is statistically unreliable
- Comparables must be within 12 months and the same commune or immediately adjacent communes
- Always disclose adjustment methodology when presenting to owners — transparency builds mandate trust
- Never present portal asking prices as transaction prices — only notarized sale prices are reliable
- Adjust for surface differences using price-per-sqm, not absolute price comparison

## Guidelines

- Weight recent transactions more heavily — a 2-month-old comp beats a 10-month-old comp in a moving market
- Adjust for energiepass class: each class difference (e.g., D to C) represents approximately 3-5% value differential in Luxembourg
- Separate apartment comparables by residence type: older buildings (avant 1990) vs recent construction vs VEFA
- Include charges mensuelles impact for apartment comparables — high charges suppress effective price
- Cross-reference with `track_price_history` for trend context — is the commune appreciating or flat?

## Common Actions

### Run Comparable Analysis

Call `run_comparable_analysis` with subject property commune, type, surface, construction year, and energiepass class. The tool queries transaction databases, selects qualifying comparables, applies adjustments, and returns a price range (low/median/high) with confidence score. Present alongside individual comp details.

### Support Mandate Pricing Discussion

Before a listing presentation, generate a comparable report combining `run_comparable_analysis` output with `track_price_history` trend data. Show the owner where their property sits relative to recent transactions, with clear adjustments explained. Use this to justify the recommended asking price.

### Monitor Comparable Market Movement

Monthly, re-run comparables for all active listings on market > 45 days. If median comparable price has shifted > 5% from listing price, flag for price review. Call `generate_market_report` with the updated analysis for the listing agent.
