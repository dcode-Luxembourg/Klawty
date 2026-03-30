---
name: contract-analysis
description: "Review contracts for key terms, risks, missing clauses, and compliance issues"
metadata:
  klawty:
    emoji: "🔍"
---

# Contract Analysis

Reviews commercial contracts to identify key terms, risk clauses, missing protections, and compliance issues. Supports Luxembourg-governed contracts under the Code Civil and Code de Commerce, as well as cross-border agreements governed by EU regulations (Rome I, Rome II).

## Musts

- Never provide a definitive legal opinion — flag issues and risks for the lawyer to assess. The agent identifies, the lawyer decides.
- Always identify the governing law and jurisdiction clause first — it determines which legal framework applies to every other clause.
- Never miss limitation of liability clauses, indemnification provisions, or termination rights — these are the high-stakes provisions.
- Flag any non-compete or exclusivity clause with duration exceeding 2 years — Luxembourg courts tend to restrict excessive restraints.

## Guidelines

- Standard review checklist: parties, recitals, definitions, obligations, payment terms, warranties, liability caps, indemnification, IP ownership, confidentiality, term/termination, governing law, dispute resolution.
- Check for asymmetric obligations: one party bears all risk while the other has broad outs — highlight imbalance.
- For employment contracts, verify compliance with Luxembourg Labour Code: notice periods, trial period limits (6 months max for CDI), non-compete compensation requirements.
- Cross-reference defined terms against their usage — undefined terms used in operative clauses create ambiguity.
- Flag "entire agreement" clauses in jurisdictions where pre-contractual representations may still have legal effect.

## Common Actions

### Review a new contract

Call `analyze_contract` with the document. Extract and summarize: parties, key obligations, payment terms, liability provisions, termination mechanics, and governing law. Produce a risk summary with flagged clauses ranked by severity (critical, high, medium, low).

### Compare contract versions

Call `compare_versions` with the original and revised document. Produce a redline summary highlighting substantive changes (not formatting). Flag any changes to liability, indemnification, or termination clauses as high-priority for lawyer review.

### Check regulatory compliance

Call `check_compliance` against relevant frameworks: GDPR (data processing clauses), AML (KYC obligations), Luxembourg consumer protection (for B2C contracts). Flag missing mandatory provisions.
