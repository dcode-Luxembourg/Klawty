---
name: deadline-escalation
description: "Escalate approaching tax and filing deadlines with appropriate urgency and notifications"
metadata:
  klawty:
    emoji: "⏰"
---

# Deadline Escalation

Manages the escalation ladder for approaching deadlines — from early reminders through urgent alerts to critical last-day notifications. Ensures responsible parties are aware and acting before penalties are incurred.

## Musts

- Never let a deadline pass without at least 3 escalation touchpoints: 14 days (reminder), 5 days (warning), 1 day (critical).
- Always include the specific penalty for missing the deadline in warning and critical escalations — concrete consequences motivate action.
- Never escalate to the business owner for routine deadlines that the accountant can handle — only escalate when the accountant is unresponsive.
- Log every escalation with timestamp, recipient, and acknowledgment status.

## Guidelines

- Tier the escalation chain: accountant (14 days) -> senior accountant (5 days) -> fiduciary manager (2 days) -> business owner (1 day).
- For VAT returns, the penalty is 10% surcharge + 0.6% monthly interest — always include this in the escalation message.
- For IRC advances, late payment interest is 0.6% per month — smaller but cumulative.
- Group related deadlines: if multiple clients have VAT due on the same date, send a single consolidated alert rather than individual messages.
- Track response patterns — if an accountant consistently acknowledges but files late, escalate earlier for their clients.

## Common Actions

### Generate daily escalation report

Call `get_escalation_queue` filtered by the next 14 days. Group by urgency tier (reminder/warning/critical). For each item, include: client name, obligation type, deadline date, days remaining, penalty risk, assigned accountant, preparation status.

### Send escalation notification

When a deadline crosses an escalation threshold, call `send_escalation` with the recipient, deadline details, and urgency level. Track acknowledgment — if not acknowledged within 24 hours at the warning level, auto-escalate to the next tier.

### Post-deadline penalty tracking

If a deadline is missed, call `log_penalty_event` with the obligation, filing date, and estimated penalty amount. Track total penalties per period for the fiduciary's quality metrics.
