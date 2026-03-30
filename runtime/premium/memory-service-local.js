/** OpenClaw Runtime — Memory Service Local (Premium — Team Tier) */

/**
 * File-based memory system with relevance scoring.
 * This is the "lite" version — no Qdrant/vector search.
 *
 * Memory Tiers:
 *   1. Working Memory  — Current task context (injected per cycle)
 *   2. Session Memory   — Today's activity log (/memory/YYYY-MM-DD.md)
 *   3. Agent Memory     — Agent-specific knowledge (/agents/{name}/MEMORY.md)
 *   4. (Disabled)       — Semantic Memory requires Fleet tier
 *   5. Reference Memory  — Static knowledge bases (/memory/*.md)
 *
 * Context Budget:
 *   60% task content, 25% memory injection, 15% identity/guardrails
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Logger — lightweight, replaceable via init()
// ---------------------------------------------------------------------------

let _logger = {
  info: (msg, ctx) => console.log(`[memory-service] ${msg}`, ctx || ""),
  warn: (msg, ctx) => console.warn(`[memory-service] ${msg}`, ctx || ""),
  error: (msg, ctx) => console.error(`[memory-service] ${msg}`, ctx || ""),
  debug: (msg, ctx) => {},
};

// ---------------------------------------------------------------------------
// Configuration — set via init()
// ---------------------------------------------------------------------------

let _basePath = "";
let _agentsDir = "";
let _memoryDir = "";

// Context window budget (approximate token counts)
const CONTEXT_BUDGET = {
  task: 0.6, // 60% for current task
  memory: 0.25, // 25% for memory injection
  identity: 0.15, // 15% for SOUL/AGENT.md + guardrails
};

// Relevance scoring weights
const SCORE_WEIGHTS = {
  recency: 0.3,
  relevance: 0.5,
  agentSpecificity: 0.2,
};

/**
 * Memory access boundaries — configurable per-agent.
 * Agents with canRead: ['*'] can access all other agents' memories.
 * Agents with readOnly: true cannot write memories.
 * @type {Object<string, {canRead: string[], readOnly?: boolean, note?: string}>}
 */
let _memoryBoundaries = {};

// ---------------------------------------------------------------------------
// Tier 1: Working Memory (Current Task Context)
// ---------------------------------------------------------------------------

function getWorkingMemory(agentName, currentTask) {
  return {
    tier: "working",
    content: currentTask
      ? `## Current Task\n- ID: ${currentTask.id}\n- Title: ${currentTask.title}\n- Status: ${currentTask.status}\n- Priority: ${currentTask.priority}\n- Description: ${currentTask.description || "N/A"}`
      : "## Current Task\nNo active task.",
    score: 1.0, // Always highest priority
  };
}

// ---------------------------------------------------------------------------
// Tier 2: Session Memory (Today's Activity)
// ---------------------------------------------------------------------------

function getSessionMemory() {
  const today = new Date().toISOString().split("T")[0];
  const filePath = path.join(_memoryDir, `${today}.md`);

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return {
        tier: "session",
        content: `## Today's Activity Log\n${content}`,
        score: 0.9,
      };
    }
  } catch (err) {
    _logger.warn("Failed to read session memory", { error: err.message });
  }

  return {
    tier: "session",
    content: "## Today's Activity\nNo activity logged yet today.",
    score: 0.1,
  };
}

// ---------------------------------------------------------------------------
// Tier 3: Agent Memory
// ---------------------------------------------------------------------------

function getAgentMemory(agentName) {
  const filePath = path.join(_agentsDir, agentName, "MEMORY.md");

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return {
        tier: "agent",
        content: `## ${agentName}'s Memory\n${content}`,
        score: 0.8,
      };
    }
  } catch (err) {
    _logger.warn("Failed to read agent memory", { agent: agentName, error: err.message });
  }

  return { tier: "agent", content: `## ${agentName}'s Memory\nNo memory file found.`, score: 0.1 };
}

// ---------------------------------------------------------------------------
// Tier 4: Semantic Memory — DISABLED in local/Team tier
// Requires Fleet tier for Qdrant vector search.
// ---------------------------------------------------------------------------

async function getSemanticMemory(agentName, taskContext, limit = 5) {
  // No-op in local/Team tier — returns empty results
  return [];
}

// ---------------------------------------------------------------------------
// Tier 5: Reference Memory (Static Knowledge Bases)
// ---------------------------------------------------------------------------

