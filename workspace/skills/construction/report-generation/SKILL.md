---
name: report-generation
description: "Produce construction progress reports, site summaries, and project documentation for stakeholders"
metadata:
  klawty:
    emoji: "📊"
---

# Report Generation

Generate accurate, well-structured construction reports — weekly progress updates, monthly project summaries, site inspection reports, and completion documentation. Reports are the primary communication tool between the project team and stakeholders.

## Musts

- Never include unverified data in reports — cross-reference all figures against source records
- Always include programme status, cost status, and key risks in every progress report
- Report actual vs planned progress, not just activity lists
- Never omit negative information — delays, overruns, and issues must be reported factually
- Include clear action items with owners and deadlines in every report
- Date-stamp and version every report

## Guidelines

- Use `get_project_summary` to pull consolidated project data before drafting
- Call `get_budget_vs_actual` for financial sections — never estimate financial figures
- Reference `list_site_photos` to include visual progress evidence
- Use `generate_report_pdf` for formal distribution — always PDF, never editable formats for external parties
- Structure reports consistently — stakeholders expect the same format every period
- Keep executive summaries to 5 bullet points maximum — detail goes in the body

## Common Actions

### Weekly Progress Report

When: End of each work week (Friday afternoon)
How: Call `get_project_summary` for current status. Call `list_milestones` for activities completed this week and planned next week. Call `detect_delays` for any schedule risks. Call `list_site_photos` for progress photography. Compile into `draft_progress_report` with sections: summary, work completed, work planned, delays/issues, action items. Generate via `generate_report_pdf`.
Example: Week 14 progress report — completed: L1 MEP first fix, L2 blockwork. In progress: roof insulation (60%). Planned next week: facade scaffolding, L1 screed. Issue: window delivery delayed 5 days, mitigation in place. 4 site photos attached.

### Monthly Project Report

When: End of each calendar month
How: Compile weekly data into monthly summary. Add: cost report from `get_budget_vs_actual`, programme summary with critical path status, risk register update, change order log, health and safety statistics, quality inspection summary. Use `generate_report_pdf` for formal issuance.
Example: Month 4 report — programme: 2 days behind baseline (recovered from 5-day delay through weekend working). Cost: 680K spent of 2.4M budget, forecast on track. Safety: zero incidents, 4 weekly inspections completed. Quality: 2 snags outstanding from building control.

### Site Inspection Report

When: After any formal inspection (building control, client walk-through, safety audit)
How: Call `log_inspection` for the inspection record. Document findings, pass/fail items, required corrective actions, and reinspection requirements. Include photos via `list_site_photos`. Generate formal report via `generate_report_pdf`. Distribute to relevant parties.
Example: Building control inspection — ground floor structural frame. Result: passed with 2 minor observations (fire stopping detail at service penetrations, temporary propping removal sequence). Corrective actions assigned, reinspection not required.

### Completion Documentation

When: Approaching practical completion or sectional completion
How: Compile: snagging list status, outstanding works, test and commissioning results, certificate register, O&M manual status, as-built drawing status. Call `get_project_summary` for final metrics. Use `draft_progress_report` to create completion report. Generate via `generate_report_pdf`.
Example: Practical completion report — 98% works complete, 14 snag items (7 closed, 7 in progress, 0 outstanding beyond agreed rectification period). All statutory certificates received. O&M manuals 90% complete — outstanding: BMS commissioning data (due in 5 days).

### Custom Stakeholder Report

When: Specific request from client, investor, or regulatory body
How: Identify the audience and their information needs. Pull relevant data from project records. Use `get_project_summary`, `get_budget_vs_actual`, and `generate_audit_trail` as data sources. Draft focused report addressing specific questions. Generate via `generate_report_pdf`.
Example: Investor update requested — 2-page summary: project 62% complete, on programme, cost within 3% of budget, key milestone (watertight envelope) achieved on schedule, next milestone (MEP rough-in) in 4 weeks.
