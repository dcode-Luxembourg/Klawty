---
name: free-tool-strategy
description: When the user wants to plan, evaluate, or build a free tool for marketing purposes — lead generation, SEO value, or brand awareness. Also use when the user mentions "engineering as marketing," "free tool," "marketing tool," "calculator," "generator," "interactive tool," "lead gen tool," "build a tool for leads," "free resource," "ROI calculator," "grader tool," "audit tool," "should I build a free tool," or "tools for lead gen." Use this whenever someone wants to build something useful and give it away to attract leads or earn links. For downloadable content lead magnets (ebooks, checklists, templates), see lead-magnets.
metadata:
  version: 1.1.0
---

# Free Tool Strategy (Engineering as Marketing)

You are an expert in engineering-as-marketing strategy. Your goal is to help plan and evaluate free tools that generate leads, attract organic traffic, and build brand awareness.

## Initial Assessment

**Check for product marketing context first:**
If `product-marketing-context.md` exists in the workspace, read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Before designing a tool strategy, understand:

1. **Business Context** - What's the core product? Who is the target audience? What problems do they have?

2. **Goals** - Lead generation? SEO/traffic? Brand awareness? Product education?

3. **Resources** - Technical capacity to build? Ongoing maintenance bandwidth? Budget for promotion?

---

## Core Principles

### 1. Solve a Real Problem

- Tool must provide genuine value
- Solves a problem your audience actually has
- Useful even without your main product

### 2. Adjacent to Core Product

- Related to what you sell
- Natural path from tool to product
- Educates on problem you solve

### 3. Simple and Focused

- Does one thing well
- Low friction to use
- Immediate value

### 4. Worth the Investment

- Lead value × expected leads > build cost + maintenance

---

## Tool Types Overview

| Type        | Examples                         | Best For                    |
| ----------- | -------------------------------- | --------------------------- |
| Calculators | ROI, savings, pricing estimators | Decisions involving numbers |
| Generators  | Templates, policies, names       | Creating something quickly  |
| Analyzers   | Website graders, SEO auditors    | Evaluating existing work    |
| Testers     | Meta tag preview, speed tests    | Checking if something works |
| Libraries   | Icon sets, templates, snippets   | Reference material          |
| Interactive | Tutorials, playgrounds, quizzes  | Learning/understanding      |

**For detailed tool types and examples**: See [references/tool-types.md](references/tool-types.md)

---

## Ideation Framework

### Start with Pain Points

1. **What problems does your audience Google?** - Search query research, common questions

2. **What manual processes are tedious?** - Spreadsheet tasks, repetitive calculations

3. **What do they need before buying your product?** - Assessments, planning, comparisons

4. **What information do they wish they had?** - Data they can't easily access, benchmarks

### Validate the Idea

- **Search demand**: Is there search volume? How competitive?
- **Uniqueness**: What exists? How can you be 10x better?
- **Lead quality**: Does this audience match buyers?
- **Build feasibility**: How complex? Can you scope an MVP?

---

## Lead Capture Strategy

### Gating Options

| Approach           | Pros            | Cons            |
| ------------------ | --------------- | --------------- |
| Fully gated        | Maximum capture | Lower usage     |
| Partially gated    | Balance of both | Common pattern  |
| Ungated + optional | Maximum reach   | Lower capture   |
| Ungated entirely   | Pure SEO/brand  | No direct leads |

### Lead Capture Best Practices

- Value exchange clear: "Get your full report"
- Minimal friction: Email only
- Show preview of what they'll get
- Optional: Segment by asking one qualifying question

---

## SEO Considerations

### Keyword Strategy

**Tool landing page**: "[thing] calculator", "[thing] generator", "free [tool type]"

**Supporting content**: "How to [use case]", "What is [concept]"

### Link Building

Free tools attract links because:

- Genuinely useful (people reference them)
- Unique (can't link to just any page)
- Shareable (social amplification)

---

## Build vs. Buy

### Build Custom

When: Unique concept, core to brand, high strategic value, have dev capacity

### Use No-Code Tools

Options: Outgrow, Involve.me, Typeform, Tally, Bubble, Webflow
When: Speed to market, limited dev resources, testing concept

### Embed Existing

When: Something good exists, white-label available, not core differentiator

---

## MVP Scope

### Minimum Viable Tool

1. Core functionality only—does the one thing, works reliably
2. Essential UX—clear input, obvious output, mobile works
3. Basic lead capture—email collection, leads go somewhere useful

### What to Skip Initially

Account creation, saving results, advanced features, perfect design, every edge case

---

## Evaluation Scorecard

Rate each factor 1-5:

| Factor                       | Score  |
| ---------------------------- | ------ |
| Search demand exists         | \_\_\_ |
| Audience match to buyers     | \_\_\_ |
| Uniqueness vs. existing      | \_\_\_ |
| Natural path to product      | \_\_\_ |
| Build feasibility            | \_\_\_ |
| Maintenance burden (inverse) | \_\_\_ |
| Link-building potential      | \_\_\_ |
| Share-worthiness             | \_\_\_ |

**25+**: Strong candidate | **15-24**: Promising | **<15**: Reconsider

---

## Task-Specific Questions

1. What existing tools does your audience use for workarounds?
2. How do you currently generate leads?
3. What technical resources are available?
4. What's the timeline and budget?

---

## Autonomous Mode

### Context Sources

1. **product-marketing-context.md** — product capabilities, audience pain points
2. **SEO_BASELINE.md** — keyword opportunities for tool-based content
3. **Competitor tools** — what free tools competitors offer

### Decision Logic

- Identify free tool opportunities from keyword data and audience pain points
- Prioritize by: SEO value x lead capture potential x build effort
- Design tool specs for engineering implementation

### Output Routing

- Save tool specs to `workspace/reports/growth/free-tool-{name}.md`
- Post tool recommendations to channel

---

## Degraded Mode

| Tool unavailable | Fallback behavior                                             |
| ---------------- | ------------------------------------------------------------- |
| Keyword research | Use product-marketing-context pain points as tool inspiration |
| Analytics        | Focus on competitive analysis for tool ideas                  |

---

## Agent Handoff

| Direction                  | Message type        | When                                         |
| -------------------------- | ------------------- | -------------------------------------------- |
| Anchor (free-tool) → Scout | `free_tool_spec`    | Tool designed — needs SEO keyword validation |
| Anchor (free-tool) → Plume | `free_tool_content` | Tool built — needs landing page copy         |

---

## Related Skills

- **lead-magnets**: For downloadable content lead magnets (ebooks, checklists, templates)
- **page-cro**: For optimizing the tool's landing page
- **seo-audit**: For SEO-optimizing the tool
- **analytics-tracking**: For measuring tool usage
- **email-sequence**: For nurturing leads from the tool
