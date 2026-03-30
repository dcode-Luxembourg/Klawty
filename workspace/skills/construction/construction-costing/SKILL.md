---
name: construction-costing
description: "Track budgets, manage cost variations, forecast final accounts, and control project expenditure"
metadata:
  klawty:
    emoji: "💰"
---

# Construction Costing

Monitor project budgets against actual expenditure, manage cost variations, forecast cost-to-complete, and maintain financial control throughout the construction lifecycle. Every euro tracked, every variance explained.

## Musts

- Never approve expenditure exceeding the approved budget without flagging via `flag_budget_overrun`
- Always reconcile invoices against approved purchase orders and certified work
- Track provisional sums and prime cost items separately from measured work
- Never include disputed amounts in cost reports without clear labelling
- Maintain contingency drawdown tracking — contingency is not a slush fund
- Report cost variance monthly at minimum, weekly on high-value projects

## Guidelines

- Call `get_budget_vs_actual` at the start of every cycle to establish current financial position
- Use `reconcile_invoices` to catch duplicate invoices, overpayments, and unbacked claims
- Forecast final account from day one — don't wait until practical completion
- Track change orders as separate cost lines with full audit trail
- Compare subcontractor interim valuations against measured progress, not time elapsed
- Monitor material price escalation clauses in contracts — they can blow budgets silently

## Common Actions

### Monthly Cost Report

When: End of each calendar month or as per contract reporting requirements
How: Call `get_budget_vs_actual` for all cost categories. Calculate committed costs (orders placed but not yet invoiced), accruals (work done but not yet certified), and forecast final account. Flag any category > 5% over budget. Include contingency status.
Example: Month 4 report — total budget 2.4M, committed 1.1M, spent 680K, forecast final 2.52M (+5% over budget driven by ground conditions variation). Contingency 120K, 40K drawn.

### Budget Variance Analysis

When: `get_budget_vs_actual` shows variance > 5% on any cost line
How: Identify root cause — scope change, design development, market price movement, or waste. Quantify the variance. Call `flag_budget_overrun` with cause and recommended action (value engineering, contingency draw, or client variation).
Example: Structural steel 18% over budget — cause: design change added 12 tonnes. Client variation claim prepared for 45K covering additional material and labour.

### Invoice Reconciliation

When: Subcontractor or supplier invoice received
How: Call `reconcile_invoices` to match against purchase order, delivery records (`track_delivery`), and certified work. Verify quantities, rates, and retention deductions. Flag discrepancies for query before payment approval.
Example: Plumbing sub invoice 34K — PO value 31K, difference is 3K for claimed daywork. No daywork sheet signed. Query raised, invoice held pending resolution.

### Contingency Management

When: Contingency draw requested or quarterly contingency review
How: Check total contingency budget, amount drawn to date, and committed draws. Assess remaining contingency against outstanding project risk items. If contingency below 3% of remaining project value, flag as insufficient.
Example: Contingency 120K — 55K drawn (ground conditions 30K, asbestos removal 25K). 65K remaining against 1.2M remaining works. At 5.4% — adequate but monitor closely.

### Forecast Final Account

When: Monthly or after any significant cost event (variation, delay claim, market shift)
How: Sum: original contract + approved variations + pending variations + anticipated claims + contingency allowance - savings identified. Compare against funding/budget approval. Flag if forecast exceeds approved project budget.
Example: Forecast final account 2.58M against 2.4M budget. Variance +180K: approved variations +95K, pending variations +45K, anticipated ground risk +40K. Recommend client approval for additional 180K funding.