function getReferenceMemory(keywords = []) {
  const results = [];

  if (!fs.existsSync(_memoryDir)) return results;

  // Find all .md files in the memory directory that are NOT date-based session logs
  let referenceFiles;
  try {
    referenceFiles = fs
      .readdirSync(_memoryDir)
      .filter((f) => f.endsWith(".md") && !/^\d{4}-\d{2}-\d{2}\.md$/.test(f));
  } catch {
    return results;
  }

  for (const file of referenceFiles) {
    const filePath = path.join(_memoryDir, file);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8");
        // Score based on keyword presence
        const keywordScore =
          keywords.length > 0
            ? keywords.filter((kw) => content.toLowerCase().includes(kw.toLowerCase())).length /
              keywords.length
            : 0.3;

        results.push({
          tier: "reference",
          content: content.substring(0, 2000), // Cap reference content
          score: keywordScore * 0.6, // Reference scores lower than other tiers
          source: file,
        });
      }
    } catch (err) {
      _logger.warn("Failed to read reference file", { file, error: err.message });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Relevance Scoring
// ---------------------------------------------------------------------------

function scoreMemoryChunk(chunk, requestingAgent) {
  let score = 0;

  // Recency score (decay over time)
  if (chunk.timestamp) {
    const ageMs = Date.now() - new Date(chunk.timestamp).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 1 - ageHours / (24 * 30)); // Decay over 30 days
    score += recencyScore * SCORE_WEIGHTS.recency;
  } else {
    score += 0.5 * SCORE_WEIGHTS.recency; // Unknown age gets middle score
  }

  // Relevance score (from similarity or keyword matching)
  if (chunk.score) {
    score += chunk.score * SCORE_WEIGHTS.relevance;
  }

  // Agent specificity score
  if (chunk.agent === requestingAgent) {
    score += 1.0 * SCORE_WEIGHTS.agentSpecificity;
  } else {
    score += 0.3 * SCORE_WEIGHTS.agentSpecificity;
  }

  return Math.min(1.0, score);
}

// ---------------------------------------------------------------------------
// Context Assembly
// ---------------------------------------------------------------------------

/**
 * Assemble memory tiers into a single context block (file-based only).
 * Prioritizes by tier score, caps total at maxTokenBudget.
 *
 * @param {string} agentName - Agent requesting context
 * @param {object} task - Current task object (or null)
 * @param {number} maxTokenBudget - Max tokens for memory block (default 4000)
 * @returns {Promise<string>} - Formatted markdown for prompt injection
 */
async function assembleContext(agentName, task, maxTokenBudget = 4000) {
  const charBudget = maxTokenBudget * 4; // ~1 token ~ 4 chars
  const chunks = [];

  // Tier 1: Working memory (score 1.0)
  if (task) {
    chunks.push({
      tier: "working",
      score: 1.0,
      content: `Current task: "${task.title}" (${task.priority} priority, ${task.status})`,
    });
  }

  // Tier 2: Session memory (score 0.9)
  const session = getSessionMemory();
  if (session.content && session.score > 0.1) chunks.push(session);

  // Tier 3: Agent memory (score 0.8)
  const agentMem = getAgentMemory(agentName);
  if (agentMem.content && agentMem.score > 0.1) {
    chunks.push({ tier: "agent", content: agentMem.content.slice(-2000), score: 0.8 });
  }

  // Tier 4: Semantic memory — SKIPPED in local/Team tier

  // Tier 5: Reference memory (score 0.6)
  if (task) {
    const keywords = (task.title + " " + (task.description || ""))
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const refChunks = getReferenceMemory(keywords);
    chunks.push(...refChunks);
  }

  // Assemble by priority, respecting char budget
  chunks.sort((a, b) => b.score - a.score);
  let usedChars = 0;
  const selected = [];
  for (const chunk of chunks) {
    if (usedChars + chunk.content.length <= charBudget) {
      selected.push(chunk);
      usedChars += chunk.content.length;
    } else if (usedChars < charBudget) {
      const remaining = charBudget - usedChars;
      selected.push({ ...chunk, content: chunk.content.slice(0, remaining) + "\n[...truncated]" });
      usedChars += remaining;
      break;
    }
  }

  _logger.info("Context assembled", {
    agent: agentName,
    totalChunks: chunks.length,
    selectedChunks: selected.length,
    totalChars: usedChars,
    charBudget,
  });

  if (selected.length === 0) return "";

  const TIER_LABELS = {
    working: "CURRENT TASK",
    session: "TODAY'S LOG",
    agent: "YOUR MEMORY",
    reference: "REFERENCE DATA",
  };

  const sections = selected.map((s) => {
    return `### ${TIER_LABELS[s.tier] || s.tier}\n${s.content}`;
  });

  return `\n## MEMORY CONTEXT\n${sections.join("\n\n")}`;
}

// ---------------------------------------------------------------------------
// Memory Write Operations
// ---------------------------------------------------------------------------

