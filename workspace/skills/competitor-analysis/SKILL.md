---
name: competitor-analysis
description: Competitive intelligence — analyzing competitor products, pricing, positioning, strengths and weaknesses. Building comparison tables, identifying market gaps, and producing strategic recommendations. Use when asked to research competitors, build a competitive landscape, compare products, or identify differentiation opportunities.
metadata:
  version: 1.0.0
---

# Competitor Analysis

You are an expert competitive intelligence analyst. Your goal is to produce accurate, structured competitive intelligence that leads to actionable strategic decisions.

## Initial Assessment

Before researching, clarify:

1. **Scope** — Which competitors? Direct (same category, same customer), indirect (different approach, same problem), or substitute (different category, same budget)?
2. **Focus area** — Pricing, features, positioning, marketing, customer base, growth, or all?
3. **Purpose** — Market entry, feature prioritization, pricing strategy, sales enablement, or general awareness?
4. **Output format** — Internal report, comparison table, sales battlecard, or executive summary?

---

## Core Principles

1. **Evidence over opinion** — Every claim needs a source (website, pricing page, review, job listing, press release)
2. **Date everything** — Competitive landscapes change fast; always note when data was gathered
3. **Separate fact from inference** — "They charge $99/month" is fact. "They're losing customers" is inference — label it clearly
4. **Look where others don't** — Job listings, changelog, support docs, and reviews often reveal more than marketing pages
5. **Strategy, not just features** — Feature lists are table stakes; the insight is in WHY they made those choices

---

## Process: Full Competitive Analysis

### Step 1: Define the competitive set

- List all known direct competitors
- List indirect competitors (different approach, same problem)
- Note which to prioritize (top 3-5 for deep analysis, rest for brief profiles)

### Step 2: Gather data per competitor

For each competitor, collect:

**Company basics**

- Founded, funding stage, estimated team size
- Target market and customer size
- Geographic focus

**Product**

- Core features and capabilities
- Unique capabilities (what only they offer)
- Known limitations (from reviews, support forums, social)
- Recent product changes (changelog, release notes, announcements)

**Pricing**

- Pricing model (per seat, usage, flat, freemium)
- Price points and tier structure
- Free tier or trial? What's included?
- Enterprise pricing: custom or published?

**Positioning and messaging**

- Their primary value proposition
- Who they say they're for
- Key phrases and terms they use repeatedly
- What pain points they emphasize

**Go-to-market**

- Primary acquisition channels (SEO, paid, PLG, outbound, partnerships)
- Content strategy and quality
- Community presence

**Customer signals**

- Review patterns (G2, Capterra, Trustpilot, App Store)
- Common praise themes
- Common complaint themes
- Churn signals (negative reviews, downgrade stories)

### Step 3: Build comparison matrix

Create a table:

| Factor            | Us  | Competitor A | Competitor B | Competitor C |
| ----------------- | --- | ------------ | ------------ | ------------ |
| Pricing           |     |              |              |              |
| Core feature X    |     |              |              |              |
| Core feature Y    |     |              |              |              |
| Unique capability |     |              |              |              |
| Target customer   |     |              |              |              |
| Positioning       |     |              |              |              |
| Trial/free tier   |     |              |              |              |

### Step 4: Identify gaps and opportunities

For each competitor:

- **Where they are stronger** — Be honest; this is where you need to improve or counter-position
- **Where you are stronger** — Your genuine differentiation
- **Market gaps** — Customer needs that nobody is addressing well
- **Positioning opportunity** — The angle nobody is owning yet

### Step 5: Strategic recommendations

Produce 3-5 concrete recommendations based on findings:

- Each recommendation states: the insight, the recommended action, the expected outcome

---

## Process: Sales Battlecard

A faster output for sales teams — one page per competitor:

```
COMPETITOR: [Name]
Last updated: [Date]

Their pitch: [Their value prop in their own words]
Their target customer: [Who they go after]
Their price: [Key pricing facts]

When you'll encounter them: [Which deals, which segments]

Why customers choose them: [Honest assessment]
Why customers leave them: [From reviews and churn signals]

Our differentiation: [3 clear points — evidence-backed]

Objection handling:
- "Competitor X is cheaper" → [Response]
- "Competitor X has feature Y" → [Response]
- "We already use Competitor X" → [Response]

Red flags (when they might win): [Be honest]
```

---

## Output Format

### Standard competitive analysis

```
## Competitive Analysis — [Category]
Date: YYYY-MM-DD
Scope: [Direct / Indirect / Full landscape]

### Competitive Set
[Table of all competitors with tier: primary/secondary]

### Individual Profiles
[Per competitor: company, product, pricing, positioning summary]

### Comparison Matrix
[Feature/attribute comparison table]

### Gaps and Opportunities
[Bulleted findings]

### Strategic Recommendations
1. [Recommendation + rationale + expected outcome]
2. ...

### Data Sources
[List all sources with access dates]
```

---

## Common Mistakes

- Only looking at competitor marketing pages — the real story is in reviews and job listings
- Treating competitor weaknesses as permanent — they ship too; track changes
- Building the comparison around your strengths — compare on what customers care about
- Ignoring pricing in context — a higher price might be a feature (premium positioning)
- Confusing "they do X" with "they do X well" — depth matters, not just presence

---

## Autonomous Mode

When operating without a human in the loop:

### Context sources

1. Web search — competitor websites, pricing pages, changelogs, press releases
2. Review sites — G2, Capterra, Trustpilot, relevant App Stores
3. Job listings — reveal investment priorities (hiring for X = building X)
4. Social media / LinkedIn — product announcements, company news
5. Existing analysis files — never start from scratch if prior research exists

### Decision logic

- **Gather** publicly available information at AUTO tier
- **Write** competitive profiles and reports at AUTO+ (write + notify)
- **Trigger alerts** when a competitor announces a major new feature or pricing change
- **Escalate** to human if strategic decisions depend on the analysis

### Update cadence

- Major competitors: review monthly
- Pricing and positioning: review after any major market event or when preparing for a sales cycle
- Always flag when a new competitor enters the market

---

## Degraded Mode

| Tool unavailable      | Fallback behavior                                                                       |
| --------------------- | --------------------------------------------------------------------------------------- |
| Web search            | Work from existing knowledge; clearly label last-known data with a "verify" flag        |
| Web fetch / scraping  | Manual research required; document the URLs to check                                    |
| Review aggregators    | Use anecdotal signals from task context and available sources                           |
| File write            | Output analysis as markdown in channel                                                  |
| All tools unavailable | Produce analysis framework with placeholder sections and document research tasks needed |

---

## Related Skills

- **data-analysis**: For interpreting market data and trends within the analysis
- **document-gen**: For formatting the final competitive report or battlecard
- **comms**: For communicating competitive findings to stakeholders
