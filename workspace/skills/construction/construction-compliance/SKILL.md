---
name: construction-compliance
description: "Ensure regulatory compliance across permits, building codes, environmental requirements, and quality standards"
metadata:
  klawty:
    emoji: "📋"
---

# Construction Compliance

Manage regulatory compliance throughout the project lifecycle — building permits, planning conditions, environmental obligations, quality certifications, and statutory inspections. Non-compliance stops projects and creates liability.

## Musts

- Never allow work to proceed on activities requiring permits until the permit is confirmed active via `list_permits`
- Always track planning condition discharge deadlines — missed deadlines can void permits
- Flag any expired or expiring certification within 30 days via `flag_expiring_document`
- Never bypass statutory inspection hold points — they are legally mandated
- Maintain a compliance register as the single source of truth for all regulatory obligations
- Document all compliance evidence with dates, references, and responsible parties

## Guidelines

- Call `list_permits` at the start of every cycle to check permit status and conditions
- Use `check_certifications` to verify subcontractor and material compliance
- Schedule statutory inspections via `schedule_inspection` with adequate notice (minimum 48 hours)
- Cross-reference building control inspection requirements with the construction programme
- Track environmental obligations separately — noise limits, dust suppression, waste management
- Keep a pre-commencement conditions tracker — many permits have conditions to satisfy before any work starts

## Common Actions

### Permit Status Review

When: Every cycle and before any new phase of work begins
How: Call `list_permits` to check all active permits, their conditions, and expiry dates. Verify pre-commencement conditions are discharged. Flag any permit approaching expiry or with outstanding conditions. Cross-reference with `list_milestones` to ensure no work is scheduled without valid permits.
Example: Building permit BP-2024-1234 — 12 conditions, 8 discharged, 4 outstanding. Condition 9 (acoustic assessment) due before L2 fit-out starts in Week 18. Flag for immediate action.

### Statutory Inspection Scheduling

When: Construction programme reaches a hold point requiring building control or regulatory inspection
How: Call `schedule_inspection` with inspection type, location, date, and required attendees. Ensure minimum notice period is met. Prepare inspection pack via `request_document` for required drawings and certificates. Log result via `log_inspection`.
Example: Pre-pour inspection for L3 suspended slab — structural engineer and building control required. Notice given 5 working days. Inspection pack: structural drawings rev C, rebar bending schedule, concrete mix design certificate.

### Certification Compliance Check

When: New subcontractor mobilizing, material delivery, or quarterly compliance audit
How: Call `check_certifications` for all active subcontractors and critical material suppliers. Verify trade licenses, insurance, safety cards (CSCS/equivalent), and quality accreditations. Call `flag_expiring_document` for anything within 30 days of expiry.
Example: Quarterly audit — 14 active subcontractors, 12 fully compliant, 1 insurance expiring in 22 days (flagged), 1 missing updated risk assessment (work suspended until provided).

### Environmental Compliance Monitoring

When: Every cycle during active construction phases
How: Check noise monitoring logs, dust suppression records, waste transfer notes, and discharge consents. Cross-reference against planning conditions and environmental permits. Flag any breach or near-miss. Use `generate_audit_trail` to compile evidence.
Example: Noise complaint received from adjacent property — check monitoring logs: 78dB at boundary vs 75dB limit during restricted hours. Flag breach. Implement additional hoarding and reschedule noisy activities to permitted hours.

### Compliance Audit Trail

When: Regulatory inspection, client audit, or project close-out
How: Call `generate_audit_trail` to compile all compliance evidence — permits, inspection records, certifications, environmental monitoring, waste records. Organize chronologically with cross-references. Ensure no gaps in the record.
Example: Building control final inspection preparation — compile all 23 inspection records, fire safety certificates, commissioning reports, and as-built drawings into audit pack.
