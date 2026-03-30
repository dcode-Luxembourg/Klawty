/**
 * OpenClaw Runtime — Prompt Builder
 * Token-budgeted context assembly.
 * Each block has a priority and max budget. Total is capped.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const taskDb = require("./task-db");

const WORKSPACE = path.resolve(__dirname, "..", "workspace");

// ── Approximate token counting (4 chars ≈ 1 token) ─────────────────────────

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}

// ── File loaders with caching ───────────────────────────────────────────────

const _cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function cachedRead(filePath) {
  const entry = _cache[filePath];
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.content;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    _cache[filePath] = { content, time: Date.now() };
    return content;
  } catch {
    return "";
  }
}

function loadSoul(agentName) {
  // Check for agent-specific SOUL first, then main
  const agentSoul = path.join(WORKSPACE, "agents", agentName, "AGENT.md");
  if (fs.existsSync(agentSoul)) return cachedRead(agentSoul);
  return cachedRead(path.join(WORKSPACE, "SOUL.md"));
}

function loadMemory(agentName) {
  return cachedRead(path.join(WORKSPACE, "MEMORY.md"));
}

function loadTodayLog() {
  const date = new Date().toISOString().split("T")[0];
  return cachedRead(path.join(WORKSPACE, "memory", "daily", `${date}.md`));
}

// ── Smart truncation (preserves ## headers) ─────────────────────────────────

function smartTruncate(content, maxChars) {
  if (!content || content.length <= maxChars) return content;

  const sections = content.split(/(?=^## )/m);
  if (sections.length <= 1) return content.slice(-maxChars);

  // Always keep first section
  let result = sections[0];
  let remaining = maxChars - result.length;

  // Add remaining sections from the END (most recent)
  for (let i = sections.length - 1; i >= 1; i--) {
    if (sections[i].length <= remaining) {
      result += sections[i];
      remaining -= sections[i].length;
    }
  }
  return result;
}

// ── Context blocks with priorities ──────────────────────────────────────────

function buildBlocks(agentName, agentConfig, task) {
  const now = new Date();
  const today = now.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const blocks = [];

  // Priority 1: Identity (always included)
  blocks.push({
    name: "soul",
    priority: 1,
    maxTokens: 2000,
    content: loadSoul(agentName),
  });

  blocks.push({
    name: "task-header",
    priority: 1,
    maxTokens: 500,
    content: `---
## TASK EXECUTION MODE
**Date:** ${today} | **Time:** ${timeStr}
**Agent:** ${agentName}
**Task:** "${task.title}"
**Priority:** ${task.priority || "medium"}
**Tier:** ${task.tier || "AUTO"}`,
  });

  // Priority 2: Context
  const memory = loadMemory(agentName);
  if (memory) {
    blocks.push({
      name: "memory",
      priority: 2,
      maxTokens: 800,
      content: `## YOUR MEMORY\n${smartTruncate(memory, 3000)}`,
    });
  }

  // Recent tasks (dedup)
  try {
    const recent = taskDb.getRecentTasks(agentName, 2);
    if (recent.length > 0) {
      const lines = recent
        .slice(0, 10)
        .map((t) => {
          const status = t.status === "done" ? "✅" : t.status === "failed" ? "❌" : "⏳";
          return `  ${status} [${t.status}] "${t.title}"`;
        })
        .join("\n");
      blocks.push({
        name: "recent-tasks",
        priority: 2,
        maxTokens: 500,
        content: `## RECENT TASK HISTORY (last 48h)\nDo NOT re-do any of these:\n${lines}`,
      });
    }
  } catch {}

  // Today's log
  const todayLog = loadTodayLog();
  if (todayLog) {
    blocks.push({
      name: "today-log",
      priority: 3,
      maxTokens: 500,
      content: `## TODAY'S ACTIVITY LOG\n${smartTruncate(todayLog, 2000)}`,
    });
  }

  // Pending proposals
  try {
    const pending = taskDb.getPendingProposals(agentName);
    if (pending.length > 0) {
      const lines = pending.map((p) => `  - [${p.status}] "${p.action}" (${p.tier})`).join("\n");
      blocks.push({
        name: "proposals",
        priority: 3,
        maxTokens: 300,
        content: `## PENDING PROPOSALS\nDo NOT re-submit:\n${lines}`,
      });
    }
  } catch {}

  // Priority 4: Guardrails (compressed if needed)
  blocks.push({
    name: "guardrails",
    priority: 1,
    maxTokens: 1000,
    content: `---
## EXECUTION RULES
1. Use tools to gather REAL data before making claims
2. NEVER fabricate data, statistics, names, dates, or financial figures
3. If a tool fails, report the failure — do NOT invent results
4. Before marking complete, verify with concrete evidence (IDs, numbers, confirmed reads)
5. If you used ZERO tools, your task is NOT complete
6. Post results to your channel. Keep messages under 1800 chars.
7. If you discover work for another agent, send them a message.

## OUTPUT FORMAT
**Status:** ✅ Completed | ⏭️ Skipped | ❌ Failed | ⚠️ Partial
**Action taken:** [1-2 sentences]
**Tools used:** [list]
**Proof:** [evidence]
**Errors:** [any, or "None"]
**Follow-up:** [yes/no]`,
  });

  return blocks;
}

// ── Main build function ─────────────────────────────────────────────────────

function build(agentName, agentConfig, task, totalBudget) {
  const budget = totalBudget || 10000; // tokens
  const blocks = buildBlocks(agentName, agentConfig, task);

  // Sort by priority
  blocks.sort((a, b) => a.priority - b.priority);

  // Assemble within budget
  let usedTokens = 0;
  const parts = [];

  for (const block of blocks) {
    const tokens = estimateTokens(block.content);
    const allowed = Math.min(tokens, block.maxTokens);

    if (usedTokens + allowed <= budget) {
      parts.push(block.content);
      usedTokens += allowed;
    } else if (block.priority === 1) {
      // Priority 1 always included (truncate if needed)
      const remaining = budget - usedTokens;
      if (remaining > 100) {
        parts.push(block.content.slice(0, remaining * 4));
        usedTokens += remaining;
      }
    }
    // Lower priority blocks dropped if over budget
  }

  return parts.join("\n\n");
}

function buildUserMessage(task) {
  let msg = `EXECUTE THIS TASK NOW:\n\n`;
  msg += `**Title:** ${task.title}\n`;
  if (task.description) msg += `**Details:** ${task.description}\n`;
  msg += `**Priority:** ${task.priority || "medium"}\n`;
  msg += `**Tier:** ${task.tier || "AUTO"}\n`;
  msg += `\nComplete this task using your available tools. Follow dedup rules. Provide structured summary when done.`;
  return msg;
}

module.exports = { build, buildUserMessage, smartTruncate, estimateTokens };
