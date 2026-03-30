---
name: project-management
description: "Orchestrate construction project lifecycles from mobilization through handover"
metadata:
  klawty:
    emoji: "🏗️"
---

# Project Management

Coordinate multi-phase construction projects across trades, timelines, and stakeholders. Track milestones, flag delays, allocate resources, and maintain project health from groundbreaking to practical completion.

## Musts

- Never move a milestone to "complete" without verified inspection sign-off
- Always check for downstream dependency impact before rescheduling any task
- Flag any milestone slippage exceeding 3 working days immediately via `create_delay_alert`
- Never auto-approve change orders — always route through proposal workflow
- Maintain a single source of truth for project status — never duplicate milestone data
- Include weather hold days in all schedule variance calculations

## Guidelines

- Run `get_project_timeline` at the start of every cycle to establish current baseline
- Cross-reference `get_budget_vs_actual` when milestones slip — delay = cost overrun
- Group related milestones by construction phase (foundations, structure, envelope, MEP, fit-out, snag)
- Use `generate_weekly_snapshot` every Friday for stakeholder reporting cadence
- Escalate resource conflicts between concurrent projects before they cause delays
- Track float consumption — when float drops below 5 days, flag the critical path

## Common Actions

### Monitor Project Health

When: Every cycle (15-20 min)
How: Call `list_milestones` filtered by status "in_progress" and "at_risk". Cross-reference with `detect_delays` to identify emerging slippage. For any delay > 2 days, call `create_delay_alert` with root cause and impacted downstream tasks.
Example: Foundation pour delayed 4 days due to waterlogged site — alert flags structural steel delivery needs rescheduling.

### Reallocate Resources

When: Trade bottleneck detected or subcontractor underperforming
How: Call `allocate_resource` to reassign labor or equipment. If a subcontractor is consistently behind programme, use `reassign_subcontractor` with documented performance evidence. Always notify the site manager via `draft_client_email`.
Example: Electrical rough-in falling behind — allocate additional electricians from Phase 2 pool.

### Update Milestone Progress

When: Site inspection confirms work completion or progress percentage change
How: Call `update_milestone_status` with new percentage, evidence notes, and any snag items. If milestone is now complete, verify that `log_inspection` has a passing record before marking done.
Example: Roof waterproofing membrane 100% — update milestone, attach inspection photo reference.

### Generate Weekly Snapshot

When: End of each work week (Friday afternoon cycle)
How: Call `generate_weekly_snapshot` to compile milestone progress, delay flags, resource allocation, and upcoming look-ahead. Output feeds into `draft_progress_report` for client distribution.
Example: Week 14 snapshot — 3 milestones completed, 1 at risk (MEP coordination clash), 2-day float remaining on critical path.

### Schedule Site Coordination

When: Trade overlap detected or pre-pour/pre-cover inspection needed
How: Call `schedule_site_meeting` with attendees (PM, site super, relevant trades), agenda items, and required documents. Link to relevant milestones.
Example: Pre-pour meeting for L2 slab — structural engineer, concrete sub, and formwork crew required on-site Thursday 07:00.
