---
name: inventory-tracking
description: "Monitor stock levels, track waste, manage par levels, and optimize food cost"
metadata:
  klawty:
    emoji: "📦"
---

# Inventory Tracking

This skill teaches the agent to maintain visibility over the restaurant's stock — monitoring levels against par, logging waste, and surfacing cost insights. Good inventory management is the difference between a 28% food cost and a 35% one. The agent acts as a perpetual inventory clerk that never forgets to count.

## Musts

- Never allow a menu item to be served if its key ingredients are flagged as out-of-stock. Alert the kitchen and front-of-house immediately.
- Always log waste with a reason category using `log_waste` — prep waste, spoilage, over-production, customer return, or staff meal.
- Never adjust par levels without reviewing at least 2 weeks of consumption data.
- Always cross-reference stock levels against upcoming reservations — a fully booked Saturday with low protein stock is a crisis.
- Never discard items approaching expiry without checking if they can be repurposed (staff meal, soup base, daily special).

## Guidelines

- Run `check_stock_levels` at the start of every cycle. Items below 50% of par level should trigger a reorder alert.
- Track waste as a percentage of purchases. Industry benchmark is under 4% — anything above 6% needs investigation.
- Use FIFO (First In, First Out) as the default stock rotation assumption when logging inventory.
- Flag items with high waste-to-purchase ratios — these may indicate over-ordering, poor storage, or menu items that don't sell.
- Correlate stock consumption with covers served to detect theft or unrecorded usage.

## Common Actions

### Daily stock check

When to use: Start of each morning cycle, before the kitchen opens for prep.
How: Call `check_stock_levels` for all active categories. Flag items below par. Cross-reference against today's reservation count to prioritize urgency.
Example scenario: Morning check shows cream at 2L (par: 8L), 45 covers booked tonight with 3 cream-based dishes on the menu — trigger urgent reorder.

### Log prep waste

When to use: After morning prep or end-of-service, when the kitchen reports waste.
How: Call `log_waste` with item name, quantity, unit, reason (prep trim, spoilage, overproduction), and estimated cost. Tag the responsible station if applicable.
Example scenario: Butcher station reports 1.2kg beef trim from portioning — log as prep waste, cost 22 EUR. This is expected (12% trim yield on whole tenderloin).

### Log spoilage

When to use: When items are discarded due to expiry, temperature abuse, or quality degradation.
How: Call `log_waste` with reason "spoilage" and add details on the root cause (delivery issue, fridge failure, over-ordering).
Example scenario: 3kg mozzarella expired — log spoilage, 18 EUR loss. Root cause: ordered Thursday, not used by Sunday, no weekend brunch menu uses mozzarella. Recommend reducing par level.

### Generate food cost analysis

When to use: Weekly, typically Monday morning alongside the supplier cost report.
How: Call `get_cost_report` for the week. Calculate food cost percentage: (total food purchases + opening stock - closing stock - waste) / food revenue. Compare against the 28-32% target.
Example scenario: Week's food cost at 31.8% — within target but trending up. Waste is 5.2% (above 4% benchmark). Top waste item: mixed salad greens at 8kg/week. Recommend switching to whole heads and prepping in-house.

### Forecast stock needs

When to use: Before weekends, holidays, or special events when demand will spike.
How: Call `check_stock_levels` and compare against expected covers (from `list_reservations` count + walk-in estimate). Calculate required quantities using historical consumption-per-cover ratios.
Example scenario: 120 covers booked for Saturday (normal is 80). Protein consumption averages 0.25kg per cover. Current stock: 18kg. Need: 30kg. Trigger order for 15kg additional protein.
