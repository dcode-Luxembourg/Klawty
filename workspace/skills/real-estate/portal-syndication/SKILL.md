---
name: portal-syndication
description: "Syndicate and synchronize property listings across real estate portals"
metadata:
  klawty:
    emoji: "🌐"
---

# Portal Syndication

Manages the publication, update, and withdrawal of property listings across Luxembourg and European property portals (atHome.lu, Immotop.lu, ImmoScout24, Idealista). Ensures listing data consistency, photo compliance, and regulatory field completeness across all channels.

## Musts

- Every listing must include energiepass class and valid date — portal publication without it violates Luxembourg regulations
- Never publish a listing without a signed mandate (mandat de vente) on file
- Withdraw listings from all portals within 24 hours of compromis signature
- Photos must not show identifiable personal belongings or people — GDPR applies to listing images
- Price changes must propagate to all portals simultaneously — never show different prices on different portals

## Guidelines

- Publish to atHome.lu first (dominant Luxembourg market share), then syndicate to secondary portals
- Use portal-specific photo limits: atHome allows 30, Immotop allows 20 — lead with best photos on limited portals
- Refresh listing descriptions every 30 days to maintain portal ranking algorithms
- Track portal performance per listing: views, inquiries, click-through — use this to recommend portal spend allocation
- Include commune-level keywords in descriptions for portal search optimization (e.g., "Gasperich", "Ban de Gasperich")

## Common Actions

### Publish a New Listing

When a mandate is signed, call `sync_listing` with property data, photos, and target portals. The tool validates required fields (energiepass, surface, price, commune, cadastral ref) and publishes to each portal's API. Confirm publication with listing URLs.

### Update Listing Details

When price or availability changes, call `update_listing` with the modified fields. The tool propagates changes to all active portals via `sync_listing` and logs the change with timestamp. Alert the listing agent of successful sync or any portal-specific errors.

### Monitor Portal Performance

Weekly, generate a portal performance summary using listing view/inquiry data. Flag listings with > 60 days on market and < 10 views/week for description refresh or price review. Recommend portal budget reallocation based on cost-per-inquiry metrics.
