---
name: warranty-management
description: "Process warranty claims, track coverage periods, and manage supplier returns for defective goods"
metadata:
  klawty:
    emoji: "🛡️"
---

# Warranty Management

Handles the full warranty lifecycle for resold products — from validating coverage and processing customer claims, to filing supplier returns and tracking replacements. Ensures compliance with EU consumer warranty obligations (2-year minimum) while protecting margins on defect costs.

## Musts

- Never deny a warranty claim within the EU 2-year legal guarantee period without documented justification (misuse, unauthorized modification).
- Always verify the purchase date and product serial number before processing any claim.
- Never promise a resolution timeline shorter than the supplier's stated RMA turnaround.
- Log every warranty interaction with timestamps — EU consumer law requires traceability.

## Guidelines

- Distinguish between manufacturer warranty (handled by supplier) and seller's legal guarantee (your obligation under EU law).
- For claims in the first 6 months, the burden of proof is on the seller to show the defect was not present at delivery (EU Directive 2019/771).
- Offer immediate replacement from stock for high-value customers while processing the supplier RMA in parallel — recover cost later.
- Track warranty claim rates per product and supplier — a defect rate above 3% warrants a supplier quality discussion.
- Maintain a warranty reserve in financial planning: estimate 1-2% of revenue for warranty costs based on historical claim rates.

## Common Actions

### Process a warranty claim

When a customer reports a defect, call `validate_warranty` with order ID and serial number to confirm coverage. If valid, call `create_warranty_claim` with defect description and photos. Determine resolution path: replacement from stock, repair, or supplier RMA via `create_rma_request`.

### Track open claims

Run `get_open_claims` to list all active warranty cases. Follow up on supplier RMAs pending > 14 days via `send_supplier_message`. Update the customer on status at least every 7 days during the resolution process.

### Warranty analytics

Call `get_warranty_report` to analyze claim rates by product, supplier, and defect type. Flag products with claim rates above 3% for review. Use data to negotiate better warranty terms with suppliers or to remove problematic products from catalog.
