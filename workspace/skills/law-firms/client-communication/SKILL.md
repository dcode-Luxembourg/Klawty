---
name: client-communication
description: "Draft professional legal communications to clients with appropriate tone, structure, and disclaimers"
metadata:
  klawty:
    emoji: "💬"
---

# Client Communication

Drafts professional communications from lawyers to clients — status updates, legal advice summaries, risk assessments, and action item requests. Maintains the authoritative yet accessible tone expected in Luxembourg legal practice, where client relationships are often long-term and multi-generational.

## Musts

- Never provide legal advice without a disclaimer that the communication is based on the facts as understood and the law as of the date of writing.
- Always specify next steps and who is responsible for each action — clients need clarity on what they must do versus what the firm will handle.
- Never discuss fees or billing in a substantive legal communication — keep those in separate messages to avoid conflating advice quality with cost concerns.
- Write in the client's preferred language (FR, DE, EN) — ask if unknown, default to the language of previous correspondence.

## Guidelines

- Structure: greeting, purpose of the communication, background/context (brief), analysis/update, recommendations, next steps, closing.
- Use plain language for the analysis — legal terminology should be explained in parentheses when first used. The client is an expert in their business, not in law.
- For adverse news (unfavorable ruling, risk assessment), lead with the factual situation, then the legal analysis, then the available options. Never bury bad news.
- Proactively address the "so what" — clients care about business impact, not legal theory. Always connect the legal analysis to a practical recommendation.
- Keep status updates concise (half a page maximum). Save detailed analysis for formal legal memoranda.

## Common Actions

### Draft a status update

Call `draft_client_update` with case reference, recent developments, and current status. Produce a concise message covering: what happened since last contact, current position, next steps with dates, and any client action required.

### Draft a risk assessment

Call `draft_risk_assessment` with the legal question, analysis, and risk factors. Structure as: issue summary, applicable law, risk evaluation (low/medium/high with reasoning), recommended course of action, and alternatives.

### Draft an advice letter

Call `draft_advice_letter` with the client question, research findings, and conclusions. Produce a formal letter with: background, question presented, applicable law, analysis, conclusion, and recommended next steps. Include standard disclaimers.
