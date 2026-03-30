---
name: construction-scheduling
description: "Build and maintain construction programmes with look-aheads, trade sequencing, and site logistics"
metadata:
  klawty:
    emoji: "📅"
---

# Construction Scheduling

Create, update, and defend the construction programme. Manage 3-week look-aheads, coordinate trade sequencing, handle weather delays, and ensure the master schedule reflects reality on the ground.

## Musts

- Never schedule concurrent trades in the same zone without confirming access and safety clearance
- Always maintain a 3-week look-ahead alongside the master programme
- Include mobilization and demobilization time for every subcontractor
- Account for curing times, drying times, and hold points in all schedules
- Never compress inspection hold points — they are regulatory, not negotiable
- Update the master schedule within 24 hours of any confirmed change

## Guidelines

- Use `list_milestones` to pull current schedule state before proposing changes
- Call `schedule_site_meeting` for look-ahead coordination meetings weekly
- Sequence wet trades before dry trades — always (concrete > screed > plaster > paint > joinery)
- Buffer weather-sensitive activities with contingency days (earthworks +20%, roofing +15%)
- Coordinate material deliveries with `track_delivery` to avoid site congestion
- Use `update_milestone_status` to reflect actual start/finish dates, not just planned

## Common Actions

### Build 3-Week Look-Ahead

When: Weekly, typically Monday morning cycle
How: Call `list_milestones` for activities scheduled in the next 21 calendar days. Cross-reference with `detect_delays` for any upstream blockers. Verify material deliveries via `track_delivery`. Confirm subcontractor availability. Output a prioritized activity list with dates, trades, zones, and prerequisites.
Example: Week 15-17 look-ahead — L1 MEP first fix (Mon-Fri), L2 blockwork (Mon-Wed), roof insulation (Thu-Fri), facade scaffolding erect (Week 16), window install (Week 17). Prereq: insulation delivery confirmed for Wednesday.

### Manage Weather Delays

When: Adverse weather forecast or actual weather stoppage
How: Identify affected activities (earthworks, concrete pours, roofing, external painting). Call `update_milestone_status` to record weather hold days. Recalculate schedule impact via `detect_delays`. If critical path affected, call `create_delay_alert` with recovery options.
Example: 3 days heavy rain forecast — postpone L3 slab pour from Thursday to Monday. Reallocate crew to internal blockwork (weather-independent).

### Coordinate Trade Handoffs

When: One trade completing and successor trade mobilizing in the same zone
How: Verify predecessor completion via `list_milestones`. Check inspection sign-off via `log_inspection` records. Call `schedule_site_meeting` for handoff walk-through if needed. Update successor start date in schedule.
Example: Plasterboard complete on L2 — schedule handoff meeting with painting sub. Confirm dust extraction done, surfaces primed, access scaffolding in place.

### Reschedule Activities

When: Delay, change order, or resource conflict requires programme adjustment
How: Assess impact on downstream activities and critical path. Use `allocate_resource` to check alternative resource availability. Call `update_milestone_status` with new dates and justification. Notify affected trades via `draft_client_email`.
Example: Elevator installation pushed 2 weeks due to manufacturing delay — reschedule shaft MEP work to fill gap, move elevator commissioning accordingly.
