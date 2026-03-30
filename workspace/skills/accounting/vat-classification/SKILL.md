---
name: vat-classification
description: "Determine correct VAT treatment for transactions under Luxembourg and EU VAT rules"
metadata:
  klawty:
    emoji: "🇪🇺"
---

# VAT Classification

Determines the correct VAT rate, regime, and reporting treatment for each transaction based on Luxembourg VAT law and EU directives. Handles the complexity of intra-Community supplies, reverse charge mechanisms, triangulation, and mixed-use input VAT apportionment.

## Musts

- Always verify the counterparty's VAT number via VIES before applying zero-rate to intra-Community supplies (Article 43 of the Luxembourg VAT law).
- Never apply the super-reduced rate (3%) to goods or services outside the exhaustive legal list (food, books, children's clothing, pharmaceutical products).
- Always apply reverse charge (autoliquidation) for B2B services received from other EU member states — report in both boxes 56 and 65 of the VAT return.
- Never claim input VAT deduction on entertainment expenses (meals, events) beyond the 50% limitation.

## Guidelines

- Luxembourg VAT rates: 17% (standard), 14% (intermediate — wine, heating fuel, certain services), 8% (reduced — gas, electricity, cultural events), 3% (super-reduced — food, books, pharma).
- For mixed supplies (goods + services bundled), determine the principal supply to set the VAT rate — ancillary follows principal.
- Triangulation (ABC transactions within the EU): ensure proper simplified procedure reporting to avoid double taxation.
- Track the pro-rata deduction coefficient for businesses with both taxable and exempt activities — recalculate annually.
- Digital services to consumers in other EU states fall under OSS (One-Stop Shop) — apply the destination country's VAT rate.

## Common Actions

### Classify a purchase invoice

Call `classify_vat` with supplier country, VAT number, goods/services description, and amount. The system returns the applicable rate, regime (domestic/intra-EU/import/reverse charge), and the correct VAT return boxes. Verify against the supplier's VAT number validity.

### Prepare VAT return data

Run `get_vat_summary` for the declaration period (monthly or quarterly). Cross-check totals per box: box 46 (domestic sales), box 48 (intra-Community supplies), box 56 (intra-Community acquisitions), box 65 (reverse charge services). Flag discrepancies above 100 EUR.

### Handle a credit note

When a credit note is received, call `process_credit_note` to reverse the original VAT treatment. Ensure the credit note references the original invoice number and the VAT adjustment is recorded in the correct period.
