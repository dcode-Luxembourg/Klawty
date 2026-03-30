---
name: conflict-checking
description: "Screen new matters and clients against existing representations to identify conflicts of interest"
metadata:
  klawty:
    emoji: "🚫"
---

# Conflict Checking

Screens new client matters against the firm's existing and historical representations to identify conflicts of interest. Luxembourg bar rules (Reglement Interieur de l'Ordre des Avocats) impose strict conflict obligations — breaches can result in disciplinary proceedings and professional liability claims.

## Musts

- Never open a new matter without completing a conflict check — no exceptions, regardless of urgency or client relationship.
- Check against ALL parties: the prospective client, opposing parties, related entities (subsidiaries, shareholders, directors), and connected individuals.
- Never override a conflict flag without the managing partner's documented approval and the implementation of an ethical wall.
- Retain conflict check records permanently — they are the firm's defense against future conflict allegations.

## Guidelines

- Search broadly: variations of entity names (with/without legal form suffix), trading names, former names, and key individuals (directors, UBOs).
- Check across all practice areas — a corporate client may be adverse in litigation, or a former client in a completed transaction may now be on the other side.
- Related entity conflicts: representing a subsidiary while adverse to the parent creates a conflict. Map corporate groups.
- Time-based considerations: former client conflicts apply if the new matter is substantially related to the prior representation and confidential information was shared.
- Consult the Luxembourg bar's specific rules on simultaneous representation and successive conflicts — they are stricter than some other jurisdictions.

## Common Actions

### Run a new matter conflict check

Call `check_conflicts` with all party names, related entities, and key individuals. Search against: current clients, former clients (last 7 years), adverse parties, and related matters. Return any matches with relationship details and the referring lawyer.

### Screen a lateral hire

When a new lawyer joins the firm, call `screen_lateral_conflicts` with their prior client list. Identify overlaps with the firm's existing clients or adverse parties. Implement ethical walls where necessary before the lawyer accesses any files.

### Update conflict database

When a new matter opens or a matter closes, call `update_conflict_records` with all parties, related entities, and the engagement scope. This ensures future checks have complete data.
