---
name: reputation-management
description: "Monitor reviews across platforms, draft responses, and track sentiment trends"
metadata:
  klawty:
    emoji: "⭐"
---

# Reputation Management

This skill teaches the agent to monitor, analyze, and respond to online reviews across Google, TripAdvisor, TheFork, and other platforms. A restaurant's online reputation directly impacts covers — one unanswered negative review can cost dozens of bookings. The agent ensures every review gets attention and the owner sees the big picture.

## Musts

- Never publish a review response without owner approval. Always use PROPOSE tier for `draft_review_response`.
- Never argue with a reviewer or deny their experience. Acknowledge, apologize, and offer resolution.
- Always flag 1-star and 2-star reviews as urgent using `flag_urgent_review` — these need same-day attention.
- Never use templated copy-paste responses. Each response must reference specific details from the review.
- Always respond to negative reviews within 24 hours and positive reviews within 48 hours.

## Guidelines

- Run `fetch_reviews` at least twice daily (morning and evening) to catch new reviews promptly.
- Use `classify_review` to categorize feedback by theme: food quality, service speed, ambiance, value for money, cleanliness, noise level.
- Track response rate with `track_review_response_rate` — target is 95%+ for negative reviews, 80%+ overall.
- Run `get_sentiment_trends` weekly to spot patterns: if "service speed" complaints spike, it's a staffing or workflow issue, not a one-off.
- Positive reviews mentioning specific staff members should be forwarded to the owner for recognition.

## Common Actions

### Morning review scan

When to use: First cycle of each day.
How: Call `fetch_reviews` for all connected platforms (Google, TripAdvisor, TheFork) since last check. Call `classify_review` on each new review. Call `flag_urgent_review` for any review rated 1-2 stars.
Example scenario: Morning scan finds 3 new Google reviews (5-star, 4-star, 2-star). The 2-star mentions "waited 40 minutes for mains" — flagged urgent, classified under "service speed."

### Draft a response to a negative review

When to use: When a review is flagged urgent or rated 1-3 stars.
How: Call `draft_review_response` with the review text, rating, platform, and classification. The draft should acknowledge the specific complaint, apologize sincerely, explain briefly (without excuses), and invite the guest to return.
Example scenario: 2-star review: "Food was good but we waited forever and the waiter seemed annoyed." Draft: "Thank you for your feedback, [name]. You're right — a 40-minute wait for mains is not our standard, and I'm sorry your experience fell short. I've spoken with our service team about the evening in question. We'd love to welcome you back — please reach out directly and your next aperitif is on us."

### Draft a response to a positive review

When to use: When a review is rated 4-5 stars.
How: Call `draft_review_response` with a warm, specific thank-you. Reference what the guest praised. Keep it brief — 2-3 sentences.
Example scenario: 5-star review praising the tasting menu and sommelier. Draft: "So glad you enjoyed the tasting menu — Chef Marc puts real thought into the seasonal pairings. And we'll pass your kind words along to Antoine, our sommelier. Hope to see you again soon!"

### Weekly sentiment report

When to use: Monday morning, as part of the weekly owner briefing.
How: Call `get_sentiment_trends` for the past 7 days. Call `track_review_response_rate` for the same period. Call `create_reputation_report` combining both.
Example scenario: Report shows average rating 4.3 (up from 4.1), 12 new reviews, 100% negative response rate, "ambiance" sentiment improved after acoustic panels were installed. One recurring theme: "portions too small on the prix fixe" — flag for chef review.

### Track response rate

When to use: Weekly or when the owner asks about review management performance.
How: Call `track_review_response_rate` with the date range. Break down by platform and rating tier.
Example scenario: Overall response rate 88% — Google at 95%, TripAdvisor at 72%. The gap is because 3 TheFork reviews from last week were missed. Catch up immediately.
