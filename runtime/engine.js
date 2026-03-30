/**
 * OpenClaw Runtime — Engine
 * Generic task executor. Reads AGENT.md files, no per-agent code.
 *
 * Usage:
 *   node runtime/engine.js                 ← Runs all agents
 *   node runtime/engine.js --agent atlas   ← Runs one agent
 *
 * Cycle: every 30 minutes (configurable in klawty.json)
 */

"use strict";

const fs = require("fs");
const path = require("path");

const WORKSPACE = path.resolve(__dirname, "..", "workspace");

// Load .env
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const taskDb = require("./task-db");
const circuitBreaker = require("./circuit-breaker");
const router = require("./router");
const toolRunner = require("./tool-runner");
const promptBuilder = require("./prompt-builder");
const channelAdapter = require("./channel-adapter");

// ── Config ──────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.resolve(__dirname, "..", "klawty.json");
let config = {};
try {
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  // Strip JSON5 comments but preserve URLs (// inside strings)
  const stripped = raw.replace(/("(?:[^"\\]|\\.)*")|\/\/.*$/gm, (m, str) => str || "");
  config = JSON.parse(stripped.replace(/,\s*([\]}])/g, "$1"));
} catch (e) {
  console.error("[engine] Failed to load klawty.json:", e.message);
  process.exit(1);
}

const CYCLE_MS = (config.automation?.heartbeat?.intervalMinutes || 30) * 60 * 1000;
const AGENTS = config.agents?.list || [];

// ── Agent loader ────────────────────────────────────────────────────────────

function loadAgentConfig(agentDef) {
  const name = agentDef.name;
  const agentDir = path.join(WORKSPACE, "agents", name);
  let agentMd = "";

  // Try to load AGENT.md for role-specific config
  const agentMdPath = path.join(agentDir, "AGENT.md");
  if (fs.existsSync(agentMdPath)) {
    agentMd = fs.readFileSync(agentMdPath, "utf8");
  }

  // Extract model tier from AGENT.md or config
  let modelTier = "workhorse";
  const tierMatch = agentMd.match(/Model Tier:\s*(\w+)/i);
  if (tierMatch) modelTier = tierMatch[1].toLowerCase();

  return {
    name,
    role: agentDef.role || agentDef.description,
    model: agentDef.model?.primary,
    modelTier,
    tools: agentDef.tools || { allow: [], deny: [] },
    workspace: agentDef.workspace,
    channelId: process.env[`DISCORD_CHANNEL_${name.toUpperCase()}`],
    channelToken: process.env[`DISCORD_BOT_TOKEN_${name.toUpperCase()}`],
  };
}

// ── Tool executor (placeholder — agents need real tool implementations) ─────

function createToolExecutor(agentConfig) {
  // Base tools available to all agents
  const baseTool = async (toolName, params) => {
    switch (toolName) {
      case "send_discord_message":
        return channelAdapter.post(
          "discord",
          params.channel_id || agentConfig.channelId,
          params.content || params.message,
          agentConfig.channelToken,
        );

      case "send_agent_message":
        return taskDb.sendMessage({
          fromAgent: agentConfig.name,
          toAgent: params.to_agent || params.agent,
          type: params.type || "notification",
          payload: params.message || params.payload,
        });

      case "create_task":
        return taskDb.createTask({
          agent: params.agent || agentConfig.name,
          title: params.title,
          description: params.description,
          priority: params.priority || "medium",
          tier: params.tier || "AUTO",
          dedup: true,
        });

      case "store_memory": {
        const date = new Date().toISOString().split("T")[0];
        const logPath = path.join(WORKSPACE, "memory", "daily", `${date}.md`);
        const entry = `- [${new Date().toISOString().split("T")[1].split(".")[0]}] [${agentConfig.name}] ${params.content || params.text}\n`;
        fs.appendFileSync(logPath, entry);
        return { stored: true };
      }

      default:
        return {
          error: `Tool not implemented: ${toolName}. Available: send_discord_message, send_agent_message, create_task, store_memory`,
        };
    }
  };

  return baseTool;
}

// ── Build tool definitions ──────────────────────────────────────────────────

function getBaseToolDefs() {
  return [
    {
      type: "function",
      riskLevel: "auto",
      isWriteTool: false,
      function: {
        name: "send_discord_message",
        description: "Post a message to your Discord channel",
        parameters: {
          type: "object",
          properties: { content: { type: "string", description: "Message content" } },
          required: ["content"],
        },
      },
    },
    {
      type: "function",
      riskLevel: "auto",
      isWriteTool: false,
      function: {
        name: "send_agent_message",
        description: "Send a message to another agent",
        parameters: {
          type: "object",
          properties: {
            to_agent: { type: "string", description: "Target agent name" },
            message: { type: "string", description: "Message content" },
            type: {
              type: "string",
              description: "Message type: notification, alert, task_handoff, data_request",
            },
          },
          required: ["to_agent", "message"],
        },
      },
    },
    {
      type: "function",
      riskLevel: "auto",
      isWriteTool: true,
      function: {
        name: "create_task",
        description: "Create a new task for yourself or another agent",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title" },
            description: { type: "string", description: "Task details" },
            agent: { type: "string", description: "Agent to assign (defaults to self)" },
            priority: { type: "string", description: "critical, high, medium, or low" },
          },
          required: ["title"],
        },
      },
    },
    {
      type: "function",
      riskLevel: "auto",
      isWriteTool: true,
      function: {
        name: "store_memory",
        description: "Store an insight or learning in today's activity log",
        parameters: {
          type: "object",
          properties: { content: { type: "string", description: "What to remember" } },
          required: ["content"],
        },
      },
    },
  ];
}

