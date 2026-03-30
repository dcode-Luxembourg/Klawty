---
name: local-seo
description: "Optimize local search presence, Google Business profile, and citation consistency"
metadata:
  klawty:
    emoji: "📍"
---

# Local SEO

This skill teaches the agent to manage the restaurant's local search visibility — ensuring the Google Business Profile is accurate, citations are consistent, and the restaurant appears in local pack results for relevant queries. For restaurants, 46% of all Google searches have local intent. If you're not in the local 3-pack, you're invisible.

## Musts

- Never change the restaurant's name, address, or phone number (NAP) without owner confirmation — inconsistent NAP data destroys local rankings.
- Always keep Google Business Profile hours accurate, especially for holidays, seasonal changes, and exceptional closures.
- Never keyword-stuff the business name on Google Business (e.g., "L'Atelier — Best French Restaurant Luxembourg" is a violation).
- Always respond to Google Q&A within 24 hours — unanswered questions signal neglect to both Google and potential guests.
- Never create duplicate Google Business listings. One verified listing per physical location.

## Guidelines

- Run `get_local_seo_status` weekly to check profile completeness, review count growth, photo count, and Q&A queue.
- Target keywords should focus on cuisine + location: "French restaurant Luxembourg City," "best brunch Kirchberg," "private dining Grund."
- Post Google Business updates weekly (events, specials, seasonal menus) — this signals activity to Google's algorithm.
- Maintain consistent NAP across all directories: Google, TripAdvisor, TheFork, Yelp, Facebook, Apple Maps, Foursquare.
- Photos matter: Google Business listings with 100+ photos get 520% more calls. Encourage photo uploads weekly.

## Common Actions

### Weekly SEO health check

When to use: Monday morning cycle, part of the weekly review.
How: Call `get_local_seo_status` to pull profile completeness score, review velocity, photo count, post recency, and citation consistency. Flag any issues (outdated hours, missing categories, stale posts).
Example scenario: Health check shows profile at 85% complete — missing: menu link, reservation link, and secondary category "Brunch restaurant." Fix immediately. Last Google post was 18 days ago — schedule a new one.

### Update business information

When to use: When hours change (seasonal, holidays, renovations), when a new menu launches, or when contact details change.
How: Prepare the update details and present to owner for approval via PROPOSE tier. Cover Google Business, TripAdvisor, TheFork, and Facebook simultaneously.
Example scenario: Summer hours start June 1 — kitchen opens at 18:30 instead of 19:00, closed Sundays instead of Mondays. Update all platforms before the change takes effect.

### Create a Google Business post

When to use: Weekly, or when there's a special event, new menu, or promotion.
How: Draft a 150-300 word post with a clear CTA (Book, Order, Learn More). Include a relevant photo description. Schedule via `create_social_post` targeting Google Business.
Example scenario: "This weekend: Truffle Menu. Three courses featuring fresh Perigord truffle — from truffle brioche to truffle risotto to our signature truffle creme brulee. Available Friday & Saturday only. Reserve your table."

### Monitor and improve citation consistency

When to use: Monthly, or when `get_local_seo_status` flags citation issues.
How: Review NAP consistency across the top 10 directories. Flag discrepancies (old phone number on TripAdvisor, wrong postcode on Yelp). Prepare correction tasks.
Example scenario: Audit finds the old phone number still listed on TheFork and an outdated address format on Apple Maps. Create tasks to update both.

### Track local ranking signals

When to use: Monthly, as part of the owner's business intelligence briefing.
How: Call `get_local_seo_status` for the full report. Combine with `get_sentiment_trends` (review velocity is a ranking factor) and social engagement data. Present trends over 30/60/90 days.
Example scenario: Review count grew from 142 to 168 in 30 days (+18%). Average rating stable at 4.4. Google Business profile views up 23%. Two new competitor listings appeared in the local pack — recommend increasing review solicitation and posting frequency.
