/** OpenClaw Runtime — Memory Distiller (Premium) */

"use strict";

const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");

// ---------------------------------------------------------------------------
// Logger — lightweight, replaceable via init()
// ---------------------------------------------------------------------------

let _logger = {
  info: (msg, ctx) => console.log(`[memory-distiller] ${msg}`, ctx || ""),
  warn: (msg, ctx) => console.warn(`[memory-distiller] ${msg}`, ctx || ""),
  error: (msg, ctx) => console.error(`[memory-distiller] ${msg}`, ctx || ""),
  debug: (msg, ctx) => {},
};

// ---------------------------------------------------------------------------
// Configuration — set via init() or environment variables
// ---------------------------------------------------------------------------

let _basePath = "";
let _memoryDir = "";
let _agentsDir = "";

// Use workhorse tier for distillation (cheap, good enough for synthesis)
let _distillModel = process.env.DISTILL_MODEL || "deepseek/deepseek-v3.2";

// Optional: memory service for Qdrant integration (Fleet tier)
let _memoryService = null;

// Optional: alert adapter for notifications
let _alertAdapter = null;

// Agent list resolver — returns array of agent IDs
let _getAgentList = null;

// ---------------------------------------------------------------------------
// OpenRouter client
// ---------------------------------------------------------------------------

function getOpenRouterClient() {
  return new OpenAI({
    baseURL: process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || "",
  });
}

// ---------------------------------------------------------------------------
// Load session logs from the last N days
// ---------------------------------------------------------------------------

function loadRecentLogs(days = 7) {
  const logs = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 86400000);
    const dateStr = date.toISOString().split("T")[0];
    const logPath = path.join(_memoryDir, `${dateStr}.md`);
    if (fs.existsSync(logPath)) {
      logs.push({ date: dateStr, content: fs.readFileSync(logPath, "utf8") });
    }
  }
  return logs;
}

// ---------------------------------------------------------------------------
// Distill one agent's memories
// ---------------------------------------------------------------------------

async function distilAgent(agentName) {
  const client = getOpenRouterClient();
  const memPath = path.join(_agentsDir, agentName, "MEMORY.md");
  const currentMemory = fs.existsSync(memPath) ? fs.readFileSync(memPath, "utf8") : "";

  // Load context: filter session logs to this agent's entries
  const logs = loadRecentLogs(7);
  const agentLogs = logs
    .map((l) => {
      const lines = l.content.split("\n").filter((line) => line.includes(`[${agentName}]`));
      return lines.length > 0 ? `### ${l.date}\n${lines.join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n");

  if (!agentLogs && !currentMemory) {
    return { agent: agentName, insights: 0, pruned: 0, summary: "No activity" };
  }

  // Get recent Qdrant facts for this agent (if memory service is available)
  let qdrantFacts = "";
  if (_memoryService && typeof _memoryService.recall === "function") {
    try {
      const facts = await _memoryService.recall("", { agent: agentName, limit: 20 });
      if (facts?.length > 0) {
        qdrantFacts = facts.map((f) => `- ${(f.content || "").slice(0, 150)}`).join("\n");
      }
    } catch {
      /* non-blocking — Qdrant may be down */
    }
  }

  // LLM synthesis prompt
  const prompt = `You are a memory curator for "${agentName}", an AI agent in an autonomous operations team.

## Current MEMORY.md (${currentMemory.split("\n").length} lines)
${currentMemory.slice(-3000) || "(empty)"}

## Last 7 Days Activity
${agentLogs.slice(-4000) || "(no recent logs)"}

## Recent Semantic Facts
${qdrantFacts.slice(-2000) || "(none)"}

## Your Task
Analyze the agent's recent activity and current memory. Return JSON:
{
  "newInsights": ["insight 1", "insight 2"],
  "obsoletePatterns": ["exact phrase from MEMORY.md that is now outdated"],
  "weekSummary": "1-2 sentence summary of the week"
}

Rules:
- newInsights: only genuinely new learnings not already in MEMORY.md (max 5)
- obsoletePatterns: exact phrases (>10 chars) from the current MEMORY.md that are contradicted by recent activity
- Keep MEMORY.md under 100 lines total
- If nothing new, return empty arrays`;

  try {
    const resp = await client.chat.completions.create({
      model: _distillModel,
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const text = resp.choices[0]?.message?.content || "{}";
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    const result = JSON.parse(cleaned);

    // Append new insights to MEMORY.md
    if (result.newInsights?.length > 0) {
      const dateStr = new Date().toISOString().split("T")[0];
      const insightBlock = `\n## Weekly distillation — ${dateStr}\n${result.newInsights.map((i) => `- ${i}`).join("\n")}\n`;

      // Ensure the directory exists
      const memDir = path.dirname(memPath);
      if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });

      fs.appendFileSync(memPath, insightBlock);
    }

    // Strikethrough obsolete entries in MEMORY.md
    if (result.obsoletePatterns?.length > 0 && fs.existsSync(memPath)) {
      let memory = fs.readFileSync(memPath, "utf8");
      const dateStr = new Date().toISOString().split("T")[0];
      for (const pattern of result.obsoletePatterns) {
        if (pattern.length > 10 && memory.includes(pattern)) {
          memory = memory.replace(pattern, `~~${pattern}~~ *(superseded ${dateStr})*`);
        }
      }
      fs.writeFileSync(memPath, memory);
    }

    // Consolidate near-duplicate Qdrant vectors for this agent (if memory service available)
    if (_memoryService && typeof _memoryService.consolidate === "function") {
      try {
        await _memoryService.consolidate(agentName, { dryRun: false });
      } catch {
        /* non-blocking — consolidation is best-effort */
      }
    }

    return {
      agent: agentName,
      insights: result.newInsights?.length || 0,
      pruned: result.obsoletePatterns?.length || 0,
      summary: result.weekSummary || "Distilled successfully",
    };
  } catch (e) {
    _logger.error("Distillation failed", { agent: agentName, error: e.message });
    return { agent: agentName, insights: 0, pruned: 0, summary: `Error: ${e.message}` };
  }
}