// ── Execute one task ────────────────────────────────────────────────────────

async function executeTask(agentConfig, task) {
  console.log(`[engine] Executing: ${agentConfig.name} — "${task.title}"`);

  // Mark in-progress
  taskDb.updateTask(task.id, { status: "in_progress" });

  // Determine model
  const modelTier = router.inferModelTier(agentConfig, task);

  // Build prompt
  const systemPrompt = promptBuilder.build(agentConfig.name, agentConfig, task);
  const userMessage = promptBuilder.buildUserMessage(task);

  // Get tools
  const toolDefs = getBaseToolDefs();
  const toolExecutor = createToolExecutor(agentConfig);

  try {
    const result = await toolRunner.execute({
      agentName: agentConfig.name,
      taskId: task.id,
      systemPrompt,
      userMessage,
      toolDefs,
      toolExecutor,
      modelTier,
    });

    // Check for proposal pending
    if (result.startsWith("__PROPOSAL_PENDING__")) {
      const parts = result.split(":");
      taskDb.updateTask(task.id, {
        status: "review",
        metadata: { pending_proposal: parts[1] },
      });
      console.log(`[engine] ${agentConfig.name} — proposal created: ${parts[2]}`);
      circuitBreaker.recordSuccess(agentConfig.name);
      return;
    }

    // Complete task
    taskDb.completeTask(task.id, result.slice(0, 5000));
    circuitBreaker.recordSuccess(agentConfig.name);

    // Post to channel
    const channelType = config.channels?.primary || "terminal";
    await channelAdapter.post(
      channelType,
      agentConfig.channelId,
      `${agentConfig.role ? `**${agentConfig.name}** (${agentConfig.role})` : agentConfig.name}\n${result.slice(0, 1800)}`,
      agentConfig.channelToken,
    );

    // Log to daily
    const date = new Date().toISOString().split("T")[0];
    const time = new Date().toISOString().split("T")[1].split(".")[0];
    const logPath = path.join(WORKSPACE, "memory", "daily", `${date}.md`);
    fs.appendFileSync(logPath, `- [${time}] [${agentConfig.name}] ✅ ${task.title}\n`);

    console.log(`[engine] ${agentConfig.name} — completed: "${task.title}"`);
  } catch (err) {
    console.error(`[engine] ${agentConfig.name} — failed: ${err.message}`);
    taskDb.failTask(task.id, err.message);
    circuitBreaker.recordFailure(agentConfig.name, err.message);
  } finally {
    toolRunner.clearTracking(task.id);
  }
}

// ── Run one cycle ───────────────────────────────────────────────────────────

async function runCycle(targetAgent) {
  const agentsToRun = targetAgent ? AGENTS.filter((a) => a.name === targetAgent) : AGENTS;

  // Reset stuck tasks
  const unstuck = taskDb.resetStuckTasks();
  if (unstuck > 0) console.log(`[engine] Reset ${unstuck} stuck task(s)`);

  for (const agentDef of agentsToRun) {
    const agentConfig = loadAgentConfig(agentDef);

    // Check circuit breaker
    if (!circuitBreaker.isActive(agentConfig.name)) {
      console.log(`[engine] ${agentConfig.name} — paused (circuit breaker)`);
      continue;
    }

    // Check daily spend cap
    const spent = taskDb.getDailySpend();
    if (spent >= router.DAILY_CAP) {
      console.log(
        `[engine] Daily cap reached ($${spent.toFixed(2)} / $${router.DAILY_CAP}). Skipping.`,
      );
      break;
    }

    // Get next task
    const tasks = taskDb.getNextTasks(agentConfig.name, 1);
    if (tasks.length === 0) {
      console.log(`[engine] ${agentConfig.name} — no tasks in backlog`);
      continue;
    }

    await executeTask(agentConfig, tasks[0]);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const agentFlag = args.indexOf("--agent");
const targetAgent = agentFlag !== -1 ? args[agentFlag + 1] : null;

console.log(`[engine] Starting OpenClaw engine`);
console.log(`[engine] Agents: ${AGENTS.map((a) => a.name).join(", ")}`);
console.log(`[engine] Cycle: every ${CYCLE_MS / 60000} minutes`);
console.log(`[engine] Daily cap: $${router.DAILY_CAP}`);
if (targetAgent) console.log(`[engine] Target agent: ${targetAgent}`);

// Initial run
runCycle(targetAgent).catch((err) => console.error("[engine] Cycle error:", err.message));

// Recurring cycle
setInterval(() => {
  runCycle(targetAgent).catch((err) => console.error("[engine] Cycle error:", err.message));
}, CYCLE_MS);

// Keep alive
process.on("SIGTERM", () => {
  console.log("[engine] Shutting down...");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("[engine] Shutting down...");
  process.exit(0);
});
