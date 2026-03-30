---
name: safety-regulations
description: "Enforce construction health and safety regulations, manage risk assessments, and track incident reporting"
metadata:
  klawty:
    emoji: "🦺"
---

# Safety Regulations

Enforce health and safety compliance on construction sites. Manage risk assessments, method statements (RAMS), safety inspections, incident reporting, and regulatory obligations. Safety is non-negotiable — it overrides programme and cost.

## Musts

- Never allow work to start without an approved risk assessment and method statement (RAMS)
- Always verify CSCS cards (or local equivalent) for every operative before site access
- Flag any safety incident or near-miss immediately — zero tolerance for unreported events
- Never override a safety stop — any operative can stop work for safety concerns
- Ensure all high-risk activities have specific permits to work (hot works, confined space, working at height)
- Maintain an accident book and report notifiable incidents within statutory timeframes

## Guidelines

- Use `get_safety_checklist` to run through site-specific safety requirements before each work phase
- Call `schedule_inspection` for weekly safety walks and pre-activity safety briefings
- Check `check_certifications` for operative competency cards before task assignment
- Use `log_inspection` to record all safety inspections with findings and corrective actions
- Track RAMS approval status — unapproved RAMS = no work authorization
- Monitor PPE compliance, housekeeping standards, and exclusion zone maintenance

## Common Actions

### Pre-Activity Safety Review

When: Before any new activity or trade mobilizes on site
How: Call `get_safety_checklist` for the specific activity type. Verify RAMS are submitted and approved. Call `check_certifications` for operative competency (CSCS, PASMA, IPAF, SMSTS as required). Confirm permits to work are in place for high-risk activities. Clear site access.
Example: Roof work commencing — verify: RAMS approved, all operatives CSCS + IPAF certified, edge protection installed and inspected, rescue plan in place, permit to work for height issued, weather check (no work above 40mph wind).

### Weekly Safety Inspection

When: Every week without exception — schedule via `schedule_inspection`
How: Walk the site systematically zone by zone. Use `get_safety_checklist` as the inspection framework. Record findings via `log_inspection` — both compliant items and deficiencies. Assign corrective actions with deadlines. Track close-out of previous week's actions.
Example: Week 14 safety walk — 3 findings: unsecured penetration on L2 (immediate fix), missing fire extinguisher at hot works station (4-hour deadline), housekeeping below standard in stairwell (end of day deadline). Previous week: 2 of 2 actions closed.

### Incident Investigation

When: Any accident, near-miss, or dangerous occurrence reported
How: Secure the scene. Record initial facts via `log_inspection` with incident classification (first aid, RIDDOR-reportable, near-miss). Gather witness statements. Identify root cause and contributing factors. Define corrective and preventive actions. Report to authorities if legally required. Use `generate_audit_trail` for the investigation record.
Example: Operative struck by falling offcut from L3 — minor injury (first aid). Root cause: inadequate toe board on scaffold. Corrective: all scaffold toe boards inspected and secured within 24 hours. Preventive: add toe board check to daily scaffold inspection checklist.

### Permit to Work Management

When: High-risk activities requiring specific authorization (hot works, confined space, excavation, live services)
How: Issue permit with scope, duration, precautions, and emergency procedures. Verify operative competency via `check_certifications`. Record permit via `log_inspection`. Ensure permit is displayed at work location. Close permit at end of activity with sign-off.
Example: Hot works permit for welding steel connections on L2 — scope: structural connections grid A3-A7. Duration: 08:00-16:00. Precautions: fire watch 1 hour after, fire extinguisher within 5m, combustibles cleared 10m radius. Issued by site manager, signed by welder.

### Safety Certification Monitoring

When: Every cycle — expired safety credentials create immediate site access issues
How: Call `check_certifications` for all operatives and safety-critical equipment (scaffolding, lifting equipment, electrical installations). Call `flag_expiring_document` for anything within 30 days. Suspend site access for expired certifications.
Example: Scaffold inspection certificate expires in 12 days — flag. Crane annual examination due in 25 days — schedule with approved examiner. 2 operatives CSCS expired — suspend site access until renewed.