// ---------------------------------------------------------------------------
// Main distillation entry point — called by cron scheduler
// ---------------------------------------------------------------------------

async function runDistillation() {
  _logger.info("Memory distillation starting");

  // Resolve agent list
  let agents;
  if (typeof _getAgentList === "function") {
    try {
      agents = _getAgentList();
    } catch (err) {
      _logger.warn("Agent list resolver failed, scanning agents directory", { error: err.message });
      agents = null;
    }
  }

  // Fallback: scan the agents directory for subdirectories containing AGENT.md or SOUL.md
  if (!agents || agents.length === 0) {
    agents = [];
    try {
      const entries = fs.readdirSync(_agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const hasAgent =
            fs.existsSync(path.join(_agentsDir, entry.name, "AGENT.md")) ||
            fs.existsSync(path.join(_agentsDir, entry.name, "SOUL.md"));
          if (hasAgent) agents.push(entry.name);
        }
      }
    } catch (err) {
      _logger.error("Failed to scan agents directory", { error: err.message });
      return [];
    }
  }

  if (agents.length === 0) {
    _logger.warn("No agents found for distillation");
    return [];
  }

  const results = [];
  for (const agent of agents) {
    const result = await distilAgent(agent);
    results.push(result);
    _logger.info("Agent distilled", result);
  }

  // Build summary
  const totalInsights = results.reduce((sum, r) => sum + r.insights, 0);
  const totalPruned = results.reduce((sum, r) => sum + r.pruned, 0);
  const summary = [
    "Memory Distillation Complete",
    "",
    ...results.map(
      (r) => `${r.agent}: ${r.summary} (+${r.insights} insights, -${r.pruned} obsolete)`,
    ),
    "",
    `Total: ${totalInsights} new insights, ${totalPruned} pruned across ${agents.length} agents.`,
  ].join("\n");

  // Post via alert adapter (if configured)
  if (_alertAdapter && typeof _alertAdapter.sendAlert === "function") {
    try {
      await _alertAdapter.sendAlert(summary, "memory-distiller");
    } catch (e) {
      _logger.warn("Alert notification failed", { error: e.message });
    }
  }

  _logger.info("Memory distillation complete", {
    totalInsights,
    totalPruned,
    agents: agents.length,
  });
  return results;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the memory distiller with workspace configuration.
 *
 * @param {Object} config
 * @param {string} config.basePath - Workspace root directory
 * @param {string} [config.distillModel] - LLM model for synthesis (default: deepseek/deepseek-v3.2)
 * @param {Object} [config.memoryService] - Memory service instance (for Qdrant integration)
 *   Must implement recall(query, opts) and optionally consolidate(agent, opts).
 * @param {Object} [config.alertAdapter] - Alert adapter with sendAlert(msg, source) method
 * @param {Function} [config.getAgentList] - Function returning array of agent IDs
 * @param {Object} [config.logger] - Logger with info/warn/error/debug methods
 */
function init(config = {}) {
  if (!config.basePath) {
    throw new Error("memory-distiller requires config.basePath (workspace root directory)");
  }

  _basePath = config.basePath;
  _agentsDir = path.join(_basePath, "agents");
  _memoryDir = path.join(_basePath, "memory");

  if (config.distillModel) _distillModel = config.distillModel;
  if (config.memoryService) _memoryService = config.memoryService;
  if (config.alertAdapter) _alertAdapter = config.alertAdapter;
  if (config.getAgentList) _getAgentList = config.getAgentList;
  if (config.logger) _logger = config.logger;
}

module.exports = { init, runDistillation, distilAgent };
