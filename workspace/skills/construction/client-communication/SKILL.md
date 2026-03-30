---
name: client-communication
description: "Manage client correspondence, progress updates, meeting coordination, and feedback tracking for construction projects"
metadata:
  klawty:
    emoji: "🤝"
---

# Client Communication

Handle all client-facing communications for construction projects — progress updates, meeting coordination, issue notifications, variation requests, and feedback management. Professional, timely, and transparent communication builds client confidence.

## Musts

- Never send client communications without proposal approval — all external comms require review
- Always respond to client queries within 1 working day, even if only to acknowledge receipt
- Never promise completion dates without verifying against the current programme
- Include project reference numbers in all correspondence
- Never share internal cost breakdowns or subcontractor pricing with the client
- Log all client feedback via `log_client_feedback` for trend analysis and service improvement

## Guidelines

- Use `draft_client_email` for all written client communications — maintain consistent tone and format
- Call `send_client_report` only after report has been reviewed and approved
- Coordinate meeting schedules via `schedule_site_meeting` with adequate notice (48 hours minimum)
- Frame problems with solutions — never present an issue without a proposed resolution
- Keep language professional but accessible — avoid excessive construction jargon with non-technical clients
- Maintain a communication log — every email, call, and meeting recorded

## Common Actions

### Progress Update Email

When: Weekly or as agreed in the communication plan
How: Call `get_project_summary` for current status. Draft update via `draft_client_email` covering: work completed this period, work planned next period, any issues and their resolution, upcoming decisions needed from the client. Attach progress photos from `list_site_photos`. Route for approval before sending.
Example: Weekly update — "Dear Client, L1 MEP rough-in completed on schedule. Next week: L2 blockwork and roof insulation. Your input needed on bathroom tile selection by Friday to maintain the programme. 3 progress photos attached."

### Issue Notification

When: A problem arises that the client needs to know about (delay, cost impact, design issue)
How: Draft notification via `draft_client_email` with: what happened, why it happened, impact on programme and cost, proposed resolution, decision required (if any), and deadline for response. Always present the solution alongside the problem.
Example: "We discovered unexpected ground conditions during excavation — additional piling required. Programme impact: 5 working days. Cost impact: estimated 28K (detailed quote to follow within 48 hours). We recommend proceeding immediately to minimize further delay. Please confirm by Wednesday."

### Client Meeting Coordination

When: Regular progress meetings, design review meetings, or issue resolution meetings
How: Call `schedule_site_meeting` with proposed date, time, location, attendees, and agenda. Send invitation via `draft_client_email`. Prepare meeting pack with relevant reports and documents. After the meeting, circulate minutes with agreed actions and deadlines.
Example: Monthly progress meeting — agenda: programme review, cost update, design queries (3 outstanding RFIs), variation status (2 pending approval), upcoming milestone preview. Attendees: client PM, architect, QS, site manager.

### Variation Communication

When: Client requests a change or site conditions require a scope variation
How: Document the variation request. Assess programme and cost impact using `get_budget_vs_actual` and `detect_delays`. Draft formal variation notice via `draft_client_email` with scope description, cost estimate, programme impact, and approval request. Track approval status.
Example: Client requests additional power outlets in the office area — variation VO-012: 24 additional double sockets, cost estimate 3,800 (supply and install), programme impact: nil (can be incorporated into current MEP phase). Approval requested within 5 working days.

### Feedback Collection and Analysis

When: After milestone completion, at practical completion, and during defects liability period
How: Call `log_client_feedback` to record formal and informal client feedback. Categorize by theme (quality, communication, programme, cost, safety). Identify trends across projects. Use insights to improve processes and client experience.
Example: Post-completion feedback — client rates communication 4/5, quality 5/5, programme adherence 3/5 (delays due to weather, well-communicated). Action: improve weather contingency planning for future projects.
