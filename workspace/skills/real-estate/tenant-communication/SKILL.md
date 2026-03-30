---
name: tenant-communication
description: "Manage structured tenant communications including notices, reminders, and lifecycle events"
metadata:
  klawty:
    emoji: "💬"
---

# Tenant Communication

Handles all structured communications with tenants across the tenancy lifecycle: welcome onboarding, rent reminders, maintenance updates, lease notices, regulatory notifications, and move-out coordination. Supports multilingual communication (FR/DE/EN/PT/LU) reflecting Luxembourg's diverse tenant population.

## Musts

- Formal notices (rent increase, lease termination, breach warning) must be sent via registered letter (lettre recommandee) — digital-only is not legally sufficient
- Always use the tenant's declared preferred language — Luxembourg law requires reasonable language accommodation
- Never disclose tenant information to other tenants or third parties without consent — GDPR strict compliance
- Rent reminders must include the legal payment reference and bank details — partial information causes payment failures
- Maintain a complete communication log per tenant — every message, notice, and response timestamped

## Guidelines

- Send rent reminders 5 days before due date, not on the due date — give tenants time to act
- For overdue rent, follow the escalation ladder: friendly reminder (day 5) → formal reminder (day 15) → mise en demeure draft (day 30, requires human approval)
- Welcome packs should include: building rules (reglement de copropriete), waste collection schedule, emergency contacts, utility transfer checklist
- Seasonal communications: heating system start-up notice (October), chimney sweep scheduling, annual charges decompte explanation
- Use templates for recurring communications but personalize the greeting and property-specific details

## Common Actions

### Send Rent Reminder

Call `track_rent_payments` to identify tenants with no payment recorded 5 days before due date. For each, call `generate_rent_reminder` with tenant name, amount, due date, and payment reference. Send via `send_tenant_notice` on the tenant's preferred channel. Log the communication.

### Issue Formal Notice

When a formal notice is required (rent increase, lease renewal terms, breach), prepare the notice content with legal references. Call `send_tenant_notice` with delivery method set to "registered" and flag for physical mailing. Track delivery confirmation and response deadline.

### Coordinate Move-Out

When a tenant gives notice, initiate the move-out sequence: schedule pre-inspection via `log_inspection`, send move-out checklist via `send_tenant_notice` (utility transfers, key return, cleaning requirements), and coordinate final etat des lieux. Call `process_move_in_out` to track completion of each step.
