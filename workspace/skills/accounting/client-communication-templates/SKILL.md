---
name: client-communication-templates
description: "Generate professional fiduciary-to-client communications for common accounting situations"
metadata:
  klawty:
    emoji: "✉️"
---

# Client Communication Templates

Produces professional, clear communications from the fiduciary to clients — document requests, deadline reminders, fee quotes, and status updates. Maintains the formal-but-approachable tone expected in Luxembourg's fiduciary sector where relationships are long-term and trust-based.

## Musts

- Always address the client by name and reference their company — never send generic "Dear Client" messages.
- Never include specific tax figures or advice in routine communications — those belong in formal advisory letters with disclaimers.
- Always include a clear call-to-action: what the client needs to do, by when, and how to do it.
- Write in the client's preferred language (FR, DE, EN, LU) — Luxembourg is multilingual, never assume.

## Guidelines

- Keep messages concise: 3-5 short paragraphs maximum. Clients are business owners, not accountants — avoid jargon.
- For document requests, use checklist format — clients can tick off items as they gather them.
- Include the fiduciary's direct contact information for questions — personal service is a competitive advantage.
- Reference specific deadlines with the regulatory source (e.g., "VAT return due 15 March per AED requirements") — context adds urgency without being pushy.
- For fee-related communications, always reference the engagement letter or mandate terms.

## Common Actions

### Document request message

Call `draft_document_request` with client name, period, and required document list. Generate a message with a numbered checklist, preferred submission method (portal/email), and deadline. Tone: helpful and organized, not demanding.

### Deadline reminder

Call `draft_deadline_reminder` with the obligation type, date, and consequences of missing it. Escalate tone based on urgency tier: 14-day (informational), 5-day (action required), 1-day (critical — immediate action needed).

### Year-end status update

Call `draft_yearend_update` with the client's completion status (documents received, work done, pending items). Include next steps and expected timeline to filing. Clients appreciate knowing where they stand without having to ask.
