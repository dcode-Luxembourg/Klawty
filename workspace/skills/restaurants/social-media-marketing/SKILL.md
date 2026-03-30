---
name: social-media-marketing
description: "Create and schedule social media content, run campaigns, and track engagement"
metadata:
  klawty:
    emoji: "📸"
---

# Social Media Marketing

This skill teaches the agent to manage the restaurant's social media presence — creating posts, scheduling content, running campaigns, and tracking performance. In hospitality, social media is the new shop window. Every post should make someone hungry or curious enough to book a table.

## Musts

- Never publish a post without owner approval. Use PROPOSE tier for all `schedule_post` and `create_social_post` calls.
- Never post more than once per day on the same platform unless it's a Story/ephemeral format.
- Always use the restaurant's established voice and visual style. No generic stock photo captions.
- Never post negative content about competitors, former staff, or difficult guests.
- Always include a call-to-action: book a table, check the menu, visit us, tag a friend.

## Guidelines

- Best posting times for restaurants: Tuesday-Friday 11:00-12:00 (lunch inspiration) and 17:00-18:00 (dinner planning). Schedule accordingly.
- Mix content types: 40% food/drink beauty shots, 25% behind-the-scenes/team, 20% events/specials, 15% guest features/UGC.
- Use `get_social_metrics` weekly to identify what resonates. Double down on high-engagement formats.
- Seasonal content should be planned 2 weeks ahead — don't announce the spring menu the day it launches.
- Hashtag strategy: 3-5 targeted hashtags per post (city + cuisine + occasion), never 30 generic ones.

## Common Actions

### Create a daily post

When to use: Scheduled content creation, typically during the morning cycle.
How: Call `create_social_post` with platform, caption, content type, and suggested image description. Tag the posting time. Submit via PROPOSE for owner review.
Example scenario: Thursday morning — create an Instagram post for 11:30: "Catch of the day: line-caught sea bass from Brittany, arriving at 6AM this morning. Pan-seared tonight with fennel and sauce vierge. Last tables at 20:30 — link in bio to book."

### Schedule a week of content

When to use: Monday morning planning cycle or when the owner requests a content calendar.
How: Draft 5-7 posts covering the week's highlights (daily specials, events, team features). Call `schedule_post` for each with platform, date/time, and content. Present the full calendar for approval.
Example scenario: Week plan: Monday (team spotlight — new sous chef), Wednesday (wine pairing evening promo), Thursday (catch of the day), Friday (weekend booking reminder), Saturday (behind-the-scenes prep kitchen video).

### Announce a menu change

When to use: New seasonal menu, new dish, or price update.
How: Call `draft_menu_announcement` with the menu details and target platforms. Create variations for different formats (carousel for Instagram, short text for Google Business, story for ephemeral).
Example scenario: Spring menu launch — Instagram carousel with 4 hero dishes, Facebook post with full menu link, Google Business update with new menu PDF.

### Run a campaign

When to use: Special events, holiday promotions, slow-period boosts.
How: Call `create_campaign` with objective (awareness, bookings, event RSVPs), duration, platforms, and content plan. Track with `get_social_metrics` during and after.
Example scenario: Valentine's Day campaign — 2 weeks before: teaser post. 1 week: menu reveal. 3 days: "last tables" urgency. Day-of: Stories from the evening. Day-after: thank you + next event tease.

### Review performance metrics

When to use: Weekly, as part of the owner briefing.
How: Call `get_social_metrics` for the past 7 days. Report on reach, engagement rate, follower growth, and top-performing post. Compare against previous week.
Example scenario: Instagram engagement rate 4.2% (industry avg 1.5%), top post was the kitchen behind-the-scenes reel (12K views). Follower growth +45 this week. Recommend more video content.
