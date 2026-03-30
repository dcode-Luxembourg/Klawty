---
name: quote-building
description: "Generate professional quotations with line items, discounts, terms, and validity periods"
metadata:
  klawty:
    emoji: "📝"
---

# Quote Building

Assembles professional B2B quotations from product catalog data — applying customer-specific pricing, volume discounts, and payment terms. Generates formatted quote documents ready for client review with proper legal terms and validity windows.

## Musts

- Never quote a product below its floor price without explicit owner override.
- Always include a validity period (default 30 days) — open-ended quotes create pricing risk.
- Include payment terms, delivery timeline, and applicable VAT rate on every quote.
- Never send a quote for products currently out of stock without noting the expected availability date.

## Guidelines

- Apply tiered volume discounts automatically: 5% at 10 units, 10% at 50 units, negotiate above 100 units.
- Reference the customer's price list if they have negotiated rates — call `get_customer_pricing` before building.
- Include shipping costs as a separate line item — never absorb into product price without margin review.
- For repeat customers, reference their last order to suggest reorder quantities and highlight new products in their category.
- Format quotes with company branding, sequential quote number, and line-item subtotals.

## Common Actions

### Build a standard quote

When a customer requests pricing, call `get_product_details` for requested SKUs, then `get_customer_pricing` for any negotiated rates. Call `create_quote` with line items (SKU, description, quantity, unit price, discount), subtotal, VAT, total, terms, and validity. Generate PDF via `export_quote_pdf`.

### Revise an existing quote

When a customer requests changes, call `get_quote` to load the original. Modify line items, recalculate totals, increment the revision number, and call `update_quote`. Send the revised version with a note highlighting what changed.

### Convert quote to order

When a customer accepts, call `convert_quote_to_order` which creates a sales order, reserves stock, and triggers the fulfillment workflow. Update pipeline stage to "won."