function appendSessionLog(entry) {
  const today = new Date().toISOString().split("T")[0];
  const filePath = path.join(_memoryDir, `${today}.md`);
  const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
  const line = `- [${timestamp}] ${entry}\n`;

  try {
    // Ensure memory directory exists
    if (!fs.existsSync(_memoryDir)) {
      fs.mkdirSync(_memoryDir, { recursive: true });
    }
    fs.appendFileSync(filePath, line);
  } catch (err) {
    _logger.error("Failed to append session log", { error: err.message });
  }
}

function updateAgentMemory(agentName, section, content) {
  const boundary = _memoryBoundaries[agentName];
  if (boundary && boundary.readOnly) {
    _logger.warn("Attempted write to read-only agent memory", { agent: agentName });
    return false;
  }

  const filePath = path.join(_agentsDir, agentName, "MEMORY.md");

  try {
    let existing = "";
    if (fs.existsSync(filePath)) {
      existing = fs.readFileSync(filePath, "utf8");
    }

    // Append to appropriate section
    const updated = existing + `\n### ${section} — ${new Date().toISOString()}\n${content}\n`;
    fs.writeFileSync(filePath, updated);

    _logger.info("Agent memory updated", { agent: agentName, section });
    return true;
  } catch (err) {
    _logger.error("Failed to update agent memory", { agent: agentName, error: err.message });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Convenience: recall() and recallText() — file-based keyword search fallback
// ---------------------------------------------------------------------------

/**
 * Keyword-based recall from agent MEMORY.md files (no vector search).
 * Scans the requesting agent's memory file for relevant lines.
 *
 * @param {string} query - Search query
 * @param {object} opts  - { limit?, agent?, minScore? }
 * @returns {Promise<Array<{content: string, score: number, agent: string, timestamp: string|null}>>}
 */
async function recall(query, opts = {}) {
  const { limit = 10, agent = null } = opts;
  const results = [];

  if (!query || query.trim().length === 0) return results;

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (keywords.length === 0) return results;

  // Determine which agents to search
  let agentsToSearch = [];
  if (agent) {
    agentsToSearch = [agent];
  } else {
    // Search all agents
    try {
      const entries = fs.readdirSync(_agentsDir, { withFileTypes: true });
      agentsToSearch = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return results;
    }
  }

  for (const agentName of agentsToSearch) {
    const memPath = path.join(_agentsDir, agentName, "MEMORY.md");
    if (!fs.existsSync(memPath)) continue;

    try {
      const content = fs.readFileSync(memPath, "utf8");
      const lines = content.split("\n").filter((l) => l.trim().length > 10);

      for (const line of lines) {
        const lower = line.toLowerCase();
        const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
        if (matchCount > 0) {
          const score = matchCount / keywords.length;
          results.push({
            content: line.trim(),
            score,
            agent: agentName,
            timestamp: null,
          });
        }
      }
    } catch {
      /* skip unreadable files */
    }
  }

  // Sort by score descending, limit results
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Keyword-based recall as formatted text.
 *
 * @param {string} query - Search query
 * @param {object} opts  - { limit?, minScore? }
 * @returns {Promise<string|null>} Formatted text block or null if nothing found
 */
async function recallText(query, opts = {}) {
  const results = await recall(query, opts);
  if (!results || results.length === 0) return null;

  const lines = results.map((r) => `- [${r.agent || "unknown"}] ${r.content.slice(0, 300)}`);
  return `## Relevant Memories\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// High-Level API — learn(), remember(), learnFromTask()
// File-based implementations (no Qdrant).
// ---------------------------------------------------------------------------

/**
 * learn() — Store a learning in session log and agent MEMORY.md.
 *
 * @param {string} agent - Agent name
 * @param {string} content - What was learned
 * @param {object} opts - { type, source, tags }
 * @returns {Promise<{id: string|null, stored: boolean}>}
 */
async function learn(agent, content, opts = {}) {
  const { type = "fact", source = "runner", bypassReadOnly = false } = opts;

  // Boundary check: read-only agents can't store memories
  const boundary = _memoryBoundaries[agent];
  if (boundary && boundary.readOnly && !bypassReadOnly) {
    _logger.warn("Read-only agent attempted to learn", { agent });
    return { id: null, stored: false };
  }

  // Append to session log (daily)
  appendSessionLog(`[${agent}] [${type}] ${content.slice(0, 200)}`);

  // Append to agent MEMORY.md
  const stored = updateAgentMemory(agent, `${type} (${source})`, `- ${content}`);

  _logger.info("Learning stored (file-based)", { agent, type, source });
  return { id: null, stored };
}

/**
 * remember() — Recall relevant memories using keyword search.
 *
 * @param {string} agent - Agent requesting memories
 * @param {string} query - Search query
 * @param {object} opts - { limit, types, minScore, includeOtherAgents }
 * @returns {Promise<Array>}
 */
async function remember(agent, query, opts = {}) {
  const { limit = 5, includeOtherAgents = false } = opts;

  // Check access boundaries
  const boundary = _memoryBoundaries[agent];
  if (boundary && !includeOtherAgents && !boundary.canRead.includes("*")) {
    // Agent can only read their own memories
    return recall(query, { agent, limit });
  }

  return recall(query, { agent: includeOtherAgents ? null : agent, limit });
}

/**
 * learnFromTask() — Called after task completion to extract and store learnings.
 *
 * @param {string} agent - Agent that completed the task
 * @param {object} task - { id, title, description, status }
 * @param {string} outcome - What happened
 * @param {object} opts - { reflection }
 */
async function learnFromTask(agent, task, outcome, opts = {}) {
  const { reflection = null } = opts;

  if (!outcome || outcome.length < 20) return;

  const taskSummary = `Completed task "${task.title}": ${outcome.slice(0, 300)}`;
  await learn(agent, taskSummary, {
    type: "fact",
    source: "task-completion",
  });

  if (reflection) {
    if (reflection.insight) {
      await learn(agent, reflection.insight, { type: "insight", source: "task-reflection" });
    }
    if (reflection.processImprovement) {
      await learn(agent, reflection.processImprovement, {
        type: "improvement",
        source: "task-reflection",
      });
    }
    if (reflection.mistake) {
      await learn(agent, reflection.mistake, { type: "mistake", source: "task-reflection" });
    }
  }
}

// ---------------------------------------------------------------------------
// storeMemory / storeMemories — no-op in local tier (no Qdrant)
// ---------------------------------------------------------------------------

async function storeMemory(content, metadata = {}) {
  // No vector store in local tier — store to file instead
  const agent = metadata.agent || "system";
  appendSessionLog(`[${agent}] [${metadata.type || "fact"}] ${content.slice(0, 200)}`);
  return null;
}

async function storeMemories(items) {
  const results = [];
  for (const item of items) {
    await storeMemory(item.content, item.metadata);
    results.push({ id: null, status: "ok" });
  }
  return results;
}

// ---------------------------------------------------------------------------
// getStats — file-based stats
// ---------------------------------------------------------------------------

async function getStats() {
  let sessionFiles = 0;
  let agentMemories = 0;
  let referenceFiles = 0;

  try {
    if (fs.existsSync(_memoryDir)) {
      const files = fs.readdirSync(_memoryDir).filter((f) => f.endsWith(".md"));
      sessionFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).length;
      referenceFiles = files.length - sessionFiles;
    }
  } catch {
    /* ignore */
  }

  try {
    if (fs.existsSync(_agentsDir)) {
      const entries = fs.readdirSync(_agentsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && fs.existsSync(path.join(_agentsDir, entry.name, "MEMORY.md"))) {
          agentMemories++;
        }
      }
    }
  } catch {
    /* ignore */
  }

  return {
    vectorCount: 0, // No Qdrant in local tier
    sessionFiles,
    agentMemories,
    referenceFiles,
    status: "file-based",
  };
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the local memory service with workspace configuration.
 *
 * @param {Object} config
 * @param {string} config.basePath - Workspace root directory
 * @param {Object<string, {canRead: string[], readOnly?: boolean}>} [config.memoryBoundaries]
 *   Per-agent access boundaries. Example:
 *   { orchestrator: { canRead: ['*'] }, worker: { canRead: ['worker'] } }
 * @param {Object} [config.logger] - Logger with info/warn/error/debug methods
 */
function init(config = {}) {
  if (!config.basePath) {
    throw new Error("memory-service-local requires config.basePath (workspace root directory)");
  }

  _basePath = config.basePath;
  _agentsDir = path.join(_basePath, "agents");
  _memoryDir = path.join(_basePath, "memory");

  if (config.memoryBoundaries) _memoryBoundaries = config.memoryBoundaries;
  if (config.logger) _logger = config.logger;

  // Ensure directories exist
  if (!fs.existsSync(_memoryDir)) fs.mkdirSync(_memoryDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = {
  init,

  // Tier functions
  assembleContext,
  getWorkingMemory,
  getSessionMemory,
  getAgentMemory,
  getSemanticMemory,
  getReferenceMemory,

  // Low-level (no-op / file-based in local tier)
  storeMemory,
  storeMemories,

  // High-level API
  learn,
  remember,
  learnFromTask,
  recall,
  recallText,

  // Write helpers
  appendSessionLog,
  updateAgentMemory,

  // Monitoring
  getStats,

  // Config
  CONTEXT_BUDGET,
  SCORE_WEIGHTS,
};
