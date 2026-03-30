---
name: valuation-methodology
description: "Apply structured valuation methods to estimate property market value"
metadata:
  klawty:
    emoji: "💰"
---

# Valuation Methodology

Applies recognized valuation approaches — comparative market analysis, income capitalization, and replacement cost — to produce defensible property value estimates. Calibrated for the Luxembourg market where limited transaction data, high land values, and energiepass impact require methodology adaptation.

## Musts

- Never present automated valuations as formal appraisals — only licensed experts agrées can issue official valuations in Luxembourg
- Always state the valuation date and methodology used — values are point-in-time estimates
- Use at least two independent methods and reconcile — single-method valuations lack robustness
- Disclose all assumptions (vacancy rate, cap rate, depreciation schedule, renovation cost estimates)
- Never value land and improvements separately without cadastral justification

## Guidelines

- Primary method for residential: comparable sales approach adjusted for surface, condition, energiepass, and commune
- For investment properties: income capitalization using actual rent rolls, market vacancy rates, and commune-appropriate cap rates (Luxembourg typically 3.5-5.5% gross)
- For new construction or major renovation: replacement cost method using construction cost indices (STATEC BTP index)
- Reconcile methods by weighting: comparables 50%, income 30%, cost 20% for mixed-use; adjust weights based on data availability
- Factor in Luxembourg-specific value drivers: proximity to tram, international schools, Kirchberg employers, and nature reserves

## Common Actions

### Estimate Property Value

Call `estimate_valuation` with property details (type, commune, surface habitable, terrain surface, construction year, energiepass, condition, rental income if applicable). The tool runs comparable analysis, income cap calculation where relevant, and returns a value range with confidence interval and methodology breakdown.

### Support Owner Pricing Decision

Combine `estimate_valuation` output with `run_comparable_analysis` for a comprehensive pricing dossier. Present to the owner with clear methodology explanation, adjustment rationale, and recommended asking price (typically 5-10% above estimated market value to allow negotiation margin).

### Track Portfolio Valuation

Quarterly, re-run `estimate_valuation` for all managed properties. Compare against previous quarter and purchase prices. Call `produce_owner_report` with updated portfolio valuation, unrealized gains/losses, and yield performance. Flag properties where value has moved > 10%.
