---
name: document-compliance
description: "Manage regulatory documents, mandates, and compliance checks for property transactions"
metadata:
  klawty:
    emoji: "📑"
---

# Document Compliance

Ensures all property transaction and management documents meet Luxembourg regulatory requirements. Tracks mandate validity, energiepass certification, cadastral extracts, urbanisme certificates, and anti-money-laundering (AML) due diligence documentation required under CSSF supervision.

## Musts

- Never proceed with a sale without valid mandat de vente signed by all property owners (indivision cases require all co-owners)
- Energiepass must be valid (< 10 years old) before any listing or transaction — expired certificates block publication
- AML/KYC checks are mandatory for all transaction parties — verify identity documents and source of funds before compromis
- Archive all documents for minimum 5 years post-transaction per Luxembourg regulatory requirements
- Never delete original documents — only archive with `archive_document`, maintaining full audit trail

## Guidelines

- Maintain a compliance checklist per transaction: mandate, energiepass, cadastral extract, certificat d'urbanisme, soil certificate, AML forms
- Flag missing documents at each pipeline stage — block stage advancement if critical documents are absent
- Track document expiry dates (energiepass, mandates with fixed terms, professional indemnity insurance)
- For new construction (VEFA), verify promoter guarantees (garantie d'achevement) and building permits
- Cross-reference cadastral data with Actes Civils (Administration du Cadastre) for ownership verification

## Common Actions

### Run Compliance Check

Before a transaction advances to compromis, call `check_compliance` with the transaction ID. The tool verifies all required documents are present, valid, and correctly signed. Returns a compliance score and lists any blocking deficiencies. Flag results to the notaire coordinator.

### Generate Transaction Mandate

When an owner engages the agency, call `generate_mandate` with owner details, property cadastral reference, mandate type (exclusive/simple), duration, and commission terms. The tool produces a mandate document conforming to Luxembourg chambre immobiliere standards.

### Archive Completed Transaction

After acte notarie, call `archive_document` for all transaction files. Tag with transaction reference, parties, property cadastral number, and completion date. Set retention flag to prevent deletion before the 5-year regulatory minimum.
