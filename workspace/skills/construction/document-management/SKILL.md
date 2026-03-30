---
name: document-management
description: "Control construction document workflows including drawings, submittals, RFIs, and as-built records"
metadata:
  klawty:
    emoji: "📁"
---

# Document Management

Manage the document lifecycle for construction projects — drawing revisions, submittals, RFIs, specifications, certificates, and as-built records. Every document tracked, every revision controlled, every transmittal logged.

## Musts

- Never allow construction to proceed on superseded drawings — always verify latest revision
- Always maintain a document register with revision history and distribution records
- Flag any overdue submittal or RFI response beyond the contractual response period
- Never delete documents — superseded revisions must be retained with clear status marking
- Track document approvals with timestamps and approver identity
- Ensure all site-critical documents are accessible offline (site copies)

## Guidelines

- Use `request_document` to formally track outstanding information needs with deadlines
- Call `flag_expiring_document` for certificates, warranties, and insurance approaching expiry
- Maintain a drawing register separate from general documents — drawings have revision-specific workflows
- Use `generate_audit_trail` for transmittal records — who received what, when
- Name documents consistently: `[Project]-[Type]-[Number]-[Rev]` (e.g., PROJ01-DWG-STR-042-C)
- Scan and log all site instructions, architect's instructions, and verbal instructions in writing

## Common Actions

### Drawing Revision Control

When: New drawing revision issued by design team
How: Log the new revision in the drawing register. Identify who holds superseded copies. Distribute updated revision via transmittal with `generate_audit_trail`. Call `request_document` to recall superseded site copies. Verify affected work areas are notified.
Example: Structural drawing STR-042 updated from Rev B to Rev C — beam connection detail changed. Notify steel fabricator (affects shop drawings), site foreman (affects installation sequence), and building control (affects structural certificate).

### Submittal Tracking

When: Subcontractor or supplier required to submit material data, shop drawings, or samples for approval
How: Create submittal log entry with required date, specification reference, and approver. Track submission, review, and approval status. Call `flag_expiring_document` if response is overdue. Use `request_document` to chase outstanding submittals.
Example: Kitchen extract ductwork shop drawings — submitted by MEP sub, forwarded to architect for review. Contractual response period: 10 working days. Day 8 — flag approaching deadline, chase architect.

### RFI Management

When: Contractor or subcontractor needs clarification on design or specification
How: Log RFI with question, reference documents, urgency, and required response date. Track response. If response affects programme, link to relevant milestones. If overdue, escalate via `draft_client_email` to design team.
Example: RFI-087: Waterproofing detail at terrace/facade junction unclear on drawing ARC-105 Rev D. Response needed within 5 working days — terrace waterproofing scheduled Week 19.

### As-Built Record Compilation

When: Ongoing throughout construction and formally at practical completion
How: Collect as-built drawings, test certificates, commissioning records, O&M manuals, and warranties from all trades. Use `request_document` to chase outstanding items. Cross-reference against the O&M requirements in the specification. Compile into structured handover pack.
Example: Practical completion in 4 weeks — 67% of O&M documents received. Outstanding: fire alarm commissioning certificate, lift compliance certificate, BMS as-built drawings. Chase via formal document request with 2-week deadline.

### Document Audit

When: Monthly or pre-inspection
How: Call `generate_audit_trail` to verify document register completeness. Check for missing revisions, unsigned approvals, and undistributed transmittals. Flag gaps. Ensure critical documents (permits, insurance, safety plans) are current.
Example: Monthly audit — 342 documents registered, 12 pending approval (3 overdue), 4 transmittals unacknowledged. Zero missing statutory documents. Flag 3 overdue approvals for escalation.
