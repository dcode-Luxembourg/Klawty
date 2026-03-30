---
name: lux-chart-of-accounts
description: "Reference the Luxembourg Plan Comptable Normalis (PCN) account structure and classification rules"
metadata:
  klawty:
    emoji: "📖"
---

# Luxembourg Chart of Accounts (PCN)

Provides the reference structure for the Plan Comptable Normalis — the standardized chart of accounts required for Luxembourg companies. Used as the classification backbone for all GL coding, financial statement preparation, and eCDF filing.

## Musts

- Always use 4-digit minimum account numbers following the PCN structure — sub-accounts may extend to 6 digits for internal detail.
- Never create accounts in class 0 (hors bilan) without understanding they represent off-balance-sheet commitments — they do not affect the balance sheet totals.
- Respect the class structure: 1 (capitaux), 2 (immobilisations), 3 (stocks), 4 (dettes/creances), 5 (tresorerie), 6 (charges), 7 (produits).
- Always map custom sub-accounts back to their PCN parent for eCDF filing — the administration only accepts standard PCN codes.

## Guidelines

- Class 1 (Capitaux propres): 101 (capital souscrit), 106 (reserves), 112 (report a nouveau), 141 (provisions reglementees). Private equity contributions go to 101, retained earnings to 112.
- Class 2 (Immobilisations): 211 (terrains), 213 (constructions), 2183 (materiel de bureau et informatique), 2187 (vehicules). Amortization mirrors in 28X accounts.
- Class 4 (Creances/Dettes): 401 (fournisseurs), 411 (clients), 421 (personnel — remunerations dues), 4451 (TVA en amont deductible), 4457 (TVA collectee).
- Class 6 (Charges): 601-607 (achats), 61 (services exterieurs), 62 (autres services exterieurs), 63 (impots et taxes), 64 (charges de personnel), 65 (autres charges de gestion), 66 (charges financieres), 67 (charges exceptionnelles).
- For eCDF annual filing, accounts must be mapped to the standard balance sheet and P&L templates published by the RCSL (Registre de Commerce et des Societes de Luxembourg).

## Common Actions

### Set up a new client's chart

Call `initialize_chart_of_accounts` with the client's industry and entity type (SARL, SA, SCS). Pre-populate with the standard PCN accounts plus industry-relevant sub-accounts. Verify the chart covers all account types needed for the annual eCDF filing.

### Validate account usage

Run `validate_chart_usage` to identify unused accounts (created but never posted to — cleanup candidates) and heavily used generic accounts (may need sub-account breakdown for better reporting).

### Map to eCDF format

Call `generate_ecdf_mapping` to produce the account-to-filing-line mapping required for the annual return. Verify every account with a balance is mapped to a filing line — unmapped accounts will cause eCDF rejection.
