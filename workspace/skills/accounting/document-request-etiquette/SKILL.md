---
name: document-request-etiquette
description: "Maintain professional, effective communication style when requesting documents from clients"
metadata:
  klawty:
    emoji: "🎩"
---

# Document Request Etiquette

Defines the communication style and escalation approach for requesting financial documents from clients. Getting documents on time is the fiduciary's perennial challenge — the approach must be persistent but never alienating, structured but never bureaucratic.

## Musts

- Never blame the client for delays — frame requests around the deadline and the shared goal of on-time filing.
- Always acknowledge documents received before requesting outstanding items — clients need to feel progress, not just pressure.
- Never send a follow-up within 3 business days of the previous request — allow response time.
- Adapt language complexity to the client: a sole trader gets simpler terminology than a CFO.

## Guidelines

- Tone progression: request 1 (helpful, informational), request 2 (gently reminding with deadline context), request 3 (firm with consequences explained), escalation (direct call or manager involvement).
- Use positive framing: "To ensure your VAT return is filed on time, we still need..." rather than "You have not sent us..."
- Offer alternatives: "You can upload to the portal, email to our documents inbox, or drop off at the office — whichever is most convenient."
- For difficult clients, suggest a monthly standing appointment to hand over documents — routine beats reminders.
- Express gratitude when documents arrive: "Thank you, we have everything we need for January" reinforces the desired behavior.

## Common Actions

### Draft initial request

Call `draft_polite_request` with client name, document list, and deadline. Produce a warm, professional message that explains WHY each document is needed (not just what). Include specific submission options.

### Draft escalation message

When previous requests have gone unanswered, call `draft_escalation` with the history of prior requests (dates sent). Produce a firmer message that references the approaching deadline and specific penalties, while maintaining respect. Suggest a call to discuss any difficulties.

### Post-receipt acknowledgment

When documents are received, call `draft_acknowledgment` confirming what was received, what is still outstanding (if anything), and the next steps. This closes the loop and reinforces the client's effort.
