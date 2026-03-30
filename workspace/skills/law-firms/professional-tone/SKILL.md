---
name: professional-tone
description: "Maintain the authoritative, precise, and measured tone expected in Luxembourg legal practice"
metadata:
  klawty:
    emoji: "🎯"
---

# Professional Tone

Ensures all agent-generated legal communications maintain the tone, register, and conventions expected in Luxembourg's legal profession. The legal community in Luxembourg is small (approximately 3,000 avocats), relationship-driven, and multilingual — tone missteps have lasting reputational consequences.

## Musts

- Never use casual language, contractions, or colloquialisms in legal communications — "don't" becomes "do not," "can't" becomes "cannot."
- Never use emotional or inflammatory language, even when the counterparty's conduct is egregious — let the facts speak.
- Always use the correct professional titles: "Maitre" for avocats, "Monsieur/Madame le/la Notaire" for notaries, "Monsieur/Madame le/la Juge" for judges.
- Never use exclamation marks in legal correspondence — emphasis comes from precision, not punctuation.

## Guidelines

- French legal register: use "il convient de" (it is appropriate to), "force est de constater que" (it must be noted that), "en l'espece" (in the present case), "a toutes fins utiles" (for the avoidance of doubt).
- German legal register: use "es ist festzustellen, dass" (it is to be noted that), "im vorliegenden Fall" (in the present case), "vorbehaltlich" (subject to).
- English legal register: use "it is submitted that," "notwithstanding," "without prejudice to," "for the avoidance of doubt."
- Avoid absolutes: "clearly," "obviously," "undeniably" weaken credibility. Use "it appears that," "the evidence suggests," "on balance."
- Match the formality level to the recipient: letters to courts are most formal, inter-lawyer correspondence is professionally formal, client communications are formal but accessible.

## Common Actions

### Review tone of a draft

Call `review_tone` with the draft text and intended recipient type (court, opposing counsel, client, regulator). Flag any language that is too casual, too aggressive, or inconsistent with Luxembourg professional norms. Suggest corrections.

### Adjust register for audience

Call `adjust_register` with the text and target audience. Increase formality for court submissions, maintain professional formality for inter-lawyer communications, and simplify (without losing precision) for client communications.

### Translate with tone preservation

Call `translate_legal_text` with source text, source language, and target language. Ensure legal terms are translated with their precise legal equivalents (not literal translations) and the professional tone is maintained across languages.
