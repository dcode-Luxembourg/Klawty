---
name: lux-tax-calendar
description: "Track Luxembourg tax filing deadlines, advance payments, and regulatory submission dates"
metadata:
  klawty:
    emoji: "📅"
---

# Luxembourg Tax Calendar

Maintains the complete schedule of Luxembourg tax obligations — VAT returns, corporate income tax (IRC) advances, municipal business tax (ICC), net wealth tax, wage tax declarations, and annual filings. Ensures nothing is missed and escalations trigger well before deadlines.

## Musts

- Never miss a VAT return deadline — penalties are 10% of the VAT due plus 0.6% monthly interest (AO Art. 155).
- Always schedule IRC advance payments on the correct quarterly dates (10 March, 10 June, 10 September, 10 December).
- Never file an annual tax return without the accountant's explicit sign-off — the agent prepares, the fiduciary validates.
- Track each client's filing regime separately — some are monthly VAT, others quarterly, some annual.

## Guidelines

- Key Luxembourg tax deadlines: VAT monthly (15th of the following month), VAT quarterly (15th of the month following the quarter), IRC advances (quarterly on the 10th), Annual IRC/ICC return (31 May of the following year, extendable to 31 December with request).
- Net wealth tax (IF) is due 31 March with advance payments — often overlooked by new businesses.
- Wage tax declarations (RTS) are due monthly by the 10th for employers.
- Monitor the ACD (Administration des Contributions Directes) portal for assessment notices — they have strict response windows (typically 3 months for objections).
- Factor in the summer/year-end congestion: fiduciary capacity drops in June and December, start preparation early.

## Common Actions

### Generate monthly deadline report

Call `get_upcoming_deadlines` with a 30-day window. List all obligations by client, type, and date. Highlight any that require data gathering (VAT returns need purchase/sales ledger, wage tax needs payroll data). Send to the accountant for prioritization.

### Escalate approaching deadlines

For deadlines within 5 business days where the filing is not yet marked "prepared," trigger an escalation via `create_deadline_alert`. Include the specific obligation, client name, amount if known, and consequences of late filing.

### Track advance payment schedule

Call `get_advance_payments` for the current quarter. Verify amounts match the latest tax assessment. If the business situation has changed significantly, suggest a reduction request to the ACD via `draft_advance_reduction`.
