---
name: limitation-periods
description: "Track prescription periods and statute of limitations under Luxembourg and EU law"
metadata:
  klawty:
    emoji: "⏳"
---

# Limitation Periods

Tracks prescription (statute of limitations) periods for claims under Luxembourg law — ensuring claims are filed before expiry and that expired adverse claims are identified for prescription defenses. Missing a limitation period is one of the most serious professional liability risks for a law firm.

## Musts

- Never let a limitation period expire without the lawyer being alerted at least 90 days in advance — this is a non-negotiable safety margin.
- Always verify the applicable limitation period against the specific legal basis — the same fact pattern can have different periods depending on the cause of action.
- Never assume interruption (interruption de la prescription) without confirming the specific act qualifies — not all communications interrupt prescription under Luxembourg law.
- Track both the standard and shortened periods: contractual claims may have shorter periods agreed by the parties (subject to limits).

## Guidelines

- Key Luxembourg limitation periods: general civil claims 30 years (Art. 2262 Code Civil — being reformed), commercial claims 10 years, tort claims 3 years from knowledge (Art. 2262bis), employment claims 3 years, tax claims (ACD) 5 years, consumer claims 2 years.
- The 2023 reform of Luxembourg prescription law introduced shorter general periods — verify current law for claims arising after the reform date.
- Interruption methods: judicial action (assignation), written acknowledgment of debt, partial payment. A simple letter does NOT interrupt prescription.
- Suspension (suspension de la prescription) during negotiations only applies if formally agreed — informal discussions do not suspend.
- For cross-border claims, determine which country's limitation law applies — under Rome I/II, limitation follows the applicable substantive law.

## Common Actions

### Register a limitation period

When a new matter opens, call `register_limitation` with the claim type, accrual date, applicable law, and calculated expiry date. Set automatic alerts at 180, 90, 30, and 7 days before expiry.

### Check prescription status

Call `get_limitation_status` for a case to see: remaining time, applicable period, any interrupting events, and next alert date. Flag cases where the period expires within 6 months and no proceedings have been initiated.

### Record an interrupting event

When a qualifying act occurs (filing of proceedings, debtor acknowledgment), call `record_interruption` with the date and nature of the event. Recalculate the new expiry date — a fresh full period starts from the interruption.
