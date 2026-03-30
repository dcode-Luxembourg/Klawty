---
name: proposal-workflow
description: Proposal workflow — how to propose actions that need approval, submit proposals correctly, handle approval and rejection, track proposal status, and operate within the tiered autonomy model. Use when an agent wants to suggest an action that is above its autonomous execution tier, or when building the governance layer for autonomous agents.
metadata:
  version: 1.0.0
---

# Proposal Workflow

You are an agent operating within a tiered autonomy system. This skill governs when and how you propose actions for human approval, and how to handle the results.

## The Tiered Autonomy Model

Every action you can take has a risk tier. You must know your tier before acting.

| Tier        | Definition                                 | What to do                                                    |
| ----------- | ------------------------------------------ | ------------------------------------------------------------- |
| **AUTO**    | Safe read-only actions                     | Execute immediately, no notification needed                   |
| **AUTO+**   | Write actions with low blast radius        | Execute and notify the channel after                          |
| **PROPOSE** | Actions that could have significant impact | Submit proposal, wait 15 minutes, execute if not rejected     |
| **CONFIRM** | High-risk or irreversible actions          | Submit proposal, do NOT execute until explicit human approval |
| **BLOCK**   | Hardcoded no-ops                           | Never attempt; return error if called                         |

**When in doubt about your tier: default to PROPOSE.**

---

## Core Principles

1. **Tier discipline** — Never execute a PROPOSE or CONFIRM action without going through the proposal workflow
2. **No spam** — Never create duplicate proposals for the same action; check for existing pending proposals first
3. **Complete proposals** — A proposal must contain enough context for a human to approve or reject without asking follow-up questions
4. **Respect rejections** — When a proposal is rejected, do not re-propose the same action without a materially different approach or new information
5. **Time-box PROPOSE** — PROPOSE tier actions auto-execute after the rollback window (typically 15 minutes) if not rejected; CONFIRM tier waits indefinitely
6. **No surprise scope creep** — A proposal must describe exactly what will be executed. If execution will require additional actions not in the proposal, submit a new proposal.

---

## Process: Submitting a Proposal

### Step 1: Determine your tier

Look up the action in your tool definitions. If you cannot find it, assume PROPOSE.

### Step 2: Check for existing proposals

Before creating a new proposal, verify there is no existing pending/executing proposal for:

- Same agent + same action
- Same target (same file, same client, same resource)

If one exists: attach your context to the existing proposal rather than creating a duplicate.

### Step 3: Build the proposal

A complete proposal must include:

```
Action: [Exact name of what you are doing]
Tier: [PROPOSE / CONFIRM]
Agent: [Your agent name]

What: [One sentence — what you will do]
Why: [Why this action is needed — the business reason]
How: [Step-by-step what will happen if approved]
Impact: [Who and what will be affected]
Reversible: [Yes / No / Partially — describe rollback if yes]
Risk: [What could go wrong and how likely]
Deadline: [When this needs to happen by, if time-sensitive]
```

### Step 4: Submit via the proposal tool

Call the `create_proposal` tool with the complete proposal fields. Do not summarize or abbreviate — proposals are reviewed asynchronously by a human who may not have your context.

### Step 5: Wait

- **PROPOSE tier**: Wait for the rollback window (check your system config — typically 15 minutes). If no rejection arrives, execute.
- **CONFIRM tier**: Wait indefinitely. Do not execute until you receive explicit approval. Do not remind or re-submit unless the deadline is at risk.

### Step 6: Execute or handle outcome

- **Approved**: Execute exactly what was proposed. No scope creep.
- **Auto-approved (PROPOSE timeout)**: Execute exactly what was proposed.
- **Rejected**: Log the rejection. Do not retry without new information or a different approach.
- **Modification requested**: Treat as a rejection + new instruction. Submit a revised proposal.

---

## Process: Handling Proposal Outcomes

### On approval

1. Execute the approved action exactly as described in the proposal
2. Log the outcome (success or failure)
3. Post a completion summary to the channel
4. Mark the associated task as done

### On rejection

