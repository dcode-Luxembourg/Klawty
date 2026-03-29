---
name: ab-test-setup
description: When the user wants to plan, design, or implement an A/B test or experiment. Also use when the user mentions "A/B test," "split test," "experiment," "test this change," "variant copy," "multivariate test," "hypothesis," "should I test this," "which version is better," "test two versions," "statistical significance," or "how long should I run this test." Use this whenever someone is comparing two approaches and wants to measure which performs better. For tracking implementation, see analytics-tracking. For page-level conversion optimization, see page-cro.
metadata:
  version: 1.1.0
---

# A/B Test Setup

You are an expert in experimentation and A/B testing. Your goal is to help design tests that produce statistically valid, actionable results.

## Initial Assessment

**Check for product marketing context first:**
If `product-marketing-context.md` exists in the workspace, read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Before designing a test, understand:

1. **Test Context** - What are you trying to improve? What change are you considering?
2. **Current State** - Baseline conversion rate? Current traffic volume?
3. **Constraints** - Technical complexity? Timeline? Tools available?

---

## Core Principles

### 1. Start with a Hypothesis

- Not just "let's see what happens"
- Specific prediction of outcome
- Based on reasoning or data

### 2. Test One Thing

- Single variable per test
- Otherwise you don't know what worked

### 3. Statistical Rigor

- Pre-determine sample size
- Don't peek and stop early
- Commit to the methodology

### 4. Measure What Matters

- Primary metric tied to business value
- Secondary metrics for context
- Guardrail metrics to prevent harm

---

## Hypothesis Framework

### Structure

```
Because [observation/data],
we believe [change]
will cause [expected outcome]
for [audience].
We'll know this is true when [metrics].
```

### Example

**Weak**: "Changing the button color might increase clicks."

**Strong**: "Because users report difficulty finding the CTA (per heatmaps and feedback), we believe making the button larger and using contrasting color will increase CTA clicks by 15%+ for new visitors. We'll measure click-through rate from page view to signup start."

---

## Test Types

| Type      | Description                      | Traffic Needed |
| --------- | -------------------------------- | -------------- |
| A/B       | Two versions, single change      | Moderate       |
| A/B/n     | Multiple variants                | Higher         |
| MVT       | Multiple changes in combinations | Very high      |
| Split URL | Different URLs for variants      | Moderate       |

---

## Sample Size

### Quick Reference

| Baseline | 10% Lift     | 20% Lift    | 50% Lift     |
| -------- | ------------ | ----------- | ------------ |
| 1%       | 150k/variant | 39k/variant | 6k/variant   |
| 3%       | 47k/variant  | 12k/variant | 2k/variant   |
| 5%       | 27k/variant  | 7k/variant  | 1.2k/variant |
| 10%      | 12k/variant  | 3k/variant  | 550/variant  |

**Calculators:**

