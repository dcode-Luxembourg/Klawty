/** OpenClaw Runtime — Policy Engine */

/**
 * Code-level governance gate. Evaluates every tool call before execution.
 * Returns { allowed, reason }. Instant, deterministic, zero LLM cost.
 *
 * 7 rules checked in order:
 *   1. Agent must exist in the configured agents list
 *   2. Tool not in agent's tools_denied (supports glob patterns)
 *   3. Tool must be in agent's tools_allowed (if not wildcard)
 *   4. Agent daily cost cap not exceeded
 *   5. System daily cost cap not exceeded
 *   6. Guardian agents cannot use business tools
 *   7. Research agents cannot use write tools
 *
 * Configuration is passed in at init() time — no hardcoded paths.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// --- State (initialized via init()) ---
let agentIndex = {}; // { agentId: { role, toolsAllowed: Set|null, toolsDenied: [] } }
let agentCaps = {}; // { agentId: capUsd }
let systemDailyCap = 8.0;
let validAgentIds = new Set();
let sharedTools = []; // Tools allowed for all agents regardless of allowlist
let businessTools = new Set(); // Tools that guardian agents must never use
let writeVerbPattern =
  /^(write|create|update|delete|send|deploy|draft|modify|remove|schedule|score|assign)/i;

// Logger fallback — accepts an external logger or uses console
let logger = {
  info: (...args) => console.log("[policy-engine]", ...args),
  warn: (...args) => console.warn("[policy-engine]", ...args),
};

// In-memory daily spend tracker (resets when date changes)
let dailySpend = {};
let systemSpend = 0;
let spendDate = "";

// --- YAML frontmatter parser — simple line-by-line, no library ---
function parseFrontmatter(content) {
  const lines = content.split("\n");
  if (lines[0].trim() !== "---") return { role: "", toolsAllowed: [], toolsDenied: [] };
  const endIdx = lines.indexOf("---", 1);
  if (endIdx === -1) return { role: "", toolsAllowed: [], toolsDenied: [] };

  const toolsAllowed = [];
  const toolsDenied = [];
  let role = "";
  let currentList = null;

  for (let i = 1; i < endIdx; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith("role:")) {
      role = trimmed
        .slice(5)
        .trim()
        .replace(/^["']|["']$/g, "");
      currentList = null;
      continue;
    }
    // Inline empty array: `tools_denied: []`
    if (/^tools_(allowed|denied):\s*\[]/.test(trimmed)) {
      currentList = null;
      continue;
    }
    // List header
    if (trimmed === "tools_allowed:") {
      currentList = toolsAllowed;
      continue;
    }
    if (trimmed === "tools_denied:") {
      currentList = toolsDenied;
      continue;
    }
    // List item
    if (currentList && trimmed.startsWith("- ")) {
      const val = trimmed
        .slice(2)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (val) currentList.push(val);
      continue;
    }
    // Non-item line ends current list
    if (currentList && trimmed && !trimmed.startsWith("-")) currentList = null;
  }
  return { role, toolsAllowed, toolsDenied };
}

// --- Glob pattern matching (supports * as wildcard) ---
function globMatches(pattern, value) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + escaped + "$").test(value);
}

/**
 * Initialize the policy engine.
 *
 * @param {object} opts
 * @param {string} opts.configPath       - Path to klawty.json (JSON5 supported)
 * @param {string} opts.agentsDir        - Path to workspace/agents/ directory
 * @param {object} [opts.logger]         - Logger with .info() and .warn() methods
 * @param {Array}  [opts.sharedTools]    - Tool names always allowed for all agents
 *   Default: ['recall_memory', 'store_memory', 'read_session_log', 'send_agent_message']
 * @param {Array}  [opts.businessTools]  - Tool names that guardian agents cannot use
 *   Default: a sensible set of write/business tools
 * @param {RegExp} [opts.writeVerbPattern] - Pattern matching write-verb tool names for research restriction
 *   Default: /^(write|create|update|delete|send|deploy|draft|modify|remove|schedule|score|assign)/i
 */
