---
name: property-inspection
description: "Schedule, conduct, and document property inspections and condition reports"
metadata:
  klawty:
    emoji: "🔍"
---

# Property Inspection

Manages property inspections across the tenancy and transaction lifecycle: etat des lieux (move-in/move-out condition reports), periodic portfolio inspections, pre-sale assessments, and maintenance verification checks. Produces structured reports with photo documentation for dispute prevention and regulatory compliance.

## Musts

- Etat des lieux must be conducted contradictorily (both parties present or represented) — unilateral reports have no legal standing in Luxembourg
- Document every room with timestamped photos — verbal descriptions alone are insufficient for deposit disputes
- Move-in and move-out reports must use the same template and checklist for fair comparison
- Never release the garantie locative (deposit) without comparing move-in vs move-out etat des lieux
- Schedule inspections during daylight hours — natural light is required for accurate condition assessment

## Guidelines

- Use a standardized room-by-room checklist: walls, floors, ceiling, windows, doors, fixtures, appliances, utilities (meter readings)
- Record all meter readings (electricity, gas, water) at move-in and move-out — utility disputes are the most common tenant complaint
- For portfolio inspections (annual), focus on: structural issues, safety hazards, lease compliance, unauthorized modifications
- Pre-sale inspections should flag items that will appear in buyer due diligence: damp, cracks, electrical compliance, asbestos risk (pre-1997 buildings)
- Allow tenants 48 hours advance notice for non-emergency inspections — respect right to peaceful enjoyment (jouissance paisible)

## Common Actions

### Schedule and Log Move-In Inspection

When a new lease starts, call `process_move_in_out` with event type "move-in" to initiate the checklist. Schedule the etat des lieux via `log_inspection` with both parties, date, and property ID. After completion, upload the signed report and photos. This becomes the baseline for the tenancy.

### Conduct Move-Out Inspection

At lease end, call `log_inspection` to schedule the final etat des lieux. Compare against the move-in report room by room. Document discrepancies with photos. Call `process_move_in_out` with event type "move-out" and include the damage assessment. Calculate deposit deductions if applicable and present to both parties.

### Run Annual Portfolio Inspection

For managed properties, schedule annual inspections via `log_inspection`. Check structural condition, safety compliance (smoke detectors, fire extinguisher access), and tenant adherence to lease terms. Flag urgent maintenance items for immediate `create_maintenance_ticket` creation. Summarize findings in `produce_owner_report`.
