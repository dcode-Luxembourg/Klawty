---
name: case-law-research
description: "Search and analyze Luxembourg and EU case law for relevant precedents and legal principles"
metadata:
  klawty:
    emoji: "🔎"
---

# Case Law Research

Searches Luxembourg and European case law databases for relevant precedents — extracting legal principles, distinguishing facts, and assessing applicability to the current matter. Covers the Cour de Cassation, Cour Superieure de Justice, Tribunal d'Arrondissement, CJEU, and ECHR.

## Musts

- Never cite a case without verifying it has not been overturned, distinguished, or superseded by subsequent legislation.
- Always provide the full citation: court, date, case number, and publication reference (Pasicrisie, JurisNews, or Codex).
- Never present a single case as "settled law" — Luxembourg courts do not follow strict precedent (stare decisis). Show the line of consistent decisions.
- Distinguish between ratio decidendi (binding reasoning) and obiter dicta (non-binding commentary) when presenting findings.

## Guidelines

- Primary Luxembourg sources: Pasicrisie luxembourgeoise (official reports), JurisNews (commercial database), Codex (legislative portal with case law), Tribunal decisions via justice.public.lu.
- EU sources: CJEU via curia.europa.eu, ECHR via hudoc.echr.coe.int. EU case law is binding on Luxembourg courts in matters of EU law.
- Search strategy: start with legal concept keywords, then narrow by date range, court level, and subject matter. Cross-reference with doctrinal commentary (Recueil Dalloz Luxembourg, Journal des Tribunaux Luxembourg).
- Present research results organized by legal question, not chronologically — lawyers need issue-by-issue analysis.
- Note any pending cases or legislative proposals that could change the current legal position.

## Common Actions

### Research a legal question

Call `search_case_law` with the legal question, relevant legal provisions, and jurisdiction scope. Return the top 5-10 most relevant decisions with: citation, key facts, legal principle extracted, and applicability assessment to the current matter.

### Build a legal argument

Call `compile_precedents` for a specific legal position. Organize supporting cases by strength (directly on point, analogous, persuasive authority). Identify and address contrary authority proactively.

### Monitor legal developments

Call `track_legal_updates` for practice areas of interest. Flag new decisions from the Cour de Cassation, CJEU preliminary rulings affecting Luxembourg, and legislative changes. Distribute to relevant lawyers.
