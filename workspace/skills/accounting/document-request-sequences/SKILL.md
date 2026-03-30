---
name: document-request-sequences
description: "Automate multi-step document collection from clients with follow-up cadences"
metadata:
  klawty:
    emoji: "📨"
---

# Document Request Sequences

Manages the recurring challenge of collecting financial documents from clients — bank statements, invoices, receipts, payroll data, contracts. Runs structured follow-up sequences that escalate in urgency while maintaining professional relationships.

## Musts

- Never send more than 3 follow-ups for the same document request without human review — persistent non-response may indicate a client relationship issue.
- Always specify exactly which documents are needed, for which period, and in what format — vague requests get vague responses.
- Never threaten penalties or consequences that the fiduciary cannot enforce — maintain a helpful, not adversarial, tone.
- Track document receipt status per client per period — incomplete records block the entire accounting cycle.

## Guidelines

- Standard sequence: initial request (day 0) -> gentle reminder (day 7) -> firm reminder (day 14) -> escalation to manager (day 21).
- Bundle document requests by period: ask for all January documents in one message, not separate requests for bank statements, invoices, and receipts.
- Provide upload instructions specific to the client's technical comfort level — some prefer email attachments, others use the portal.
- Send requests at the start of the month for the previous month's documents — clients need time to gather materials.
- For year-end closings, start the document collection campaign in January for the previous fiscal year — early start avoids March/April crunch.

## Common Actions

### Initiate monthly document request

At month start, call `generate_document_request` for each client with the list of required documents for the previous month. Send via `send_client_message` with a clear checklist format. Set follow-up reminders at day 7 and 14.

### Process follow-up sequence

Call `get_pending_requests` to identify clients with outstanding documents past the initial request date. For each, determine the sequence stage and send the appropriate follow-up via `send_followup_request` with increasing urgency but consistent politeness.

### Year-end collection campaign

Call `generate_yearend_checklist` per client with all required annual documents (bank statements, loan agreements, fixed asset schedules, inventory counts, payroll summaries). Track completion percentage and flag clients below 80% complete by March 1.
