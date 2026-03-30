---
name: clause-library
description: "Maintain and retrieve pre-approved contract clauses organized by type and jurisdiction"
metadata:
  klawty:
    emoji: "📚"
---

# Clause Library

Manages a structured library of pre-approved, lawyer-vetted contract clauses — searchable by type, jurisdiction, and use case. Accelerates contract drafting by providing tested language instead of writing from scratch, while ensuring consistency across the firm's output.

## Musts

- Never use a clause from the library without verifying it matches the contract's governing law — a Luxembourg-law limitation clause may be invalid under German law.
- Always preserve the clause's internal defined terms — swapping terms without updating cross-references creates ambiguity.
- Never modify a "locked" clause (marked as regulatory-required or client-mandated) without lawyer approval.
- Track clause versioning — when a clause is updated, existing contracts using the old version must be identifiable.

## Guidelines

- Organize by category: liability (caps, exclusions, indemnification), termination (convenience, cause, insolvency triggers), IP (ownership, licenses, moral rights), confidentiality (scope, duration, carve-outs), dispute resolution (arbitration, mediation, jurisdiction), boilerplate (severability, notices, amendments, force majeure).
- Tag clauses with: jurisdiction applicability, risk level (standard/negotiated/aggressive), last review date, and usage count.
- Maintain multiple variants per clause type: "standard" (balanced), "client-favorable" (for own clients), "counterparty-favorable" (for understanding incoming drafts).
- Luxembourg-specific clauses to maintain: abusive clause protections (consumer contracts), commercial agent termination indemnity (Code de Commerce Art. L. 134-12), and data processing under GDPR.

## Common Actions

### Search for a clause

Call `search_clauses` with clause type, governing law, and risk level. Return matching clauses ranked by relevance and usage frequency. Include the last review date so the lawyer knows if the clause is current.

### Add a new clause

When a lawyer creates a novel clause worth reusing, call `add_clause` with the text, category, jurisdiction, risk level, and any usage notes. Submit for peer review before marking as approved.

### Update an existing clause

When law changes or court decisions affect a clause, call `update_clause` with the new text, change reason, and effective date. Flag all contracts using the old version for potential amendment.