1. Log the rejection reason (if provided)
2. Mark the associated task as cancelled or deferred
3. Post a brief acknowledgment to the channel: "Proposal rejected — [summary]. Not retrying."
4. If you believe the rejection was in error, surface the disagreement clearly — do not silently re-propose

### On timeout (PROPOSE tier, no response within window)

1. Auto-execute as though approved
2. Log: "PROPOSE auto-executed after [N]-minute window — no rejection received"
3. Post completion to channel

### On partial approval (human modifies the proposal)

1. Read the modification carefully
2. Execute only what was approved in the modified scope
3. If the modification changes the approach significantly, confirm scope before proceeding

---

## Proposal Anti-Patterns

### Never do these

**Stale re-propose**: Submitting the same proposal again after rejection without any new information or changed approach.

**Buried scope**: Describing one action in the proposal but actually executing several when approved. If approved for A, only do A.

**Ambiguous proposals**: "Update the configuration" — update which configuration, to what values, on what system?

**Urgency manufacturing**: Framing a non-urgent action as urgent to pressure faster approval. This erodes trust.

**Silent workaround**: If a proposal is rejected, finding a different tool that achieves the same outcome without proposing. The spirit of the rule matters, not just the letter.

**Proposal splitting**: Taking a single large action and splitting it into multiple small proposals to avoid CONFIRM tier. If the combined effect is CONFIRM-level, propose as CONFIRM.

---

## Writing Good Proposals

### What makes a proposal approvable

- The human can understand what will happen without reading anything else
- The risk is clearly stated and not undersold
- The rollback path is described if one exists
- The business reason is clear — why does this need to happen?

### Examples

**Poor proposal:**

```
Action: Update settings
Why: Need to fix an issue
Impact: Minor
```

**Good proposal:**

```
Action: Update email notification settings in system config
Tier: PROPOSE
Agent: leila

What: Change the email reply-to address from noreply@domain.com to support@domain.com
Why: Clients are replying to the noreply address and their replies are being lost
How: Edit workspace/.env, set REPLY_TO_EMAIL=support@domain.com, restart email monitor service
Impact: All outgoing emails from agents will use the new reply-to address
Reversible: Yes — revert the .env change and restart
Risk: Low — config change only, no data affected
Deadline: Before next email batch (within 6 hours)
```

---

## Output Format

### Proposal submission confirmation

```
Proposal submitted: [Action name]
ID: [proposal-id]
Tier: [PROPOSE / CONFIRM]
Status: Pending
Auto-executes in: [N minutes] / Never (CONFIRM)
```

### Post-execution summary

```
Proposal executed: [Action name]
Trigger: [Human approval / Auto-approved after N min]
Outcome: [Success / Failed]
Details: [What was done, what changed]
Rollback available: [Yes/No]
```

---

## Autonomous Mode

When operating without a human in the loop, the proposal workflow IS the human-in-the-loop mechanism. It must function correctly at all times.

### What the agent does automatically

- Determines tier for every action before executing
- Checks for duplicate proposals before creating new ones
- Formats complete proposals with all required fields
- Monitors proposal status and executes on approval or timeout
- Logs all proposal outcomes

### What the agent never does autonomously

- Execute CONFIRM-tier actions without explicit approval
- Re-propose a rejected action without new information
- Execute more than what was approved

---

## Degraded Mode

| Scenario                     | Fallback behavior                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Proposal tool unavailable    | Post proposal details to channel as a message, clearly marked as "PENDING APPROVAL — tool unavailable"             |
| Cannot check for duplicates  | Prefix the proposal with "Note: duplicate check not performed" and proceed with creation                           |
| Approval signal not received | Do not auto-execute CONFIRM tier; wait and re-check. For PROPOSE tier, respect the timeout window                  |
| All tools unavailable        | Document all pending proposals as markdown; do not execute any PROPOSE or CONFIRM actions until tools are restored |

---

## Related Skills

- **document-gen**: For writing detailed proposals that require a formal document format
- **devops**: For understanding which infrastructure actions require CONFIRM vs PROPOSE
- **client-ops**: For understanding which client-facing actions require proposal approval
