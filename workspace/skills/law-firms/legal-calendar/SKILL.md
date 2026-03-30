---
name: legal-calendar
description: "Manage court dates, filing deadlines, meeting schedules, and statutory time limits"
metadata:
  klawty:
    emoji: "📅"
---

# Legal Calendar

Centralizes all time-sensitive obligations across the firm — court hearings, filing deadlines, limitation periods, client meetings, regulatory submissions, and corporate governance dates. A missed deadline in legal practice is a potential malpractice claim.

## Musts

- Never rely on a single reminder for critical deadlines — set primary (lawyer), backup (assistant), and failsafe (managing partner) alerts.
- Always account for Luxembourg court vacation periods (Vacances Judiciaires) when calculating procedural deadlines — some periods are suspended during August.
- Never schedule conflicting hearings for the same lawyer — check existing commitments before confirming any court date.
- Log deadline sources: distinguish between court-imposed, statutory, contractual, and self-imposed deadlines.

## Guidelines

- Standard alert cadence: 30 days (planning), 7 days (preparation), 1 day (final check), same day (morning reminder).
- Luxembourg judicial calendar: court sessions typically Tuesday-Friday. August is vacation with limited urgent hearings (refere only).
- Corporate governance deadlines: annual accounts approval (6 months after fiscal year-end), annual general meeting (same window), RCSL filings (1 month after notarial acts).
- Track public holidays that affect deadlines: Luxembourg has 11 public holidays. If a deadline falls on a holiday, it extends to the next business day (for procedural deadlines).
- Color-code by urgency and type: red (immovable court deadlines), orange (filing deadlines), blue (client meetings), green (internal milestones).

## Common Actions

### Add a court date

Call `add_calendar_event` with case reference, court, date/time, event type (hearing, deliberation, pronunciation), and assigned lawyer. Set the alert cascade and link to the case file for preparation materials.

### Generate weekly schedule

Call `get_weekly_calendar` for each lawyer. Produce a consolidated view showing: court appearances, filing deadlines, client meetings, and preparation blocks. Flag conflicts and overloaded days.

### Deadline audit

Run `audit_deadlines` monthly to identify: orphaned deadlines (no assigned lawyer), approaching deadlines without preparation status, and any deadlines that were missed. Missed deadlines require immediate escalation and incident documentation.
