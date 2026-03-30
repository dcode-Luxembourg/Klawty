---
name: reservation-management
description: "Manage table reservations, availability, waitlists, and no-show follow-ups"
metadata:
  klawty:
    emoji: "📋"
---

# Reservation Management

This skill teaches the agent to handle the full reservation lifecycle for a restaurant — from checking availability and booking tables, to managing waitlists and following up on no-shows. The agent acts as a digital maitre d', optimizing covers per service while maintaining hospitality standards.

## Musts

- Never double-book a table. Always call `check_availability` before `create_reservation` to confirm the slot is open.
- Never cancel a reservation without logging a reason. Use `cancel_reservation` with the cancellation reason field populated.
- Always follow up on no-shows within 24 hours using `send_no_show_followup` — this protects revenue and maintains the relationship.
- Never modify a reservation for a party size larger than the table capacity without reassigning the table.
- Treat VIP and regular guests identically in booking priority unless the owner has configured a VIP override policy.

## Guidelines

- Check `get_table_stats` at the start of each cycle to understand current occupancy and turnover rates.
- For peak hours (Friday/Saturday dinner, Sunday brunch), flag any reservation for 6+ guests to the owner for confirmation.
- When a service is fully booked, use `create_waitlist_entry` rather than turning guests away — capture the demand.
- Track no-show patterns per guest. Three no-shows in 90 days should trigger a flag in the activity log.
- Use 15-minute booking windows. A 19:00 reservation means the table is blocked from 18:45 to 21:00 (standard 2h15 turn).

## Common Actions

### Book a new reservation

When to use: Guest requests a table via phone, email, website form, or channel message.
How: Call `check_availability` with date, time, and party size. If available, call `create_reservation` with guest name, contact, party size, date/time, and any special requests (allergies, highchair, birthday).
Example scenario: "Table for 4 this Saturday at 20:00" — check Saturday 20:00 for 4-top availability, confirm and create.

### Handle a modification

When to use: Guest calls to change date, time, or party size.
How: Call `check_availability` for the new slot. If available, call `update_reservation` with the new details. If unavailable, offer the two nearest available slots.
Example scenario: Guest moves from Friday 19:30 to Saturday 19:30 — verify Saturday availability first, then update.

### Manage the waitlist

When to use: All tables are booked for a requested time slot.
How: Call `create_waitlist_entry` with guest details and preferred time window. Monitor cancellations during the cycle — if a slot opens, notify the first waitlist entry.
Example scenario: Fully booked Saturday dinner — add guest to waitlist, notify if a cancellation opens a 4-top between 19:00-21:00.

### Follow up on no-shows

When to use: A reserved guest did not arrive and did not cancel.
How: After the reservation time passes with no check-in, call `send_no_show_followup` with a polite message. Log the no-show in activity for pattern tracking.
Example scenario: 20:00 reservation, guest not seated by 20:30, no contact — send a "We missed you" follow-up with a rebooking link.

### Review table performance

When to use: Daily or weekly reporting cycle.
How: Call `get_table_stats` to pull occupancy rates, average turn times, no-show rates, and covers per service. Flag any table with consistently low utilization.
Example scenario: Monday morning review shows Table 12 (2-top by window) has 90% occupancy vs. Table 8 (6-top back corner) at 40% — suggest reconfiguring the floor plan.
