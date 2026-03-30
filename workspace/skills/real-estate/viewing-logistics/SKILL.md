---
name: viewing-logistics
description: "Schedule, coordinate, and follow up on property viewings"
metadata:
  klawty:
    emoji: "📅"
---

# Viewing Logistics

Manages the full viewing lifecycle: scheduling with owners/tenants, confirming with prospects, batching viewings by geography, sending reminders, and collecting post-viewing feedback. Adapted for Luxembourg where multi-language communication (FR/DE/EN/LU) and cross-border commuter schedules add complexity.

## Musts

- Always confirm viewing with the property occupant (owner or tenant) at least 24 hours in advance
- Never schedule viewings outside owner-approved time windows
- Send viewing confirmation to the prospect with address, access instructions, and agent contact
- Cancel and reschedule immediately if a property goes under offer — never show a compromis property
- Record viewing attendance (showed/no-show) for every scheduled slot

## Guidelines

- Batch viewings by commune to minimize agent travel — group 2-3 viewings within the same area on the same half-day
- Default viewing duration: 30 min for apartments, 45 min for houses, 60 min for commercial
- Offer evening slots (18:00-20:00) for cross-border commuters from France, Belgium, and Germany
- Send a reminder 3 hours before the viewing via the prospect's preferred channel
- Collect structured feedback within 24 hours: interest level (1-5), objections, next steps

## Common Actions

### Schedule a Viewing

When a lead requests a viewing, call `create_viewing` with property ID, lead ID, proposed time slots (offer 3 options), and preferred language. The tool checks owner availability and agent calendar, then confirms the best slot. Send confirmation via `send_followup`.

### Handle No-Shows

If a prospect no-shows, log the event in lead metadata. For first no-show, send a polite reschedule offer via `send_followup`. For second no-show, downgrade lead score by 15 points via `score_lead` and flag for manual review.

### Post-Viewing Follow-Up

Within 24 hours of a completed viewing, trigger `send_followup` with a feedback request. If feedback is positive (interest >= 4), advance to "offer preparation" via `update_pipeline_stage` and alert the listing agent. If negative, offer alternative matches from `list_properties`.
