---
name: lease-management
description: "Track lease terms, renewals, rent indexation, and tenancy lifecycle events"
metadata:
  klawty:
    emoji: "📋"
---

# Lease Management

Monitors active lease agreements, tracks key dates (start, renewal, break clauses, expiry), handles rent indexation per Luxembourg's STATEC cost-of-living index, and manages the full tenancy lifecycle from signature to move-out. Covers both residential bail (3+3+3 year model) and commercial bail.

## Musts

- Never auto-increase rent beyond the legal maximum — Luxembourg caps indexation at the STATEC indice des prix
- Alert on lease renewal windows at least 90 days before the clause date — legal notice periods are strict
- Never terminate a lease without human confirmation — eviction procedures require formal legal steps
- Store all lease documents with version history — amendments must reference the original bail number
- Distinguish between residential and commercial leases — different legal frameworks apply

## Guidelines

- Track the garantie locative (rental deposit) amount and holding institution for each lease
- Monitor rent payment regularity via `track_rent_payments` — flag 2+ consecutive late payments for escalation
- For commercial leases, track indexation clauses separately (often tied to different indices than residential)
- Maintain a renewal calendar showing all leases expiring in the next 6 months
- Cross-reference lease terms with property maintenance obligations to flag landlord responsibilities

## Common Actions

### Track Lease Renewal

Call `track_lease` to scan all active leases for upcoming renewal dates within 90 days. For each match, call `alert_renewal` to notify the property manager with lease terms, current rent, applicable indexation, and suggested renewal conditions. Generate renewal letter draft if authorized.

### Process Rent Indexation

Annually, retrieve the latest STATEC index and calculate permissible rent adjustments for each lease. Call `track_lease` to update the indexed rent amount. Generate a tenant notification via `send_tenant_notice` with the new amount, effective date, and legal basis (article reference).

### Generate Owner Report

Monthly, call `produce_owner_report` per property or portfolio. Include: rent collected vs expected, vacancy days, maintenance costs, net yield, upcoming lease events. Flag any arrears exceeding 30 days or maintenance spend exceeding quarterly budget.
