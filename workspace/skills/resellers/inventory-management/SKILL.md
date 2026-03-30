---
name: inventory-management
description: "Track stock levels, trigger reorder alerts, and sync inventory across sales channels"
metadata:
  klawty:
    emoji: "📦"
---

# Inventory Management

Monitors real-time stock positions across warehouses and sales channels, triggers reorder points, and prevents overselling. Handles multi-channel sync (own webshop, Amazon, eBay, B2B portal) to maintain a single source of truth for available quantities.

## Musts

- Never allow a channel listing to show stock that does not exist in the master inventory — sync before publishing.
- Always trigger a reorder alert when stock drops below the SKU's minimum threshold, even if a purchase order is already open.
- Never modify reserved stock (allocated to confirmed orders) — only unreserved quantities are available for new sales.
- Log every stock adjustment with reason code (receipt, sale, return, damage, audit correction).

## Guidelines

- Run `get_stock_levels` at cycle start to identify SKUs below reorder point or approaching zero.
- Use `sync_channel_inventory` after every stock movement to keep marketplace listings accurate within 15 minutes.
- Track lead times per supplier — factor them into reorder point calculations (safety stock = avg daily sales x lead time x 1.3).
- Flag dead stock (zero sales in 90 days) for markdown or bundle promotion consideration.
- Reconcile physical counts against system counts monthly using `run_stock_audit`.

## Common Actions

### Process a stock receipt

When goods arrive from a supplier, call `receive_stock` with PO reference, SKU list, and quantities. Verify against the purchase order — flag discrepancies (short shipments, wrong items). Then call `sync_channel_inventory` to update all marketplace listings.

### Handle a reorder alert

When `get_stock_levels` returns SKUs below threshold, call `create_purchase_order` with the supplier, SKUs, and calculated reorder quantities (EOQ or fixed lot). Notify the owner if the order value exceeds the auto-approve limit.

### Investigate stock discrepancy

When a channel reports oversell or a customer order fails stock check, call `get_stock_history` for the SKU to trace movements. Identify whether the gap is from unsync'd returns, missing receipts, or a count error. Adjust with `stock_adjustment` and a documented reason.