function init(opts) {
  if (!opts || !opts.configPath || !opts.agentsDir) {
    throw new Error("policy-engine.init() requires opts.configPath and opts.agentsDir");
  }

  // Reset all state (supports re-initialization for testing)
  agentIndex = {};
  agentCaps = {};
  validAgentIds = new Set();
  dailySpend = {};
  systemSpend = 0;
  spendDate = "";
  systemDailyCap = 8.0;

  if (opts.logger) logger = opts.logger;

  // Configurable shared tools
  sharedTools = opts.sharedTools || [
    "recall_memory",
    "store_memory",
    "read_session_log",
    "send_agent_message",
    "send_alert",
    "check_service_health",
    "check_system_health",
  ];

  // Configurable business tools (guardian restriction)
  businessTools = new Set(
    opts.businessTools || [
      "write_blog_post",
      "draft_email",
      "draft_followup",
      "deploy_site",
      "git_pull",
      "npm_build",
      "pm2_restart",
      "score_lead",
      "create_task",
      "schedule_social",
      "update_meta",
      "modify_subscription",
      "onboard_customer",
      "draft_proposal_email",
      "suggest_keywords",
    ],
  );

  // Configurable write verb pattern (research restriction)
  if (opts.writeVerbPattern) writeVerbPattern = opts.writeVerbPattern;

  const configPath = path.resolve(opts.configPath);
  const agentsDir = path.resolve(opts.agentsDir);

  // Load klawty.json (strip JSON5 comments + trailing commas)
  try {
    let raw = fs.readFileSync(configPath, "utf-8");
    // Strip full-line comments, then trailing comments after ,}] (avoids breaking URLs)
    raw = raw.replace(/^\s*\/\/.*$/gm, "");
    raw = raw.replace(/([,}\]"0-9])\s*\/\/.*$/gm, "$1");
    raw = raw.replace(/,(\s*[}\]])/g, "$1");
    const config = JSON.parse(raw);
    systemDailyCap =
      (config.costs && config.costs.dailyCapUsd) ||
      (config.costs && config.costs.daily_cap_usd) ||
      8.0;
    agentCaps =
      (config.costs && config.costs.perAgentCaps) ||
      (config.costs && config.costs.per_agent_caps) ||
      {};
    if (config.agents && config.agents.list) {
      for (const a of config.agents.list) validAgentIds.add(a.id);
    }
  } catch (err) {
    logger.warn("Failed to load config file -- using defaults", { error: err.message });
  }

  // Parse each agent's AGENT.md for tools_allowed / tools_denied
  for (const agentId of validAgentIds) {
    const mdPath = path.join(agentsDir, agentId, "AGENT.md");
    try {
      const content = fs.readFileSync(mdPath, "utf-8");
      const { role, toolsAllowed, toolsDenied } = parseFrontmatter(content);
      const isWildcard = toolsAllowed.length === 1 && toolsAllowed[0] === "*";
      agentIndex[agentId] = {
        role: role || "",
        toolsAllowed: isWildcard ? null : new Set(toolsAllowed), // null = wildcard
        toolsDenied: toolsDenied, // array for glob matching
      };
    } catch (err) {
      logger.warn("Failed to load AGENT.md", { agent: agentId, error: err.message });
      agentIndex[agentId] = { role: "", toolsAllowed: null, toolsDenied: [] };
    }
  }
  logger.info("Policy engine initialized", { agents: [...validAgentIds], systemDailyCap });
}

// --- Spend tracking ---
function ensureSpendDate() {
  const today = new Date().toISOString().slice(0, 10);
  if (spendDate !== today) {
    dailySpend = {};
    systemSpend = 0;
    spendDate = today;
  }
}

function recordSpend(agent, costUsd) {
  ensureSpendDate();
  dailySpend[agent] = (dailySpend[agent] || 0) + costUsd;
  systemSpend += costUsd;
}

function getAgentSpend(agent) {
  ensureSpendDate();
  return dailySpend[agent] || 0;
}
function getSystemSpend() {
  ensureSpendDate();
  return systemSpend;
}

// --- Core evaluation — 7 rules in order ---
function evaluateToolCall(agent, toolName, _toolArgs, _context) {
  // Rule 1: Agent must exist
  if (!validAgentIds.has(agent)) {
    return { allowed: false, reason: `Unknown agent "${agent}" -- not in config` };
  }
  const info = agentIndex[agent];
  if (!info) {
    return { allowed: false, reason: `No policy data for agent "${agent}"` };
  }

  // Rule 2: Tool not in tools_denied (supports glob patterns like *_write*)
  for (const pattern of info.toolsDenied) {
    if (globMatches(pattern, toolName)) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" denied for ${agent} (pattern: ${pattern})`,
      };
    }
  }

  // Rule 3: Tool must be in tools_allowed (if allowlist is not wildcard)
  // Shared tools are always allowed for all agents
  if (
    info.toolsAllowed !== null &&
    !info.toolsAllowed.has(toolName) &&
    !sharedTools.includes(toolName)
  ) {
    return { allowed: false, reason: `Tool "${toolName}" not in ${agent}'s allowed list` };
  }

  // Rule 4: Agent daily cost cap
  const cap = agentCaps[agent];
  if (cap != null && getAgentSpend(agent) >= cap) {
    return {
      allowed: false,
      reason: `Agent ${agent} exceeded daily cost cap ($${cap.toFixed(2)})`,
    };
  }

  // Rule 5: System daily cost cap
  if (getSystemSpend() >= systemDailyCap) {
    return {
      allowed: false,
      reason: `System daily cost cap exceeded ($${systemDailyCap.toFixed(2)})`,
    };
  }

  // Rule 6: Guardian agents cannot use business tools
  if (info.role === "guardian" && businessTools.has(toolName)) {
    return {
      allowed: false,
      reason: `Guardian agent ${agent} cannot use business tool "${toolName}"`,
    };
  }

  // Rule 7: Research agents cannot use write tools
  if (info.role === "research" && writeVerbPattern.test(toolName)) {
    return {
      allowed: false,
      reason: `Research agent ${agent} cannot use write tool "${toolName}"`,
    };
  }

  return { allowed: true, reason: "All 7 policy rules passed" };
}

// --- Audit logging — blocked decisions logged at warn level ---
function logDecision(agent, toolName, decision) {
  if (!decision.allowed) {
    logger.warn("Tool call BLOCKED", { agent, tool: toolName, reason: decision.reason });
  }
}

module.exports = {
  init,
  evaluateToolCall,
  logDecision,
  recordSpend,
  getAgentSpend,
  getSystemSpend,
  // Exposed for testing
  _parseFrontmatter: parseFrontmatter,
  _globMatches: globMatches,
};
