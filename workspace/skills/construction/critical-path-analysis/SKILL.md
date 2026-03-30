---
name: critical-path-analysis
description: "Identify and protect the longest sequence of dependent activities driving project completion"
metadata:
  klawty:
    emoji: "🔗"
---

# Critical Path Analysis

Analyze task dependencies, calculate float, and protect the critical path — the longest chain of activities that determines the earliest possible project completion date. Any delay on the critical path delays the entire project.

## Musts

- Never ignore zero-float activities — they ARE the critical path
- Always recalculate the critical path after any milestone reschedule or scope change
- Flag near-critical paths (total float < 5 days) alongside the critical path
- Never assume parallel trades are independent — check for shared resources and access constraints
- Include procurement lead times in dependency chains, not just site activities
- Distinguish between finish-to-start, start-to-start, and finish-to-finish relationships

## Guidelines

- Run `detect_delays` against critical path activities first — these are highest priority
- Use `get_project_timeline` to visualize the full dependency network before making changes
- When a critical activity slips, immediately check if fast-tracking or crashing is viable
- Monitor resource-leveled schedules — resource constraints can create hidden critical paths
- Track both planned and actual durations to improve future estimates
- Consider weather windows for weather-sensitive critical activities (concrete, roofing, earthworks)

## Common Actions

### Identify Critical Path

When: Project kickoff, major reschedule, or scope change
How: Call `get_project_timeline` for the full activity network. Call `detect_delays` to find zero-float chains. Flag all activities where total float = 0 as critical. Report near-critical activities (float < 5 days) as watch items.
Example: Critical path runs through piling > ground floor slab > structural steel > roof > envelope > MEP first fix > commissioning. Total duration: 38 weeks.

### Respond to Critical Path Delay

When: `detect_delays` flags slippage on a zero-float activity
How: Assess delay magnitude. If < 2 days, check if successor activities can absorb through reduced duration. If > 2 days, evaluate crashing (add resources via `allocate_resource`) or fast-tracking (overlap sequential activities). Call `create_delay_alert` with impact analysis and recovery options.
Example: Steel erection delayed 5 days — recommend weekend working (crash) and overlapping cladding prep with remaining steel (fast-track). Net recovery: 3 days.

### Float Consumption Monitoring

When: Every cycle — float erosion is the early warning system
How: Compare current float values against baseline. Any activity that has consumed > 50% of its original float without proportional progress should trigger a warning. Use `list_milestones` filtered by "at_risk" to correlate.
Example: MEP coordination started with 8 days float, now at 2 days with 40% progress — flag as near-critical before it becomes critical.

### Dependency Impact Assessment

When: Change order or reschedule request received
How: Trace forward through the dependency chain from the affected activity. Calculate total impact on project completion date. Use `get_project_timeline` to model the what-if scenario. Report findings before any approval.
Example: Client requests kitchen layout change — impacts MEP rough-in (3-day delay), tiling (pushed 3 days), fit-out (pushed 3 days). Total project impact: 3 days unless fast-tracked.
