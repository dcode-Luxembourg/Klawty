---
name: audit-trail-standards
description: "Maintain complete, tamper-evident audit trails for all accounting operations"
metadata:
  klawty:
    emoji: "📜"
---

# Audit Trail Standards

Ensures every accounting action — posting, modification, deletion, approval — is recorded with immutable traceability. Luxembourg commercial law (Code de Commerce Art. 16) requires that books be kept in a manner that ensures their regularity, and the AED expects complete audit trails during controls.

## Musts

- Never delete a journal entry — void it with a reversing entry and link both entries via reference. The original must remain visible.
- Always record the user/agent, timestamp, and reason for every modification to any accounting record.
- Never allow backdated postings more than 30 days without manager approval — late postings distort period reporting.
- Maintain sequential, gap-free numbering for journal entries and invoices — gaps trigger auditor inquiries.

## Guidelines

- Store audit data separately from operational data — audit logs must survive even if the main record is corrected.
- Retention period: Luxembourg requires 10 years for accounting records (Code de Commerce Art. 16). Plan storage accordingly.
- For automated postings (agent-generated), tag with the agent name and the triggering event — auditors want to trace from decision to posting.
- Reconciliation sign-offs, VAT return approvals, and year-end adjustments all require explicit audit trail entries.
- Export-ready audit trails: the AED may request transaction journals in specific formats during a fiscal control — maintain export capability.

## Common Actions

### Generate audit report

Call `get_audit_trail` filtered by date range, user/agent, or account. Produce a chronological journal showing every action with before/after states. Flag any entries that were modified post-period-close.

### Verify entry integrity

Run `check_entry_sequence` to verify gap-free numbering across all journals. Flag gaps, out-of-sequence entries, or duplicate numbers. These are the first things auditors check.

### Prepare for fiscal control

When the AED announces a control, call `export_audit_package` with the requested periods. Generate: journal entries, account balances, source document references, modification history, and reconciliation sign-offs in the format requested.