- [Evan Miller's](https://www.evanmiller.org/ab-testing/sample-size.html)
- [Optimizely's](https://www.optimizely.com/sample-size-calculator/)

**For detailed sample size tables and duration calculations**: See [references/sample-size-guide.md](references/sample-size-guide.md)

---

## Metrics Selection

### Primary Metric

- Single metric that matters most
- Directly tied to hypothesis
- What you'll use to call the test

### Secondary Metrics

- Support primary metric interpretation
- Explain why/how the change worked

### Guardrail Metrics

- Things that shouldn't get worse
- Stop test if significantly negative

### Example: Pricing Page Test

- **Primary**: Plan selection rate
- **Secondary**: Time on page, plan distribution
- **Guardrail**: Support tickets, refund rate

---

## Designing Variants

### What to Vary

| Category       | Examples                                          |
| -------------- | ------------------------------------------------- |
| Headlines/Copy | Message angle, value prop, specificity, tone      |
| Visual Design  | Layout, color, images, hierarchy                  |
| CTA            | Button copy, size, placement, number              |
| Content        | Information included, order, amount, social proof |

### Best Practices

- Single, meaningful change
- Bold enough to make a difference
- True to the hypothesis

---

## Traffic Allocation

| Approach     | Split                 | When to Use               |
| ------------ | --------------------- | ------------------------- |
| Standard     | 50/50                 | Default for A/B           |
| Conservative | 90/10, 80/20          | Limit risk of bad variant |
| Ramping      | Start small, increase | Technical risk mitigation |

**Considerations:**

- Consistency: Users see same variant on return
- Balanced exposure across time of day/week

---

## Implementation

### Client-Side

- JavaScript modifies page after load
- Quick to implement, can cause flicker
- Tools: PostHog, Optimizely, VWO

### Server-Side

- Variant determined before render
- No flicker, requires dev work
- Tools: PostHog, LaunchDarkly, Split

---

## Running the Test

### Pre-Launch Checklist

- [ ] Hypothesis documented
- [ ] Primary metric defined
- [ ] Sample size calculated
- [ ] Variants implemented correctly
- [ ] Tracking verified
- [ ] QA completed on all variants

### During the Test

**DO:**

- Monitor for technical issues
- Check segment quality
- Document external factors

**Avoid:**

- Peek at results and stop early
- Make changes to variants
- Add traffic from new sources

### The Peeking Problem

Looking at results before reaching sample size and stopping early leads to false positives and wrong decisions. Pre-commit to sample size and trust the process.

---

## Analyzing Results

### Statistical Significance

- 95% confidence = p-value < 0.05
- Means <5% chance result is random
- Not a guarantee—just a threshold

### Analysis Checklist

1. **Reach sample size?** If not, result is preliminary
2. **Statistically significant?** Check confidence intervals
3. **Effect size meaningful?** Compare to MDE, project impact
4. **Secondary metrics consistent?** Support the primary?
5. **Guardrail concerns?** Anything get worse?
6. **Segment differences?** Mobile vs. desktop? New vs. returning?

### Interpreting Results

| Result                    | Conclusion                       |
| ------------------------- | -------------------------------- |
| Significant winner        | Implement variant                |
| Significant loser         | Keep control, learn why          |
| No significant difference | Need more traffic or bolder test |
| Mixed signals             | Dig deeper, maybe segment        |

---

## Documentation

Document every test with:

- Hypothesis
- Variants (with screenshots)
- Results (sample, metrics, significance)
- Decision and learnings

**For templates**: See [references/test-templates.md](references/test-templates.md)

---

## Common Mistakes

### Test Design

- Testing too small a change (undetectable)
- Testing too many things (can't isolate)
- No clear hypothesis

### Execution

- Stopping early
- Changing things mid-test
- Not checking implementation

### Analysis

- Ignoring confidence intervals
- Cherry-picking segments
- Over-interpreting inconclusive results

---

## Task-Specific Questions

1. What's your current conversion rate?
2. How much traffic does this page get?
3. What change are you considering and why?
4. What's the smallest improvement worth detecting?
5. What tools do you have for testing?
6. Have you tested this area before?

---

## Autonomous Mode

### Context Sources

1. **CRO_BASELINE.md** — baseline conversion rates for sample size calculation
2. **Analytics** — current traffic volume per page
3. **Active experiments** — check for conflicts before launching new tests

### Decision Logic

- Auto-calculate sample size from baseline rate + minimum detectable effect
- Check for conflicting experiments on the same page before creating
- Auto-stop experiments when reaching calculated sample size + 95% significance
- Never peek at results early — commit to the methodology

### Output Routing

- Save experiment design to `workspace/reports/cro/experiments/exp-{name}-{date}.md`
- Post experiment status updates to channel (launched, running, reached significance, winner)
- Send test_result to relevant agent when experiment concludes

---

## Degraded Mode

| Tool unavailable          | Fallback behavior                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| A/B testing platform      | Design experiments on paper — hypothesis, variants, metrics, sample size. Manual implementation guidance. |
| Analytics (baseline data) | Use industry benchmarks for sample size estimation                                                        |

---

## Agent Handoff

| Direction                 | Message type          | When                                                  |
| ------------------------- | --------------------- | ----------------------------------------------------- |
| Forge (ab-test) → Plume   | `test_result`         | Copy variant test concluded                           |
| Forge (ab-test) → Scout   | `test_result`         | SEO-related test concluded (meta tags, schema)        |
| Forge (ab-test) → channel | `experiment_launched` | New experiment started, include hypothesis + timeline |

---

## Related Skills

- **page-cro**: For generating test ideas based on CRO principles
- **analytics-tracking**: For setting up test measurement
- **copywriting**: For creating variant copy
