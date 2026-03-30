---
name: notarial-procedures
description: "Guide notarial act preparation, authentication requirements, and registration procedures in Luxembourg"
metadata:
  klawty:
    emoji: "⚖️"
---

# Notarial Procedures

Handles the preparation and follow-up of notarial acts (actes notaries) in Luxembourg — company formations, share transfers, real estate transactions, marriage contracts, and statutory amendments. Luxembourg's civil law system requires notarization for many legal acts that common law systems handle privately.

## Musts

- Never skip the notarization requirement — certain acts are void without notarial authentication (company formation, real estate transfers, statutory amendments for SA/SARL).
- Always verify the parties' identity documents and powers of representation before the notarial appointment — the notary will refuse to proceed without them.
- Never schedule a notarial appointment without confirming all prerequisite documents are ready — notary time is expensive and rescheduling damages the client relationship.
- Ensure publication in RESA within 15 days of the notarial act for company-related documents — late publication has legal consequences.

## Guidelines

- Key acts requiring notarization in Luxembourg: company incorporation, increase/decrease of share capital, amendment of articles, merger/demerger, real estate sale/purchase, mortgage (hypotheque), donation, marriage contract.
- Share transfers for SARL require notarial authentication; SA share transfers do not (private form sufficient).
- The notary charges based on the official tariff (Grand-Ducal regulation) — fees are proportional to the transaction value for real estate, fixed for corporate acts.
- Prepare a draft acte for the notary's review at least 5 business days before the appointment — notaries appreciate well-prepared files.
- Post-signing steps: registration with AED (enregistrement), publication in RESA, filing with RCSL, updating the RBE (Registre des Beneficiaires Effectifs).

## Common Actions

### Prepare a company formation

Call `prepare_formation_file` with entity type, shareholders, capital, registered office, and business purpose. Generate: draft articles of association, subscriber declarations, bank certificate of capital deposit, and registered office agreement. Coordinate the notarial appointment.

### Prepare a statutory amendment

Call `prepare_amendment_file` with the current statuts, proposed changes, and EGM (Extraordinary General Meeting) resolution. Generate the draft notarial amendment deed, updated coordinated statuts, and RCSL filing package.

### Track post-signing registrations

After a notarial act, call `track_registrations` to monitor: AED enregistrement (8 days), RESA publication (15 days), RCSL filing (1 month), RBE update (1 month). Alert on any approaching deadlines.
