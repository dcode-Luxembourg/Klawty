---
name: client-retention
description: "Monitor customer health, detect churn signals, and trigger re-engagement workflows"
metadata:
  klawty:
    emoji: "🔄"
---

# Client Retention

Tracks customer purchasing patterns to detect churn risk early, triggers proactive re-engagement, and maintains relationship health through regular touchpoints. Focuses on keeping existing B2B customers active and growing their order frequency and basket size.

## Musts

- Never contact a customer more than once per week for retention purposes — over-communication accelerates churn.
- Always check `get_customer_history` before reaching out — reference their specific products and order patterns, not generic messages.
- Never offer discounts as the first retention lever — value-add (priority support, early access, training) before price cuts.
- Flag any customer whose order frequency drops by > 40% compared to their rolling 6-month average.

## Guidelines

- Segment customers into tiers by annual revenue: A (top 20%, personal attention), B (middle 50%, automated cadence), C (bottom 30%, self-service).
- Track "days since last order" per customer — alert thresholds vary by segment (A: 30 days, B: 60 days, C: 90 days).
- After resolving a complaint or return, schedule a satisfaction check-in 14 days later.
- Send personalized product recommendations based on purchase history — customers who bought X typically need Y.
- Celebrate milestones: 1-year anniversary, 10th order, reaching a volume tier. Small gestures build loyalty.

## Common Actions

### Churn risk detection

Run `get_churn_risk_report` to identify customers with declining order frequency or value. For each flagged account, review recent interactions via `get_customer_history`. Draft a personalized re-engagement message referencing their specific situation.

### Quarterly business review

For A-tier customers, generate a `create_customer_review` summarizing their purchase volume, top products, savings achieved, and suggestions for optimization. Present as a value report, not a sales pitch.

### Win-back campaign

For customers inactive > 90 days, call `get_customer_history` to understand their last purchase and any complaints. Draft a win-back message via `draft_retention_email` with a relevant offer (new product in their category, improved terms, or a service upgrade).
