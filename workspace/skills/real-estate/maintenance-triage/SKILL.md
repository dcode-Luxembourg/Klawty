---
name: maintenance-triage
description: "Triage, prioritize, and route property maintenance requests to appropriate contractors"
metadata:
  klawty:
    emoji: "🔧"
---

# Maintenance Triage

Receives maintenance requests from tenants, classifies urgency, assigns to qualified contractors, and tracks resolution through completion. Handles Luxembourg-specific requirements including copropriete (co-ownership) approval workflows, syndic coordination, and seasonal maintenance schedules.

## Musts

- Emergency requests (water leak, heating failure in winter, security breach) must be routed within 1 hour — never queue overnight
- Always verify if the repair falls under landlord or tenant responsibility per the Luxembourg bail terms before dispatching
- Never authorize expenditure above the owner-defined threshold without explicit owner approval
- Track all maintenance costs per property for annual decompte des charges accuracy
- Coordinate with the syndic for common-area issues in copropriete buildings — never dispatch directly

## Guidelines

- Classify urgency into 3 tiers: emergency (< 4 hours), standard (< 48 hours), scheduled (next available slot)
- Maintain a preferred contractor list per trade (plombier, electricien, serrurier, chauffagiste) with response time ratings
- For heating issues between October-April, treat as emergency tier regardless of stated severity — Luxembourg winters are not optional
- Bundle non-urgent requests for the same property into a single contractor visit to reduce costs
- Log all communications and contractor access times for liability documentation

## Common Actions

### Triage Incoming Request

When a tenant submits a maintenance request, call `list_maintenance_requests` to check for duplicates on the same unit. Classify urgency based on category and season. Call `create_maintenance_ticket` with urgency tier, description, and affected unit. For emergency tier, immediately call `route_to_contractor` with the highest-rated available contractor for that trade.

### Route to Contractor

Call `route_to_contractor` with ticket ID, trade category, urgency tier, and property address. The tool selects from the preferred contractor list based on availability, proximity, and rating. Sends job details to the contractor and notifies the tenant of the expected response window.

### Close and Report Maintenance

After contractor confirms completion, update the ticket with resolution details, cost, and photos. If cost exceeds the pre-authorized amount, hold for owner approval. Monthly, aggregate maintenance data into `produce_owner_report` showing spend by category, response times, and outstanding items.
