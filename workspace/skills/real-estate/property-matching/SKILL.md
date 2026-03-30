---
name: property-matching
description: "Match buyer/tenant search criteria against active property listings"
metadata:
  klawty:
    emoji: "🏠"
---

# Property Matching

Compares qualified lead requirements (budget, commune, surface, rooms, property type) against the active listing portfolio and returns ranked matches. Accounts for Luxembourg-specific factors like cadastral classification, energiepass ratings, and proximity to cross-border transport links.

## Musts

- Never present off-market or pre-mandate listings without explicit owner authorization
- Always include energiepass class in match results — mandatory disclosure under Luxembourg law
- Respect mandate exclusivity: exclusive listings only shown by the mandated agency
- Never match a lead to a property already under compromis de vente
- Surface areas must use net habitable (surface habitable) not gross built (surface construite)

## Guidelines

- Weight commune preference heavily — Luxembourg buyers are highly location-specific (Kirchberg vs Gasperich vs Esch matters)
- Include +/-15% budget tolerance and +/-1 room flexibility to expand thin result sets
- Factor in charges mensuelles (monthly charges) for apartments — a 600K apartment with 800€/month charges competes differently than one with 200€
- Cross-reference energiepass D or lower with potential renovation budgets when matching value-add investors
- Use `list_properties` with status filter "active" to avoid showing sold or withdrawn stock

## Common Actions

### Run Property Match for New Lead

After `score_lead` returns >= 60, call `list_properties` filtered by the lead's commune list, budget range, and minimum rooms. Rank by match score (weighted: location 40%, budget 30%, features 20%, energy class 10%). Return top 5 via `send_followup` with property summaries.

### Expand Search for Under-Served Lead

When initial match returns < 3 results, broaden criteria: extend to adjacent communes, increase budget ceiling by 10%, or relax room count by 1. Log the expansion in lead metadata so the agent can explain the broader suggestions.

### Alert on New Listing Match

When `sync_listing` adds a new property, scan all active leads with matching criteria. For leads with score >= 50 and matching profile, trigger `send_followup` with the new listing. Cap at 2 alerts per lead per week to avoid fatigue.
